import { serve } from "@hono/node-server";
import { createApplication } from "@/configuration/bootstrap/application";
import { initializeContainer } from "@/configuration/bootstrap/container";
import { environment, loadEnvironment } from "@/configuration/environment/index";
import {
  connectElasticsearch,
  disconnectElasticsearch,
} from "@/configuration/resources/elasticsearch";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";
import {
  connectRedis,
  disconnectRedis,
} from "@/configuration/resources/redis";

async function bootstrap(): Promise<void> {
  loadEnvironment();

  const port = environment.getServerPort();

  await connectDatabase();
  await connectRedis();
  await connectElasticsearch();
  initializeContainer();
  const app = createApplication();

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
    await Promise.allSettled([
      disconnectRedis(),
      disconnectDatabase(),
      disconnectElasticsearch(),
    ]);
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
  await Promise.allSettled([
    disconnectRedis(),
    disconnectDatabase(),
    disconnectElasticsearch(),
  ]);
  process.exit(1);
});
