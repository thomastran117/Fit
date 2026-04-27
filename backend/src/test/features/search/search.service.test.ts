import ConflictError from "@/errors/http/conflict.error";
import { SearchService } from "@/features/search/search.service";
import { resetSearchTelemetry } from "@/features/search/search.telemetry";

describe("SearchService", () => {
  beforeEach(() => {
    resetSearchTelemetry();
  });

  it("starts a reindex run while holding the start lock", async () => {
    const createSearchReindexRun = jest.fn(async (targetIndexName: string) => ({
      id: "run-1",
      status: "pending" as const,
      targetIndexName,
      sourceSnapshotAt: "2026-04-27T00:00:00.000Z",
      totalPostings: 0,
      indexedPostings: 0,
      failedPostings: 0,
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    }));
    const withSearchReindexStartLock = jest.fn(async (operation: (helpers: unknown) => Promise<unknown>) =>
      operation({
        findActiveSearchReindexRun: async () => null,
        createSearchReindexRun,
      }),
    );
    const postingsRepository = {
      withSearchReindexStartLock,
    } as never;
    const postingsSearchService = {
      ensureLiveIndex: jest.fn(async () => undefined),
      createVersionedIndex: jest.fn(async () => "postings_v2"),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, {} as never);

    const result = await service.startReindex();

    expect(withSearchReindexStartLock).toHaveBeenCalledTimes(1);
    expect(postingsSearchService.ensureLiveIndex).toHaveBeenCalledTimes(1);
    expect(postingsSearchService.createVersionedIndex).toHaveBeenCalledTimes(1);
    expect(createSearchReindexRun).toHaveBeenCalledWith("postings_v2");
    expect(result).toMatchObject({
      id: "run-1",
      targetIndexName: "postings_v2",
    });
  });

  it("returns a conflict when the start lock cannot be acquired", async () => {
    const postingsRepository = {
      withSearchReindexStartLock: jest.fn(async () => null),
    } as never;
    const service = new SearchService(postingsRepository, {} as never, {} as never);

    await expect(service.startReindex()).rejects.toBeInstanceOf(ConflictError);
  });

  it("reports queue inspection failures explicitly in status", async () => {
    const postingsRepository = {
      findActiveSearchReindexRun: jest.fn(async () => null),
      getPendingSearchOutboxMetrics: jest.fn(async () => ({
        count: 3,
        oldestAgeMs: 1_500,
      })),
    } as never;
    const postingsSearchService = {
      isElasticsearchEnabled: () => true,
      getAliasStatus: jest.fn(async () => ({
        state: "ready" as const,
        readAlias: "postings-read",
        writeAlias: "postings-write",
        readTargets: ["postings_v1"],
        writeTargets: ["postings_v1"],
      })),
      getReadAliasName: () => "postings-read",
      getWriteAliasName: () => "postings-write",
      getCircuitBreakerState: () => ({
        state: "closed" as const,
        consecutiveFailures: 0,
        failureThreshold: 3,
        cooldownMs: 30_000,
      }),
    } as never;
    const searchQueueService = {
      getQueueCounts: jest.fn(async () => {
        throw new Error("broker unavailable");
      }),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, searchQueueService);

    const status = await service.getStatus();

    expect(status.queueInspection).toEqual({
      ok: false,
      error: "broker unavailable",
    });
    expect(status.queueCounts).toBeUndefined();
    expect(status.pendingOutboxCount).toBe(3);
    expect(status.pendingOutboxOldestAgeMs).toBe(1_500);
    expect(status.aliases.health.state).toBe("ready");
    expect(status.telemetry.queueInspectionFailures).toBe(1);
  });
});
