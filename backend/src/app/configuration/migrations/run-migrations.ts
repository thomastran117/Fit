import { loadEnvironment } from "../environment/index";
import { connectDatabase, disconnectDatabase } from "../resources/database";

async function run(): Promise<void> {
  loadEnvironment();

  const database = await connectDatabase();
  const migrations = await database.runMigrations();

  if (migrations.length === 0) {
    console.log("No pending migrations were found.");
    return;
  }

  for (const migration of migrations) {
    console.log(`Applied migration: ${migration.name}`);
  }
}

void run()
  .catch((error: unknown) => {
    console.error("Failed to run migrations.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
