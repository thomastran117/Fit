import { initializeContainer } from "@/configuration/bootstrap/container";
import { loadEnvironment } from "@/configuration/environment/index";
import {
  connectElasticsearch,
  disconnectElasticsearch,
} from "@/configuration/resources/elasticsearch";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";
import { RentingsRepository } from "@/features/rentings/rentings.repository";
import { RentingsSearchService } from "@/features/rentings/rentings.search.service";

function readNumber(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsedValue;
}

async function bootstrap(): Promise<void> {
  loadEnvironment();
  await connectDatabase();
  await connectElasticsearch();
  initializeContainer();

  const repository = new RentingsRepository();
  const searchService = new RentingsSearchService(repository);
  const pollIntervalMs = readNumber("RENTINGS_SEARCH_OUTBOX_POLL_INTERVAL_MS", 2_000);
  const batchSize = readNumber("RENTINGS_SEARCH_OUTBOX_BATCH_SIZE", 25);

  console.log("Rentings search worker started.");

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down rentings search worker...`);
    await Promise.allSettled([disconnectDatabase(), disconnectElasticsearch()]);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  while (!isShuttingDown) {
    try {
      if (!searchService.isElasticsearchEnabled()) {
        await sleep(pollIntervalMs);
        continue;
      }

      const jobs = await repository.claimSearchOutboxBatch(batchSize);

      if (jobs.length === 0) {
        await sleep(pollIntervalMs);
        continue;
      }

      for (const job of jobs) {
        try {
          if (job.operation === "delete") {
            await searchService.deleteDocument(job.rentingId);
          } else {
            const documents = await repository.findByIdsForIndexing([job.rentingId]);
            const document = documents[0];

            if (!document || document.status !== "published") {
              await searchService.deleteDocument(job.rentingId);
            } else {
              await searchService.upsertDocument(document);
            }
          }

          await repository.markSearchOutboxProcessed(job.id);
        } catch (error) {
          console.error("Failed to process rentings search outbox job", {
            jobId: job.id,
            rentingId: job.rentingId,
            error,
          });
          await repository.markSearchOutboxRetry(
            job.id,
            job.attempts + 1,
            error instanceof Error ? error.message : "Unknown indexing error.",
          );
        }
      }
    } catch (error) {
      console.error("Rentings search worker loop failed", error);
      await sleep(pollIntervalMs);
    }
  }
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

void bootstrap().catch(async (error: unknown) => {
  console.error("Failed to start rentings search worker", error);
  await Promise.allSettled([disconnectDatabase(), disconnectElasticsearch()]);
  process.exit(1);
});
