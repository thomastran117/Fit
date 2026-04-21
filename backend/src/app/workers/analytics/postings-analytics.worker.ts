import { containerTokens } from "@/configuration/bootstrap/container";
import { environment } from "@/configuration/environment/index";
import type {
  ProcessBookingRequestedEventInput,
  ProcessRentingConfirmedEventInput,
  ProcessPostingViewedEventInput,
} from "@/features/postings/postings.analytics.model";
import { databaseWorkerResource, disconnectResources } from "@/workers/shared/resources";
import { bootstrapPollingWorker, startWorker } from "@/workers/shared/worker-runtime";

const workerName = "Postings analytics worker";
const workerResources = [databaseWorkerResource];

export async function bootstrapPostingsAnalyticsWorker(): Promise<void> {
  await bootstrapPollingWorker({
    name: workerName,
    resources: workerResources,
    getPollIntervalMs: () => environment.getAnalyticsWorkerConfig().pollIntervalMs,
    runOnce: async ({ scope }) => {
      const repository = scope.resolve(containerTokens.postingsAnalyticsRepository);
      const { batchSize } = environment.getAnalyticsWorkerConfig();
      const jobs = await repository.claimOutboxBatch(batchSize);

      for (const job of jobs) {
        try {
          if (job.eventType === "posting_viewed") {
            const payload = job.payload as Record<string, unknown>;
            const occurredAt = readString(payload.occurredAt, "occurredAt");
            const input: ProcessPostingViewedEventInput = {
              postingId: job.postingId,
              ownerId: job.ownerId,
              occurredAt,
              eventDate: floorToUtcDay(occurredAt),
              eventHour: floorToUtcHour(occurredAt),
              viewerHash: readString(payload.viewerHash, "viewerHash"),
              userId: readOptionalString(payload.userId),
              ipAddressHash: readOptionalString(payload.ipAddressHash),
              userAgentHash: readOptionalString(payload.userAgentHash),
              deviceType: readString(payload.deviceType, "deviceType"),
            };

            await repository.processPostingViewedEvent(input);
          }

          if (job.eventType === "booking_requested") {
            const payload = job.payload as Record<string, unknown>;
            const occurredAt = readString(payload.occurredAt, "occurredAt");
            const input: ProcessBookingRequestedEventInput = {
              postingId: job.postingId,
              ownerId: job.ownerId,
              occurredAt,
              eventDate: floorToUtcDay(occurredAt),
              eventHour: floorToUtcHour(occurredAt),
              estimatedTotal: readOptionalNumber(payload.estimatedTotal) ?? 0,
            };

            await repository.processBookingRequestedEvent(input);
          }

          if (job.eventType === "booking_accepted") {
            const payload = job.payload as Record<string, unknown>;
            const occurredAt = readString(payload.occurredAt, "occurredAt");
            const input: ProcessRentingConfirmedEventInput = {
              postingId: job.postingId,
              ownerId: job.ownerId,
              occurredAt,
              eventDate: floorToUtcDay(occurredAt),
              eventHour: floorToUtcHour(occurredAt),
              estimatedTotal: readOptionalNumber(payload.estimatedTotal) ?? 0,
            };

            await repository.processRentingConfirmedEvent(input);
          }

          await repository.markOutboxProcessed(job.id);
        } catch (error) {
          console.error("Failed to process postings analytics outbox job", {
            jobId: job.id,
            postingId: job.postingId,
            eventType: job.eventType,
            error,
          });
          await repository.markOutboxRetry(
            job.id,
            job.attempts + 1,
            error instanceof Error ? error.message : "Unknown analytics error.",
          );
        }
      }

      return jobs.length;
    },
  });
}

function floorToUtcDay(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function floorToUtcHour(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Analytics payload field ${fieldName} is required.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

startWorker({
  name: workerName,
  bootstrap: bootstrapPostingsAnalyticsWorker,
  cleanup: () => disconnectResources(workerResources),
});
