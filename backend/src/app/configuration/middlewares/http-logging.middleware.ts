import { createMiddleware } from "hono/factory";
import type { AppBindings } from "@/configuration/http/bindings";

function getPathWithQuery(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function getStatusColor(status: number) {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  return colors.green;
}

function getMethodColor(method: string) {
  switch (method) {
    case "GET":
      return colors.green;
    case "POST":
      return colors.yellow;
    case "PUT":
    case "PATCH":
      return colors.cyan;
    case "DELETE":
      return colors.red;
    default:
      return colors.magenta;
  }
}

function getLatencyColor(ms: number) {
  if (ms > 1000) return colors.red;
  if (ms > 300) return colors.yellow;
  return colors.green;
}

export const httpLoggingMiddleware = createMiddleware<AppBindings>(async (context, next) => {
  const startedAt = performance.now();

  try {
    await next();
  } finally {
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;

    const client = context.get("client");
    const outputFormat = context.get("outputFormat");

    const method = context.req.method;
    const path = getPathWithQuery(context.req.raw);
    const status = context.res.status;

    const methodColor = getMethodColor(method);
    const statusColor = getStatusColor(status);
    const latencyColor = getLatencyColor(durationMs);

    console.info(
      [
        `${colors.gray}[HTTP]${colors.reset}`,
        `${methodColor}${method}${colors.reset}`,
        `${path}`,
        `${statusColor}${status}${colors.reset}`,
        `${latencyColor}${durationMs}ms${colors.reset}`,
        `${colors.gray}ip=${client?.ip ?? "unknown"}${colors.reset}`,
        `${colors.gray}format=${outputFormat}${colors.reset}`,
      ].join(" "),
    );
  }
});
