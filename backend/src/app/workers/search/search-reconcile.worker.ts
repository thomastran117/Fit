import { containerTokens } from "@/configuration/bootstrap/container";
import { environment } from "@/configuration/environment/index";
import {
  disconnectResources,
  searchBrokerWorkerResources,
} from "@/workers/shared/resources";
import { bootstrapPollingWorker, startWorker } from "@/workers/shared/worker-runtime";

const workerName = "Search reconcile worker";
const workerResources = searchBrokerWorkerResources;

export async function bootstrapSearchReconcileWorker(): Promise<void> {
  await bootstrapPollingWorker({
    name: workerName,
    resources: workerResources,
    getPollIntervalMs: () => environment.getSearchReconcileWorkerConfig().pollIntervalMs,
    runOnce: async ({ scope }) => {
      const searchService = scope.resolve(containerTokens.searchService);
      const { batchSize } = environment.getSearchReconcileWorkerConfig();
      return searchService.processReconciliationBatch(batchSize);
    },
  });
}

startWorker({
  name: workerName,
  bootstrap: bootstrapSearchReconcileWorker,
  cleanup: () => disconnectResources(workerResources),
});
