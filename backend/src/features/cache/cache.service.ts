import { getRedisClient, type redisClient } from "@/configuration/resources/redis.js";

type RedisClient = typeof redisClient;

export class CacheService {
  private readonly client: RedisClient;

  constructor(client: RedisClient = getRedisClient()) {
    this.client = client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async set(key: string, value: string, ttlInSeconds?: number): Promise<void> {
    if (ttlInSeconds === undefined) {
      await this.client.set(key, value);
      return;
    }

    await this.client.set(key, value, {
      EX: ttlInSeconds,
    });
  }

  async setJson(key: string, value: unknown, ttlInSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlInSeconds);
  }

  async delete(key: string): Promise<boolean> {
    const deletedCount = await this.client.del(key);
    return deletedCount > 0;
  }

  async exists(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async expire(key: string, ttlInSeconds: number): Promise<boolean> {
    const wasUpdated = await this.client.expire(key, ttlInSeconds);
    return wasUpdated === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}

export const cacheService = new CacheService();
