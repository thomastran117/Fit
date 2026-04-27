import type {
  Channel,
  ConsumeMessage,
  ConfirmChannel,
} from "amqplib";
import { environment } from "@/configuration/environment/index";
import { createRabbitMqChannel } from "@/configuration/resources/rabbitmq";
import type {
  SearchIndexJobPayload,
  SearchQueueCounts,
} from "@/features/search/search.model";

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;

export class SearchQueueService {
  private readonly exchangeName: string;
  private readonly mainQueueName: string;
  private readonly retryQueueNames: string[];
  private readonly deadLetterQueueName: string;
  private publisherChannelPromise: Promise<ConfirmChannel> | null = null;
  private publisherTopologyPromise: Promise<void> | null = null;

  constructor(indexBaseName = environment.getElasticsearchConfig().postingsIndexName) {
    const prefix = `${indexBaseName}.search-index`;

    this.exchangeName = `${prefix}.exchange`;
    this.mainQueueName = `${prefix}.main`;
    this.retryQueueNames = RETRY_DELAYS_MS.map((_, index) => `${prefix}.retry.${index + 1}`);
    this.deadLetterQueueName = `${prefix}.dead-letter`;
  }

  async ensureTopology(): Promise<void> {
    const channel = await createRabbitMqChannel();

    try {
      await this.assertTopology(channel);
    } finally {
      await channel.close();
    }
  }

  async publishIndexJob(payload: SearchIndexJobPayload): Promise<void> {
    await this.publishWithRoutingKey("main", payload);
  }

  async publishRetryJob(payload: SearchIndexJobPayload, attempt: number): Promise<void> {
    const retryIndex = Math.min(Math.max(attempt - 1, 0), this.retryQueueNames.length - 1);
    await this.publishWithRoutingKey(`retry.${retryIndex + 1}`, payload);
  }

  async publishDeadLetterJob(payload: SearchIndexJobPayload): Promise<void> {
    await this.publishWithRoutingKey("dead-letter", payload);
  }

  async consumeIndexJobs(
    prefetch: number,
    onMessage: (
      payload: SearchIndexJobPayload,
      message: ConsumeMessage,
      channel: Channel,
    ) => Promise<void>,
  ): Promise<() => Promise<void>> {
    const channel = await createRabbitMqChannel();
    await this.assertTopology(channel);
    await channel.prefetch(prefetch);

    const consumeResult = await channel.consume(this.mainQueueName, async (message) => {
      if (!message) {
        return;
      }

      try {
        let payload: SearchIndexJobPayload;

        try {
          payload = JSON.parse(message.content.toString("utf8")) as SearchIndexJobPayload;
        } catch (error) {
          console.error("Search index consumer received an invalid JSON payload.", {
            error,
            messageId: message.properties.messageId,
          });
          await this.publishMalformedMessage(channel, message, error);
          channel.ack(message);
          return;
        }

        await onMessage(payload, message, channel);
      } catch (error) {
        console.error("Search index consumer failed before ack/nack handling", error);
        channel.nack(message, false, true);
      }
    });

    return async () => {
      await channel.cancel(consumeResult.consumerTag);
      await channel.close();
    };
  }

  async getQueueCounts(): Promise<{
    main: SearchQueueCounts;
    retry1: SearchQueueCounts;
    retry2: SearchQueueCounts;
    retry3: SearchQueueCounts;
    deadLetter: SearchQueueCounts;
  }> {
    const channel = await createRabbitMqChannel();

    try {
      await this.assertTopology(channel);

      const [main, retry1, retry2, retry3, deadLetter] = await Promise.all([
        channel.checkQueue(this.mainQueueName),
        channel.checkQueue(this.retryQueueNames[0]!),
        channel.checkQueue(this.retryQueueNames[1]!),
        channel.checkQueue(this.retryQueueNames[2]!),
        channel.checkQueue(this.deadLetterQueueName),
      ]);

      return {
        main: this.toQueueCounts(main),
        retry1: this.toQueueCounts(retry1),
        retry2: this.toQueueCounts(retry2),
        retry3: this.toQueueCounts(retry3),
        deadLetter: this.toQueueCounts(deadLetter),
      };
    } finally {
      await channel.close();
    }
  }

  private async publishWithRoutingKey(
    routingKey: string,
    payload: SearchIndexJobPayload,
  ): Promise<void> {
    const channel = await this.getPublisherChannel();

    try {
      await this.ensurePublisherTopology(channel);
      channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(payload), "utf8"),
        {
          persistent: true,
          contentType: "application/json",
          messageId: payload.eventId,
          timestamp: Date.now(),
        },
      );
      await channel.waitForConfirms();
    } catch (error) {
      this.resetPublisherChannel();
      throw error;
    }
  }

  private async assertTopology(channel: Channel): Promise<void> {
    await channel.assertExchange(this.exchangeName, "direct", {
      durable: true,
    });
    await channel.assertQueue(this.mainQueueName, {
      durable: true,
    });
    await channel.bindQueue(this.mainQueueName, this.exchangeName, "main");

    for (const [index, queueName] of this.retryQueueNames.entries()) {
      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          "x-message-ttl": RETRY_DELAYS_MS[index],
          "x-dead-letter-exchange": this.exchangeName,
          "x-dead-letter-routing-key": "main",
        },
      });
      await channel.bindQueue(queueName, this.exchangeName, `retry.${index + 1}`);
    }

    await channel.assertQueue(this.deadLetterQueueName, {
      durable: true,
    });
    await channel.bindQueue(this.deadLetterQueueName, this.exchangeName, "dead-letter");
  }

  private toQueueCounts(queue: { messageCount: number; consumerCount: number }): SearchQueueCounts {
    return {
      ready: queue.messageCount,
      consumers: queue.consumerCount,
    };
  }

  private async publishMalformedMessage(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    error: unknown,
  ): Promise<void> {
    channel.publish(this.exchangeName, "dead-letter", message.content, {
      persistent: true,
      contentType: message.properties.contentType || "application/json",
      messageId: message.properties.messageId,
      timestamp: Date.now(),
      headers: {
        ...(message.properties.headers ?? {}),
        deadLetterReason: "invalid_json",
        deadLetterError: error instanceof Error ? error.message : "Invalid JSON payload.",
      },
    });
    await channel.waitForConfirms();
  }

  private async getPublisherChannel(): Promise<ConfirmChannel> {
    if (!this.publisherChannelPromise) {
      this.publisherChannelPromise = createRabbitMqChannel().then((channel) => {
        channel.on("close", () => {
          this.resetPublisherChannel();
        });
        channel.on("error", () => {
          this.resetPublisherChannel();
        });
        return channel;
      });
    }

    return this.publisherChannelPromise;
  }

  private async ensurePublisherTopology(channel: ConfirmChannel): Promise<void> {
    if (!this.publisherTopologyPromise) {
      this.publisherTopologyPromise = this.assertTopology(channel).catch((error) => {
        this.publisherTopologyPromise = null;
        throw error;
      });
    }

    await this.publisherTopologyPromise;
  }

  private resetPublisherChannel(): void {
    this.publisherChannelPromise = null;
    this.publisherTopologyPromise = null;
  }
}
