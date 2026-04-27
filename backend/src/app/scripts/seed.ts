import { loadEnvironment } from "@/configuration/environment";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";
import { runSeedOrchestrator } from "@/seeds/orchestrator";

function shouldRefreshFromArgs(args: string[]): boolean {
  return args.includes("--refresh");
}

async function main(): Promise<void> {
  loadEnvironment();
  await connectDatabase();

  try {
    await runSeedOrchestrator({
      refresh: shouldRefreshFromArgs(process.argv.slice(2)),
      source: "script",
    });
  } finally {
    await disconnectDatabase();
  }
}

void main().catch(async (error: unknown) => {
  console.error("Failed to run seed orchestrator.", error);
  await disconnectDatabase();
  process.exit(1);
});
