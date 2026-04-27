import { SearchQueueService } from "@/features/search/search.queue.service";

const mockCreateRabbitMqChannel = jest.fn();

jest.mock("@/configuration/resources/rabbitmq", () => ({
  createRabbitMqChannel: () => mockCreateRabbitMqChannel(),
}));

function createMockChannel() {
  let consumeHandler:
    | ((message: {
        content: Buffer;
        properties: {
          messageId?: string;
          contentType?: string;
          headers?: Record<string, unknown>;
        };
      } | null) => Promise<void>)
    | undefined;

  return {
    channel: {
      assertExchange: jest.fn(async () => undefined),
      assertQueue: jest.fn(async () => undefined),
      bindQueue: jest.fn(async () => undefined),
      prefetch: jest.fn(async () => undefined),
      consume: jest.fn(async (_queue: string, handler: typeof consumeHandler) => {
        consumeHandler = handler;
        return {
          consumerTag: "consumer-1",
        };
      }),
      publish: jest.fn(() => true),
      waitForConfirms: jest.fn(async () => undefined),
      cancel: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      on: jest.fn(),
    },
    getConsumeHandler: () => consumeHandler,
  };
}

describe("SearchQueueService", () => {
  beforeEach(() => {
    mockCreateRabbitMqChannel.mockReset();
  });

  it("dead-letters malformed consumer payloads instead of requeueing them", async () => {
    const { channel, getConsumeHandler } = createMockChannel();
    mockCreateRabbitMqChannel.mockResolvedValue(channel);
    const service = new SearchQueueService("postings");

    await service.consumeIndexJobs(5, async () => undefined);

    const handler = getConsumeHandler();
    expect(handler).toBeDefined();

    const message = {
      content: Buffer.from("{invalid-json", "utf8"),
      properties: {
        messageId: "msg-1",
        contentType: "application/json",
        headers: {},
      },
    };

    await handler!(message);

    expect(channel.publish).toHaveBeenCalledWith(
      "postings.search-index.exchange",
      "dead-letter",
      message.content,
      expect.objectContaining({
        messageId: "msg-1",
        headers: expect.objectContaining({
          deadLetterReason: "invalid_json",
        }),
      }),
    );
    expect(channel.waitForConfirms).toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("reuses the publisher channel across multiple publishes", async () => {
    const { channel } = createMockChannel();
    mockCreateRabbitMqChannel.mockResolvedValue(channel);
    const service = new SearchQueueService("postings");

    await service.publishIndexJob({
      outboxId: "outbox-1",
      eventId: "outbox-1",
      dedupeKey: "outbox-1",
      operation: "upsert",
      jobType: "upsert",
      postingId: "posting-1",
      targetIndexScope: "live",
      occurredAt: "2026-04-27T00:00:00.000Z",
      attempt: 0,
    });
    await service.publishIndexJob({
      outboxId: "outbox-2",
      eventId: "outbox-2",
      dedupeKey: "outbox-2",
      operation: "delete",
      jobType: "delete",
      postingId: "posting-1",
      targetIndexScope: "live",
      occurredAt: "2026-04-27T00:00:01.000Z",
      attempt: 0,
    });

    expect(mockCreateRabbitMqChannel).toHaveBeenCalledTimes(1);
    expect(channel.publish).toHaveBeenCalledTimes(2);
  });
});
