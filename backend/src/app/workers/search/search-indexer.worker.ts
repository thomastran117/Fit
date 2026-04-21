import { containerTokens } from "@/configuration/bootstrap/container";
import { environment } from "@/configuration/environment/index";
import {
  disconnectResources,
  searchBrokerWorkerResources,
} from "@/workers/shared/resources";
import {
  bootstrapWorker,
  startWorker,
} from "@/workers/shared/worker-runtime";

const workerName = "Search indexer worker";
const workerResources = searchBrokerWorkerResources;

export async function bootstrapSearchIndexerWorker(): Promise<void> {
  await bootstrapWorker({
    name: workerName,
    resources: workerResources,
    run: async ({ container }, lifecycle) => {
      const scope = container.createScope();
      const searchQueueService = scope.resolve(containerTokens.searchQueueService);
      const searchService = scope.resolve(containerTokens.searchService);
      const { prefetch, maxAttempts } = environment.getSearchIndexerWorkerConfig();

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
      lifecycle.addShutdownTask(async () => {
        await Promise.allSettled([stopConsuming(), scope.dispose()]);
      });
    },
  });
}

startWorker({
  name: workerName,
  bootstrap: bootstrapSearchIndexerWorker,
  cleanup: () => disconnectResources(workerResources),
});
