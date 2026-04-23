import { PrismaClient } from "@prisma/client";
import { environment } from "@/configuration/environment/index";

let database: PrismaClient | null = null;

function createDatabaseClient(): PrismaClient {
  const config = environment.getDatabaseConfig();
  const client = new PrismaClient({
    log: [
      {
        emit: "event",
        level: "query",
      },
    ],
  });

  client.$on("query", (event) => {
    const shouldLogQuery = config.queryLoggingEnabled;
    const shouldLogSlowQuery =
      config.slowQueryThresholdMs > 0 && event.duration >= config.slowQueryThresholdMs;

    if (!shouldLogQuery && !shouldLogSlowQuery) {
      return;
    }

    const logger = shouldLogSlowQuery ? console.warn : console.info;

    logger(
      [
        shouldLogSlowQuery ? "[DATABASE SLOW QUERY]" : "[DATABASE QUERY]",
        `${event.duration}ms`,
        `target=${event.target}`,
        `query=${event.query}`,
      ].join(" "),
    );
  });

  return client;
}

export let databaseClient: PrismaClient | null = null;

export async function connectDatabase(): Promise<PrismaClient> {
  const startedAt = performance.now();

  if (!database) {
    database = createDatabaseClient();
    databaseClient = database;
  }

  await database.$connect();
  console.info(`[DATABASE CONNECT] durationMs=${measureDurationMs(startedAt)}`);
  return database;
}

export function getDatabaseClient(): PrismaClient {
  if (!database) {
    throw new Error("Database has not been initialized. Call connectDatabase() first.");
  }

  return database;
}

export async function disconnectDatabase(): Promise<void> {
  if (!database) {
    return;
  }

  const startedAt = performance.now();
  await database.$disconnect();
  database = null;
  databaseClient = null;
  console.info(`[DATABASE DISCONNECT] durationMs=${measureDurationMs(startedAt)}`);
}

export async function pingDatabase(): Promise<{
  durationMs: number;
  ok: boolean;
}> {
  const client = getDatabaseClient();
  const startedAt = performance.now();

  await client.$queryRaw`SELECT 1`;

  return {
    durationMs: measureDurationMs(startedAt),
    ok: true,
  };
}

function measureDurationMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
