import { containerTokens, initializeContainer } from "@/configuration/bootstrap/container";
import { environment, loadEnvironment } from "@/configuration/environment/index";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";
import {
  connectElasticsearch,
  disconnectElasticsearch,
} from "@/configuration/resources/elasticsearch";
import {
  connectRabbitMq,
  disconnectRabbitMq,
} from "@/configuration/resources/rabbitmq";

export async function bootstrapSearchIndexerWorker(): Promise<void> {
  loadEnvironment();
  await connectDatabase();
  await connectElasticsearch();
  await connectRabbitMq();
  const container = initializeContainer();
  const { prefetch, maxAttempts } = environment.getSearchIndexerWorkerConfig();

  console.log("Search indexer worker started.");

  let isShuttingDown = false;
  const scope = container.createScope();
  const searchQueueService = scope.resolve(containerTokens.searchQueueService);
  const searchService = scope.resolve(containerTokens.searchService);

  const stopConsuming = await searchQueueService.consumeIndexJobs(
    prefetch,
    async (payload, message, channel) => {
      try {
        await searchService.processIndexJob(payload, maxAttempts);
        channel.ack(message);
      } catch (error) {
        console.error("Failed to process search index job", {
          outboxId: payload.outboxId,
          postingId: payload.postingId,
          error,
        });
        channel.nack(message, false, true);
      }
    },
  );

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down search indexer worker...`);
    await Promise.allSettled([
      stopConsuming(),
      scope.dispose(),
      disconnectRabbitMq(),
      disconnectDatabase(),
      disconnectElasticsearch(),
    ]);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void bootstrapSearchIndexerWorker().catch(async (error: unknown) => {
  console.error("Failed to start search indexer worker", error);
  await Promise.allSettled([
    disconnectRabbitMq(),
    disconnectDatabase(),
    disconnectElasticsearch(),
  ]);
  process.exit(1);
});
