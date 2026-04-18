import { createClient } from "redis";
import { environment } from "@/configuration/environment";

type RedisClient = ReturnType<typeof createClient>;

function buildRedisUrl(): string {
  const config = environment.getRedisConfig();

  if (config.url) {
    return config.url;
  }

  const { host, port, password } = config;

  if (password) {
    return `redis://:${password}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
}

let redis: RedisClient | null = null;

function createRedisClient(): RedisClient {
  const config = environment.getRedisConfig();

  const client = createClient({
    url: buildRedisUrl(),
    database: config.db,
    socket: {
      connectTimeout: config.connectTimeoutMs,
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
