import { DataSource } from "typeorm";

const DEFAULT_ENTITY_GLOBS = ["src/**/*.entity.ts", "dist/**/*.entity.js"];
const DEFAULT_MIGRATION_GLOBS = [
  "src/configuration/migrations/*.{ts,js}",
  "dist/configuration/migrations/*.{ts,js}",
];

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsedValue;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return value === "true";
}

let database: DataSource | null = null;

function createDatabaseClient(): DataSource {
  return new DataSource({
    type: "mysql",
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? "localhost",
    port: readNumber("DB_PORT", 3306),
    username: process.env.DB_USERNAME ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "fit",
    entities: process.env.DB_ENTITIES?.split(",") ?? DEFAULT_ENTITY_GLOBS,
    migrations: process.env.DB_MIGRATIONS?.split(",") ?? DEFAULT_MIGRATION_GLOBS,
    synchronize: readBoolean("DB_SYNCHRONIZE", false),
    logging: readBoolean("DB_LOGGING", false),
    charset: process.env.DB_CHARSET ?? "utf8mb4_unicode_ci",
  });
}

export let databaseClient: DataSource | null = null;

export async function connectDatabase(): Promise<DataSource> {
  if (!database) {
    database = createDatabaseClient();
    databaseClient = database;
  }

  if (database.isInitialized) {
    return database;
  }

  return database.initialize();
}

export function getDatabaseClient(): DataSource {
  if (!database || !database.isInitialized) {
    throw new Error("Database has not been initialized. Call connectDatabase() first.");
  }

  return database;
}

export async function disconnectDatabase(): Promise<void> {
  if (!database || !database.isInitialized) {
    return;
  }

  await database.destroy();
}
