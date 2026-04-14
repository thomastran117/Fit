import { createMiddleware } from "hono/factory";
import type { AppBindings } from "@/configuration/http/bindings";
import { getOptionalEnvironmentVariable } from "@/configuration/environment";
import ForbiddenError from "@/errors/http/forbidden.error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readAllowedOrigins(): string[] {
  const configuredOrigins =
    getOptionalEnvironmentVariable("CSRF_ALLOWED_ORIGINS") ??
    getOptionalEnvironmentVariable("CORS_ALLOWED_ORIGINS") ??
    getOptionalEnvironmentVariable("FRONTEND_URL") ??
    "http://localhost:3040";

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function readRequestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer = request.headers.get("referer");

  if (referer) {
    return normalizeOrigin(referer);
  }

  return null;
}

function isBrowserRequest(request: Request): boolean {
  return (
    request.headers.has("origin") ||
    request.headers.has("referer") ||
    request.headers.has("sec-fetch-site")
  );
}

export const csrfMiddleware = createMiddleware<AppBindings>(async (context, next) => {
  const request = context.req.raw;

  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    await next();
    return;
  }

  const path = new URL(request.url).pathname;

  if (path.startsWith("/auth/oauth/")) {
    await next();
    return;
  }

  if (!isBrowserRequest(request)) {
    await next();
    return;
  }

  const requestOrigin = readRequestOrigin(request);
  const allowedOrigins = readAllowedOrigins()
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    throw new ForbiddenError("CSRF validation failed.");
  }

  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    throw new ForbiddenError("CSRF validation failed.");
  }

  await next();
});
