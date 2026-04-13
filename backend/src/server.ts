import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  connectDatabase,
  disconnectDatabase,
} from "./configuration/resources/database.js";
import {
  connectRedis,
  disconnectRedis,
} from "./configuration/resources/redis.js";

const app = new Hono();
const port = Number(process.env.PORT ?? 3000);

app.get("/", (context) => {
  return context.json({
    message: "TypeScript Hono server is running",
  });
});

app.get("/health", (context) => {
  return context.json({
    ok: true,
    uptime: process.uptime(),
  });
});

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();

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
    await Promise.allSettled([disconnectRedis(), disconnectDatabase()]);
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
  await Promise.allSettled([disconnectRedis(), disconnectDatabase()]);
  process.exit(1);
});
