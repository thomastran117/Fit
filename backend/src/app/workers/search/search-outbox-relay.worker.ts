import { containerTokens } from "@/configuration/bootstrap/container";
import { environment } from "@/configuration/environment/index";
import {
  disconnectResources,
  searchBrokerWorkerResources,
} from "@/workers/shared/resources";
import { bootstrapPollingWorker, startWorker } from "@/workers/shared/worker-runtime";

const workerName = "Search outbox relay worker";
const workerResources = searchBrokerWorkerResources;

export async function bootstrapSearchOutboxRelayWorker(): Promise<void> {
  await bootstrapPollingWorker({
    name: workerName,
    resources: workerResources,
    getPollIntervalMs: () => environment.getSearchRelayWorkerConfig().pollIntervalMs,
    runOnce: async ({ scope }) => {
      const searchService = scope.resolve(containerTokens.searchService);
      const { batchSize, maxAttempts } = environment.getSearchRelayWorkerConfig();
      return searchService.processOutboxRelayBatch(batchSize, maxAttempts);
    },
  });
}

startWorker({
  name: workerName,
  bootstrap: bootstrapSearchOutboxRelayWorker,
  cleanup: () => disconnectResources(workerResources),
});
