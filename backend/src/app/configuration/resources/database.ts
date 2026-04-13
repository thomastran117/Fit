import { PrismaClient } from "@prisma/client";

let database: PrismaClient | null = null;

function createDatabaseClient(): PrismaClient {
  return new PrismaClient();
}

export let databaseClient: PrismaClient | null = null;

export async function connectDatabase(): Promise<PrismaClient> {
  if (!database) {
    database = createDatabaseClient();
    databaseClient = database;
  }

  await database.$connect();
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

  await database.$disconnect();
}
