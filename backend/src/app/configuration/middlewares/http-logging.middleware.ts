import { createMiddleware } from "hono/factory";
import type { AppBindings } from "@/configuration/http/bindings";

const REDACTED_QUERY_VALUE = "[REDACTED]";
const SENSITIVE_EXACT_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "assertion",
  "auth_code",
  "authorization",
  "authorization_code",
  "client_secret",
  "code",
  "code_verifier",
  "id_token",
  "jwt",
  "nonce",
  "otp",
  "password",
  "passcode",
  "private_key",
  "public_key",
  "refresh_token",
  "saml_request",
  "saml_response",
  "session",
  "session_id",
  "sig",
  "signature",
  "state",
  "token",
]);
const SENSITIVE_QUERY_KEY_PATTERN = /(token|secret|password|passwd|signature|assertion|nonce|otp|jwt|saml)/i;

function normalizeQueryKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function isSensitiveQueryKey(key: string): boolean {
  const normalized = normalizeQueryKey(key);

  return SENSITIVE_EXACT_QUERY_KEYS.has(normalized) || SENSITIVE_QUERY_KEY_PATTERN.test(normalized);
}

function getSanitizedPathWithQuery(request: Request): string {
  const url = new URL(request.url);

  for (const key of new Set(url.searchParams.keys())) {
    if (!isSensitiveQueryKey(key)) {
      continue;
    }

    url.searchParams.delete(key);
    url.searchParams.append(key, REDACTED_QUERY_VALUE);
  }

  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
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
    const requestId = context.get("requestId");

    const method = context.req.method;
    const path = getSanitizedPathWithQuery(context.req.raw);
    const status = context.res.status;

    const requestLogger = context.get("logger");
    const logMethod =
      status >= 500
        ? requestLogger.error.bind(requestLogger)
        : status >= 400
          ? requestLogger.warn.bind(requestLogger)
          : requestLogger.info.bind(requestLogger);

    logMethod("HTTP request completed.", {
      durationMs,
      format: outputFormat,
      ip: client?.ip ?? "unknown",
      latencyColor: getLatencyColor(durationMs),
      method,
      methodColor: getMethodColor(method),
      path,
      requestId: requestId ?? "unknown",
      status,
      statusColor: getStatusColor(status),
    });
  }
});
