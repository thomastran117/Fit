import { serve } from "@hono/node-server";
import {
  disconnectApplicationResources,
  initializeServerApplication,
} from "@/configuration/bootstrap/startup";

async function bootstrap(): Promise<void> {
  const { app, port } = await initializeServerApplication();

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    () => {
      console.log(`Server listening on http://localhost:${port}`);
    },
  );

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);

    server.close();
    await disconnectApplicationResources();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void bootstrap().catch(async (error: unknown) => {
  console.error("Failed to start server", error);
  await disconnectApplicationResources();
  process.exit(1);
});
