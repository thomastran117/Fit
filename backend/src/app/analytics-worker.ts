import { containerTokens, initializeContainer } from "@/configuration/bootstrap/container";
import { environment, loadEnvironment } from "@/configuration/environment/index";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";
import type {
  ProcessBookingRequestedEventInput,
  ProcessRentingConfirmedEventInput,
  ProcessPostingViewedEventInput,
} from "@/features/postings/postings.analytics.model";

async function bootstrap(): Promise<void> {
  loadEnvironment();
  await connectDatabase();
  const container = initializeContainer();

  const { pollIntervalMs, batchSize } = environment.getAnalyticsWorkerConfig();

  console.log("Postings analytics worker started.");

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down postings analytics worker...`);
    await disconnectDatabase();
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
      const repository = scope.resolve(containerTokens.postingsAnalyticsRepository);
      const jobs = await repository.claimOutboxBatch(batchSize);

      if (jobs.length === 0) {
        await sleep(pollIntervalMs);
        continue;
      }

      for (const job of jobs) {
        try {
          if (job.eventType === "posting_viewed") {
            const payload = job.payload as Record<string, unknown>;
            const occurredAt = readString(payload.occurredAt, "occurredAt");
            const eventDate = floorToUtcDay(occurredAt);
            const eventHour = floorToUtcHour(occurredAt);

            const input: ProcessPostingViewedEventInput = {
              postingId: job.postingId,
              ownerId: job.ownerId,
              occurredAt,
              eventDate,
              eventHour,
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
    } catch (error) {
      console.error("Postings analytics worker loop failed", error);
      await sleep(pollIntervalMs);
    } finally {
      await scope.dispose();
    }
  }
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

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

void bootstrap().catch(async (error: unknown) => {
  console.error("Failed to start postings analytics worker", error);
  await disconnectDatabase();
  process.exit(1);
});

