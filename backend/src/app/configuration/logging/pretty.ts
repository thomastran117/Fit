import type { LogEvent, LogLevel } from "@/configuration/logging/types";

const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  brightRed: "\x1b[91m",
};

function getLevelColor(level: LogLevel): string {
  switch (level) {
    case "debug":
      return colors.blue;
    case "info":
      return colors.green;
    case "warn":
      return colors.yellow;
    case "error":
      return colors.red;
    case "critical":
      return colors.brightRed;
    default:
      return colors.magenta;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatPrettyLogEvent(event: LogEvent): string {
  const level = event.level.toUpperCase().padEnd(8, " ");
  const levelColor = getLevelColor(event.level);
  const source = `${event.layer}/${event.component}`;
  const segments = [
    `${colors.gray}${event.timestamp}${colors.reset}`,
    `${levelColor}${level}${colors.reset}`,
    `${colors.cyan}${source}${colors.reset}`,
    event.message,
  ];

  const metadataEntries: Array<[string, unknown]> = [
    ["service", event.service],
    ["env", event.environment],
    ["requestId", event.requestId],
    ["worker", event.workerName],
    ["queue", event.queue],
    ["correlationId", event.correlationId],
  ];

  for (const [key, value] of metadataEntries) {
    if (value === undefined) {
      continue;
    }

    segments.push(`${colors.gray}${key}=${formatValue(value)}${colors.reset}`);
  }

  for (const [key, value] of Object.entries(event.fields ?? {})) {
    segments.push(`${colors.gray}${key}=${formatValue(value)}${colors.reset}`);
  }

  if (event.error) {
    segments.push(
      `${colors.red}error=${event.error.name}: ${event.error.message}${colors.reset}`,
    );
  }

  const line = segments.join(" ");

  if (!event.error?.stack) {
    return line;
  }

  return `${line}\n${colors.gray}${event.error.stack}${colors.reset}`;
}
