import { createHmac, timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { AppBindings } from "@/configuration/http/bindings";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/configuration/http/errors";

const DEFAULT_MAX_AGE_SECONDS = 5 * 60;

function getRequiredHeader(value: string | undefined, message: string): string {
  if (!value) {
    throw new BadRequestError(message);
  }

  return value;
}

function parseTimestamp(rawTimestamp: string): number {
  const timestamp = Number(rawTimestamp);

  if (!Number.isFinite(timestamp)) {
    throw new BadRequestError("X-Client-Timestamp must be a valid unix timestamp.");
  }

  return timestamp > 1_000_000_000_000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
}

function createSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getSignatureSecret(): string {
  const secret = process.env.CLIENT_SIGNATURE_SECRET;

  if (!secret) {
    throw new UnauthorizedError("Client signature secret is not configured.");
  }

  return secret;
}

function getAllowedClockSkewSeconds(): number {
  const rawValue = process.env.CLIENT_SIGNATURE_MAX_AGE_SECONDS;

  if (!rawValue) {
    return DEFAULT_MAX_AGE_SECONDS;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error("CLIENT_SIGNATURE_MAX_AGE_SECONDS must be a positive number.");
  }

  return parsedValue;
}

export const clientSignatureMiddleware = createMiddleware<AppBindings>(async (context, next) => {
  const clientId = getRequiredHeader(
    context.req.header("x-client-id"),
    "X-Client-Id header is required.",
  );
  const rawTimestamp = getRequiredHeader(
    context.req.header("x-client-timestamp"),
    "X-Client-Timestamp header is required.",
  );
  const signature = getRequiredHeader(
    context.req.header("x-client-signature"),
    "X-Client-Signature header is required.",
  );

  const configuredClientId = process.env.CLIENT_ID;

  if (configuredClientId && configuredClientId !== clientId) {
    throw new ForbiddenError("Client identifier is not allowed.");
  }

  const timestamp = parseTimestamp(rawTimestamp);
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - timestamp) > getAllowedClockSkewSeconds()) {
    throw new UnauthorizedError("Client signature has expired.");
  }

  const payload = [clientId, context.req.method, new URL(context.req.url).pathname, timestamp].join(":");
  const expectedSignature = createSignature(payload, getSignatureSecret());

  if (!safeEquals(signature, expectedSignature)) {
    throw new UnauthorizedError("Client signature is invalid.");
  }

  context.set("clientSignature", {
    clientId,
    timestamp,
    signature,
    payload,
  });

  await next();
});
