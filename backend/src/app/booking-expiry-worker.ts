import { containerTokens, initializeContainer } from "@/configuration/bootstrap/container";
import { environment, loadEnvironment } from "@/configuration/environment/index";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";

async function bootstrap(): Promise<void> {
  loadEnvironment();
  await connectDatabase();
  const container = initializeContainer();

  const { pollIntervalMs, batchSize } = environment.getBookingExpiryWorkerConfig();

  console.log("Booking request expiry worker started.");

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down booking request expiry worker...`);
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
      const repository = scope.resolve(containerTokens.bookingsRepository);
      const postingsRepository = scope.resolve(containerTokens.postingsRepository);
      const jobs = await repository.listExpiredCandidates(batchSize);

      if (jobs.length === 0) {
        await sleep(pollIntervalMs);
        continue;
      }

      for (const job of jobs) {
        try {
          const expired = await repository.expire(job.id);

          if (expired) {
            await postingsRepository.enqueueSearchSync(job.postingId);
          }
        } catch (error) {
          console.error("Failed to expire booking request hold", {
            bookingRequestId: job.id,
            postingId: job.postingId,
            status: job.status,
            error,
          });
        }
      }
    } catch (error) {
      console.error("Booking request expiry worker loop failed", error);
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

void bootstrap().catch(async (error: unknown) => {
  console.error("Failed to start booking request expiry worker", error);
  await disconnectDatabase();
  process.exit(1);
});
