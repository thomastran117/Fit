import { loadEnvironment } from "@/configuration/environment";
import {
  connectDatabase,
  disconnectDatabase,
} from "@/configuration/resources/database";
import { runSeedOrchestrator } from "@/seeds";

type SeedCliOptions = {
  onlyIfEmpty: boolean;
  refresh: boolean;
  showHelp: boolean;
};

function parseArgs(args: string[]): SeedCliOptions {
  return {
    onlyIfEmpty: args.includes("--only-if-empty"),
    refresh: args.includes("--refresh"),
    showHelp: args.includes("--help") || args.includes("-h"),
  };
}

function printHelp(): void {
  console.info(
    [
      "Usage: npm run seed -- [--refresh] [--only-if-empty]",
      "",
      "Options:",
      "  --refresh        Reapply fixture-owned data even when the database is already populated.",
      "  --only-if-empty  Skip the run unless the database has zero users.",
      "  --help           Show this help message.",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.showHelp) {
    printHelp();
    return;
  }

  loadEnvironment();
  await connectDatabase();

  try {
    await runSeedOrchestrator({
      onlyIfEmpty: options.onlyIfEmpty,
      refresh: options.refresh,
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
