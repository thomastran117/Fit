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

export async function bootstrapSearchReindexWorker(): Promise<void> {
  loadEnvironment();
  await connectDatabase();
  await connectElasticsearch();
  await connectRabbitMq();
  const container = initializeContainer();
  const { pollIntervalMs, batchSize } = environment.getSearchReindexWorkerConfig();

  console.log("Search reindex worker started.");

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down search reindex worker...`);
    await Promise.allSettled([
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

  while (!isShuttingDown) {
    const scope = container.createScope();

    try {
      const searchService = scope.resolve(containerTokens.searchService);
      const processedCount = await searchService.processReindexRuns(batchSize);

      if (processedCount === 0) {
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      console.error("Search reindex worker loop failed", error);
      await sleep(pollIntervalMs);
    } finally {
      await scope.dispose();
    }
  }
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

void bootstrapSearchReindexWorker().catch(async (error: unknown) => {
  console.error("Failed to start search reindex worker", error);
  await Promise.allSettled([
    disconnectRabbitMq(),
    disconnectDatabase(),
    disconnectElasticsearch(),
  ]);
  process.exit(1);
});
