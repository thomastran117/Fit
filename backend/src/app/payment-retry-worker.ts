import { containerTokens, initializeContainer } from "@/configuration/bootstrap/container";
import { environment, loadEnvironment } from "@/configuration/environment/index";
import { connectDatabase, disconnectDatabase } from "@/configuration/resources/database";

async function bootstrap(): Promise<void> {
  loadEnvironment();
  await connectDatabase();
  const container = initializeContainer();
  const { pollIntervalMs, batchSize } = environment.getPaymentsRetryWorkerConfig();

  console.log("Payment retry worker started.");

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down payment retry worker...`);
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
      const service = scope.resolve(containerTokens.paymentsService);
      const processed = await service.processRetryQueue(batchSize);

      if (processed === 0) {
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      console.error("Payment retry worker loop failed", error);
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
  console.error("Failed to start payment retry worker", error);
  await disconnectDatabase();
  process.exit(1);
});
