import { environment } from "@/configuration/environment/index";
import type { CacheService } from "@/features/cache/cache.service";
import type {
  BatchPostingsResult,
  PublicPostingRecord,
} from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";

export interface PostingsPublicCacheConfig {
  freshTtlSeconds: number;
  staleTtlSeconds: number;
  rebuildLockTtlMs: number;
  followerWaitTimeoutMs: number;
  followerPollIntervalMs: number;
  negativeTtlSeconds: number;
}

interface PublicPostingCacheEnvelope {
  kind: "hit" | "miss";
  posting?: PublicPostingRecord;
  freshUntil: string;
  staleUntil: string;
  cachedAt: string;
}

export class PostingsPublicCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly postingsRepository: PostingsRepository,
    private readonly config?: PostingsPublicCacheConfig,
  ) {}

  async getPublicById(postingId: string): Promise<PublicPostingRecord | null> {
    const normalizedPostingId = postingId.trim();

    if (!normalizedPostingId) {
      return null;
    }

    return this.readPublicPosting(normalizedPostingId);
  }

  async getPublicByIds(ids: string[]): Promise<BatchPostingsResult<PublicPostingRecord>> {
    const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    const byId = new Map<string, PublicPostingRecord>();

    await Promise.all(
      normalizedIds.map(async (id) => {
        const posting = await this.getPublicById(id);

        if (posting) {
          byId.set(id, posting);
        }
      }),
    );

    const postings: PublicPostingRecord[] = [];
    const missingIds: string[] = [];

    for (const id of ids) {
      const normalizedId = id.trim();

      if (!normalizedId) {
        missingIds.push(id);
        continue;
      }

      const posting = byId.get(normalizedId);

      if (!posting) {
        missingIds.push(normalizedId);
        continue;
      }

      postings.push(posting);
    }

    return {
      postings,
      missingIds,
    };
  }

  async invalidatePublic(postingId: string): Promise<number> {
    return this.cacheService.increment(this.getGenerationKey(postingId));
  }

  private async readPublicPosting(postingId: string): Promise<PublicPostingRecord | null> {
    const generation = await this.readGeneration(postingId);
    const entry = await this.readEntry(postingId, generation);
    const now = Date.now();

    if (entry) {
      if (Date.parse(entry.freshUntil) > now) {
        return this.toPublicPosting(entry);
      }

      if (Date.parse(entry.staleUntil) > now) {
        this.refreshInBackground(postingId);
        return this.toPublicPosting(entry);
      }
    }

    return this.rebuildWithSingleFlight(postingId);
  }

  private refreshInBackground(postingId: string): void {
    void this.refreshIfLeader(postingId).catch((error) => {
      console.warn("Failed to refresh stale public posting cache entry", {
        postingId,
        error,
      });
    });
  }

  private async refreshIfLeader(postingId: string): Promise<void> {
    const config = this.getConfig();
    const lock = await this.cacheService.acquireLock(
      this.getRebuildLockKey(postingId),
      config.rebuildLockTtlMs,
    );

    if (!lock) {
      return;
    }

    try {
      const generation = await this.readGeneration(postingId);
      const entry = await this.readEntry(postingId, generation);

      if (entry && Date.parse(entry.freshUntil) > Date.now()) {
        return;
      }

      await this.fetchAndCachePosting(postingId, generation);
    } finally {
      await lock.release();
    }
  }

  private async rebuildWithSingleFlight(postingId: string): Promise<PublicPostingRecord | null> {
    const config = this.getConfig();
    const lock = await this.cacheService.acquireLock(
      this.getRebuildLockKey(postingId),
      config.rebuildLockTtlMs,
    );

    if (lock) {
      try {
        const generation = await this.readGeneration(postingId);
        const entry = await this.readEntry(postingId, generation);

        if (entry && Date.parse(entry.freshUntil) > Date.now()) {
          return this.toPublicPosting(entry);
        }

        return this.fetchAndCachePosting(postingId, generation);
      } finally {
        await lock.release();
      }
    }

    const deadline = Date.now() + config.followerWaitTimeoutMs;

    while (Date.now() < deadline) {
      await this.sleep(config.followerPollIntervalMs);

      const generation = await this.readGeneration(postingId);
      const entry = await this.readEntry(postingId, generation);

      if (!entry) {
        continue;
      }

      if (Date.parse(entry.freshUntil) > Date.now() || Date.parse(entry.staleUntil) > Date.now()) {
        return this.toPublicPosting(entry);
      }
    }

    const direct = await this.resolvePublicPosting(postingId);
    const generation = await this.readGeneration(postingId);
    const entry = await this.readEntry(postingId, generation);

    if (!entry) {
      await this.writeEntry(postingId, generation, direct);
    }

    return direct;
  }

  private async fetchAndCachePosting(
    postingId: string,
    generation: number,
  ): Promise<PublicPostingRecord | null> {
    const posting = await this.resolvePublicPosting(postingId);
    await this.writeEntry(postingId, generation, posting);
    return posting;
  }

  private async resolvePublicPosting(postingId: string): Promise<PublicPostingRecord | null> {
    const batch = await this.postingsRepository.batchFindPublic({
      ids: [postingId],
    });

    return batch.postings[0] ?? null;
  }

  private async writeEntry(
    postingId: string,
    generation: number,
    posting: PublicPostingRecord | null,
  ): Promise<void> {
    const now = Date.now();
    const config = this.getConfig();
    const freshTtlMs = posting === null
      ? config.negativeTtlSeconds * 1000
      : config.freshTtlSeconds * 1000;
    const staleTtlMs = posting === null
      ? config.negativeTtlSeconds * 1000
      : config.staleTtlSeconds * 1000;
    const envelope: PublicPostingCacheEnvelope = {
      kind: posting === null ? "miss" : "hit",
      ...(posting ? { posting } : {}),
      freshUntil: new Date(now + freshTtlMs).toISOString(),
      staleUntil: new Date(now + staleTtlMs).toISOString(),
      cachedAt: new Date(now).toISOString(),
    };

    await this.cacheService.setJson(
      this.getDataKey(postingId, generation),
      envelope,
      Math.max(1, Math.ceil(staleTtlMs / 1000)),
    );
  }

  private async readGeneration(postingId: string): Promise<number> {
    const raw = await this.cacheService.get(this.getGenerationKey(postingId));

    if (!raw) {
      return 0;
    }

    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  private async readEntry(
    postingId: string,
    generation: number,
  ): Promise<PublicPostingCacheEnvelope | null> {
    return this.cacheService.getJson<PublicPostingCacheEnvelope>(
      this.getDataKey(postingId, generation),
    );
  }

  private toPublicPosting(entry: PublicPostingCacheEnvelope): PublicPostingRecord | null {
    return entry.kind === "hit" ? entry.posting ?? null : null;
  }

  private getConfig(): PostingsPublicCacheConfig {
    return this.config ?? environment.getPostingsPublicCacheConfig();
  }

  private getGenerationKey(postingId: string): string {
    return `postings:public:gen:${postingId}`;
  }

  private getDataKey(postingId: string, generation: number): string {
    return `postings:public:data:${postingId}:${generation}`;
  }

  private getRebuildLockKey(postingId: string): string {
    return `postings:public:rebuild:${postingId}`;
  }

  private async sleep(durationMs: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }
}
