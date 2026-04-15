import { loadEnvironment } from "@/configuration/environment/index";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";
import { BookingsRepository } from "@/features/bookings/bookings.repository";

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

  const repository = new BookingsRepository();
  const pollIntervalMs = readNumber("BOOKING_REQUEST_EXPIRY_POLL_INTERVAL_MS", 5_000);
  const batchSize = readNumber("BOOKING_REQUEST_EXPIRY_BATCH_SIZE", 50);

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
    try {
      const jobs = await repository.listExpiredCandidates(batchSize);

      if (jobs.length === 0) {
        await sleep(pollIntervalMs);
        continue;
      }

      for (const job of jobs) {
        try {
          await repository.expire(job.id);
        } catch (error) {
          console.error("Failed to expire booking request hold", {
            bookingRequestId: job.id,
            status: job.status,
            error,
          });
        }
      }
    } catch (error) {
      console.error("Booking request expiry worker loop failed", error);
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
  console.error("Failed to start booking request expiry worker", error);
  await disconnectDatabase();
  process.exit(1);
});
