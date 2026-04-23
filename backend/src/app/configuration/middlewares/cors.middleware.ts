import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { getOptionalEnvironmentVariable } from "@/configuration/environment";

function readAllowedOrigins(): string[] {
  const configuredOrigins =
    getOptionalEnvironmentVariable("CORS_ALLOWED_ORIGINS") ??
    getOptionalEnvironmentVariable("FRONTEND_URL") ??
    "http://localhost:3040";

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin);
}

export function createCorsMiddleware(): MiddlewareHandler<AppBindings> {
  const allowedOrigins = readAllowedOrigins();

  return cors({
    origin: (origin) => {
      if (!origin) {
        return "";
      }

      return isOriginAllowed(origin, allowedOrigins) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "authorization",
      "content-type",
      "x-device-id",
      "x-device-platform",
      "x-request-id",
      "x-csrf-token",
    ],
    exposeHeaders: [
      "content-type",
      "retry-after",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-strategy",
    ],
    credentials: true,
    maxAge: 24 * 60 * 60,
  });
}

export const corsMiddleware = createCorsMiddleware();
