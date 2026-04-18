import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { AppBindings } from "@/configuration/http/bindings";
import { containerTokens, getRequestContainer } from "@/configuration/bootstrap/container";
import { environment } from "@/configuration/environment";
import TooManyRequestError from "@/errors/http/too-many-request.error";

type RateLimiterStrategy = "sliding-window" | "token-bucket";

interface SlidingWindowResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface TokenBucketResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local window_start = now - window_ms

redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

local current = redis.call('ZCARD', key)
if current >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_ms = window_ms

  if oldest[2] then
    retry_ms = math.max(1, math.floor((tonumber(oldest[2]) + window_ms - now)))
  end

  return {0, 0, math.ceil(retry_ms / 1000)}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window_ms)

local remaining = limit - current - 1
return {1, remaining, 0}
`;

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])
local ttl_ms = tonumber(ARGV[4])

local values = redis.call('HMGET', key, 'tokens', 'last_refill_ms')
local tokens = tonumber(values[1])
local last_refill_ms = tonumber(values[2])

if tokens == nil then
  tokens = capacity
  last_refill_ms = now
end

local elapsed_ms = math.max(0, now - last_refill_ms)
local refill = (elapsed_ms / 1000) * refill_rate
tokens = math.min(capacity, tokens + refill)

if tokens < 1 then
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill_ms', now)
  redis.call('PEXPIRE', key, ttl_ms)

  local retry_ms = math.ceil(((1 - tokens) / refill_rate) * 1000)
  return {0, math.floor(tokens), math.ceil(math.max(1, retry_ms) / 1000)}
end

tokens = tokens - 1
redis.call('HMSET', key, 'tokens', tokens, 'last_refill_ms', now)
redis.call('PEXPIRE', key, ttl_ms)

return {1, math.floor(tokens), 0}
`;

function readStrategy(): RateLimiterStrategy {
  return environment.getRateLimiterConfig().strategy;
}

function isEnabled(): boolean {
  return environment.getRateLimiterConfig().enabled;
}

function getLimit(): number {
  return environment.getRateLimiterConfig().limit;
}

function getWindowSeconds(): number {
  return environment.getRateLimiterConfig().windowSeconds;
}

function getTokenBucketCapacity(): number {
  return environment.getRateLimiterConfig().bucketCapacity;
}

function getTokenBucketRefillRate(): number {
  return environment.getRateLimiterConfig().refillTokensPerSecond;
}

function buildRateLimitKey(request: Request, ipAddress: string): string {
  const url = new URL(request.url);
  return `rate-limit:${request.method}:${url.pathname}:${ipAddress}`;
}

function getClientIp(context: Parameters<typeof rateLimiterMiddleware>[0]): string {
  return context.get("client").ip ?? "unknown";
}

async function evaluateSlidingWindow(
  context: Parameters<typeof rateLimiterMiddleware>[0],
  key: string,
): Promise<SlidingWindowResult> {
  const now = Date.now();
  const windowMs = getWindowSeconds() * 1000;
  const limit = getLimit();
  const member = `${now}:${randomUUID()}`;

  const result = await getRequestContainer(context)
    .resolve(containerTokens.cacheService)
    .eval<[number, number, number]>(
      SLIDING_WINDOW_SCRIPT,
      [key],
      [String(now), String(windowMs), String(limit), member],
    );

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    retryAfterSeconds: result[2],
  };
}

async function evaluateTokenBucket(
  context: Parameters<typeof rateLimiterMiddleware>[0],
  key: string,
): Promise<TokenBucketResult> {
  const now = Date.now();
  const capacity = getTokenBucketCapacity();
  const refillRate = getTokenBucketRefillRate();
  const ttlMs = Math.max(Math.ceil((capacity / refillRate) * 1000 * 2), 1000);

  const result = await getRequestContainer(context)
    .resolve(containerTokens.cacheService)
    .eval<[number, number, number]>(
      TOKEN_BUCKET_SCRIPT,
      [key],
      [String(now), String(capacity), String(refillRate), String(ttlMs)],
    );

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    retryAfterSeconds: result[2],
  };
}

export const rateLimiterMiddleware = createMiddleware<AppBindings>(async (context, next) => {
  if (!isEnabled()) {
    await next();
    return;
  }

  const key = buildRateLimitKey(context.req.raw, getClientIp(context));
  const strategy = readStrategy();
  const evaluation =
    strategy === "sliding-window"
      ? await evaluateSlidingWindow(context, key)
      : await evaluateTokenBucket(context, key);

  context.header("x-ratelimit-limit", String(getLimit()));
  context.header("x-ratelimit-remaining", String(Math.max(0, evaluation.remaining)));
  context.header("x-ratelimit-strategy", strategy);

  if (!evaluation.allowed) {
    context.header("retry-after", String(Math.max(1, evaluation.retryAfterSeconds)));
    throw new TooManyRequestError("Too many requests. Please try again later.", {
      strategy,
      retryAfterSeconds: Math.max(1, evaluation.retryAfterSeconds),
    });
  }

  await next();
});
