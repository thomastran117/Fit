import { containerTokens } from "@/configuration/bootstrap/container";
import { environment } from "@/configuration/environment/index";
import {
  disconnectResources,
  searchBrokerWorkerResources,
} from "@/workers/shared/resources";
import { bootstrapPollingWorker, startWorker } from "@/workers/shared/worker-runtime";

const workerName = "Search reindex worker";
const workerResources = searchBrokerWorkerResources;

export async function bootstrapSearchReindexWorker(): Promise<void> {
  await bootstrapPollingWorker({
    name: workerName,
    resources: workerResources,
    getPollIntervalMs: () => environment.getSearchReindexWorkerConfig().pollIntervalMs,
    runOnce: async ({ scope }) => {
      const searchService = scope.resolve(containerTokens.searchService);
      const { batchSize } = environment.getSearchReindexWorkerConfig();
      return searchService.processReindexRuns(batchSize);
    },
  });
}

startWorker({
  name: workerName,
  bootstrap: bootstrapSearchReindexWorker,
  cleanup: () => disconnectResources(workerResources),
});
