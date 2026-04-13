import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsedValue;
}

function buildRedisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST ?? "127.0.0.1";
  const port = readNumber("REDIS_PORT", 6379);
  const password = process.env.REDIS_PASSWORD;

  if (password) {
    return `redis://:${password}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
}

let redis: RedisClient | null = null;

function createRedisClient(): RedisClient {
  const client = createClient({
    url: buildRedisUrl(),
    database: readNumber("REDIS_DB", 0),
    socket: {
      connectTimeout: readNumber("REDIS_CONNECT_TIMEOUT_MS", 10_000),
    },
  });

  client.on("error", (error: unknown) => {
    console.error("Redis client error", error);
  });

  return client;
}

export let redisClient: RedisClient | null = null;

export async function connectRedis(): Promise<RedisClient> {
  if (!redis) {
    redis = createRedisClient();
    redisClient = redis;
  }

  if (redis.isOpen) {
    return redis;
  }

  await redis.connect();
  return redis;
}

export function getRedisClient(): RedisClient {
  if (!redis || !redis.isOpen) {
    throw new Error("Redis has not been initialized. Call connectRedis() first.");
  }

  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (!redis || !redis.isOpen) {
    return;
  }

  await redis.quit();
}
