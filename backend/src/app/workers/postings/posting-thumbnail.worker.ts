import { containerTokens } from "@/configuration/bootstrap/container";
import { environment } from "@/configuration/environment/index";
import { databaseWorkerResource, disconnectResources } from "@/workers/shared/resources";
import { bootstrapPollingWorker, startWorker } from "@/workers/shared/worker-runtime";

const workerName = "Posting thumbnail worker";
const workerResources = [databaseWorkerResource];

export async function bootstrapPostingThumbnailWorker(): Promise<void> {
  await bootstrapPollingWorker({
    name: workerName,
    resources: workerResources,
    getPollIntervalMs: () => environment.getPostingsThumbnailWorkerConfig().pollIntervalMs,
    runOnce: async ({ scope }) => {
      const repository = scope.resolve(containerTokens.postingsRepository);
      const thumbnailService = scope.resolve(containerTokens.postingThumbnailService);
      const { batchSize, maxAttempts } = environment.getPostingsThumbnailWorkerConfig();
      const jobs = await repository.claimThumbnailOutboxBatch(batchSize);

      for (const job of jobs) {
        await thumbnailService.processJob(job, maxAttempts);
      }

      return jobs.length;
    },
  });
}

startWorker({
  name: workerName,
  bootstrap: bootstrapPostingThumbnailWorker,
  cleanup: () => disconnectResources(workerResources),
});
