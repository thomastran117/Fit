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
      getSearchOutboxLagMetrics: jest.fn(async () => ({
        unpublishedCount: 3,
        unpublishedOldestAgeMs: 1_500,
        publishedNotIndexedCount: 2,
        publishedNotIndexedOldestAgeMs: 500,
        deadLetteredByOperation: {
          upsert: 1,
          delete: 0,
          barrier: 0,
        },
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
    expect(status.lag).toEqual({
      unpublishedCount: 3,
      unpublishedOldestAgeMs: 1_500,
      publishedNotIndexedCount: 2,
      publishedNotIndexedOldestAgeMs: 500,
      deadLetteredByOperation: {
        upsert: 1,
        delete: 0,
        barrier: 0,
      },
    });
    expect(status.aliases.health.state).toBe("ready");
    expect(status.telemetry.queueInspectionFailures).toBe(1);
  });

  it("coalesces relay jobs by posting and target before publish", async () => {
    const markSearchOutboxPublished = jest.fn(async () => undefined);
    const markSearchOutboxSuperseded = jest.fn(async () => undefined);
    const releaseSearchOutboxClaims = jest.fn(async () => undefined);
    const postingsRepository = {
      claimSearchOutboxBatch: jest.fn(async () => [
        {
          id: "outbox-1",
          postingId: "posting-1",
          operation: "upsert",
          dedupeKey: "outbox-1",
          attempts: 0,
          publishAttempts: 0,
          availableAt: "2026-04-27T00:00:00.000Z",
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z",
        },
        {
          id: "outbox-2",
          postingId: "posting-1",
          operation: "delete",
          dedupeKey: "outbox-2",
          attempts: 0,
          publishAttempts: 0,
          availableAt: "2026-04-27T00:00:01.000Z",
          createdAt: "2026-04-27T00:00:01.000Z",
          updatedAt: "2026-04-27T00:00:01.000Z",
        },
      ]),
      markSearchOutboxPublished,
      markSearchOutboxSuperseded,
      releaseSearchOutboxClaims,
    } as never;
    const postingsSearchService = {
      ensureLiveIndex: jest.fn(async () => undefined),
    } as never;
    const searchQueueService = {
      ensureTopology: jest.fn(async () => undefined),
      publishIndexJob: jest.fn(async () => undefined),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, searchQueueService);

    const processed = await service.processOutboxRelayBatch(10, 3);

    expect(processed).toBe(2);
    expect(searchQueueService.publishIndexJob).toHaveBeenCalledTimes(1);
    expect(searchQueueService.publishIndexJob).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxId: "outbox-2",
        operation: "delete",
      }),
    );
    expect(markSearchOutboxPublished).toHaveBeenCalledWith("outbox-2", "outbox-2");
    expect(markSearchOutboxSuperseded).toHaveBeenCalledWith(["outbox-1"], "outbox-2");
    expect(releaseSearchOutboxClaims).not.toHaveBeenCalled();
  });

  it("skips stale index jobs when a newer outbox job exists", async () => {
    const markSearchOutboxIndexed = jest.fn(async () => undefined);
    const postingsRepository = {
      getSearchOutboxById: jest.fn(async () => ({
        id: "outbox-1",
        postingId: "posting-1",
        reindexRunId: undefined,
        operation: "delete",
        dedupeKey: "outbox-1",
        attempts: 0,
        publishAttempts: 0,
        availableAt: "2026-04-27T00:00:00.000Z",
        createdAt: "2026-04-27T00:00:00.000Z",
        updatedAt: "2026-04-27T00:00:00.000Z",
      })),
      hasNewerSearchOutboxJob: jest.fn(async () => true),
      markSearchOutboxIndexed,
    } as never;
    const postingsSearchService = {
      deleteDocument: jest.fn(async () => undefined),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, {} as never);

    await service.processIndexJob(
      {
        outboxId: "outbox-1",
        eventId: "outbox-1",
        dedupeKey: "outbox-1",
        operation: "delete",
        jobType: "delete",
        postingId: "posting-1",
        targetIndexScope: "live",
        occurredAt: "2026-04-27T00:00:00.000Z",
        attempt: 0,
      },
      3,
    );

    expect(postingsSearchService.deleteDocument).not.toHaveBeenCalled();
    expect(markSearchOutboxIndexed).toHaveBeenCalledWith("outbox-1");
  });

  it("heartbeats reindex processing and clears waiting runs for the next poll", async () => {
    const touchSearchReindexRunProcessing = jest.fn(async () => undefined);
    const clearSearchReindexRunProcessing = jest.fn(async () => undefined);
    const postingsRepository = {
      claimNextSearchReindexRun: jest
        .fn()
        .mockResolvedValueOnce({
          id: "run-1",
          status: "running",
          targetIndexName: "postings_v2",
          sourceSnapshotAt: "2026-04-27T00:00:00.000Z",
          totalPostings: 0,
          indexedPostings: 0,
          failedPostings: 0,
          startedAt: "2026-04-27T00:00:00.000Z",
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z",
        })
        .mockResolvedValueOnce({
          id: "run-1",
          status: "waiting_for_catchup",
          targetIndexName: "postings_v2",
          sourceSnapshotAt: "2026-04-27T00:00:00.000Z",
          totalPostings: 2,
          indexedPostings: 2,
          failedPostings: 0,
          startedAt: "2026-04-27T00:00:00.000Z",
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z",
        }),
      countPublishedPostingsForIndexing: jest.fn(async () => 2),
      markSearchReindexRunRunning: jest.fn(async () => undefined),
      listPublishedForIndexingBatch: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: "posting-1",
          },
          {
            id: "posting-2",
          },
        ])
        .mockResolvedValueOnce([]),
      updateSearchReindexRunProgress: jest.fn(async () => undefined),
      enqueueSearchReindexBarrier: jest.fn(async () => undefined),
      touchSearchReindexRunProcessing,
      isSearchReindexRunCaughtUp: jest.fn(async () => false),
      clearSearchReindexRunProcessing,
    } as never;
    const postingsSearchService = {
      ensureLiveIndex: jest.fn(async () => undefined),
      bulkUpsertDocuments: jest.fn(async () => undefined),
    } as never;
    const searchQueueService = {
      ensureTopology: jest.fn(async () => undefined),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, searchQueueService);

    await service.processReindexRuns(200);
    await service.processReindexRuns(200);

    expect(touchSearchReindexRunProcessing).toHaveBeenCalled();
    expect(clearSearchReindexRunProcessing).toHaveBeenCalledWith("run-1");
  });

  it("retries transient reindex failures without failing the run", async () => {
    const clearSearchReindexRunProcessing = jest.fn(async () => undefined);
    const markSearchReindexRunFailed = jest.fn(async () => undefined);
    const postingsRepository = {
      claimNextSearchReindexRun: jest.fn(async () => ({
        id: "run-1",
        status: "running",
        targetIndexName: "postings_v2",
        sourceSnapshotAt: "2026-04-27T00:00:00.000Z",
        totalPostings: 0,
        indexedPostings: 0,
        failedPostings: 0,
        startedAt: "2026-04-27T00:00:00.000Z",
        createdAt: "2026-04-27T00:00:00.000Z",
        updatedAt: "2026-04-27T00:00:00.000Z",
      })),
      countPublishedPostingsForIndexing: jest.fn(async () => 1),
      markSearchReindexRunRunning: jest.fn(async () => undefined),
      listPublishedForIndexingBatch: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: "posting-1",
          },
        ])
        .mockResolvedValueOnce([]),
      touchSearchReindexRunProcessing: jest.fn(async () => undefined),
      clearSearchReindexRunProcessing,
      markSearchReindexRunFailed,
    } as never;
    const postingsSearchService = {
      ensureLiveIndex: jest.fn(async () => undefined),
      bulkUpsertDocuments: jest.fn(async () => {
        throw new Error("amqp broker unavailable");
      }),
    } as never;
    const searchQueueService = {
      ensureTopology: jest.fn(async () => undefined),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, searchQueueService);

    const processed = await service.processReindexRuns(100);

    expect(processed).toBe(0);
    expect(clearSearchReindexRunProcessing).toHaveBeenCalledWith("run-1");
    expect(markSearchReindexRunFailed).not.toHaveBeenCalled();
  });

  it("bulk-indexes live jobs and only falls back per message on failed groups", async () => {
    const markSearchOutboxesIndexed = jest.fn(async () => undefined);
    const postingsRepository = {
      getSearchOutboxesByIds: jest.fn(async () => [
        {
          id: "outbox-1",
          postingId: "posting-1",
          operation: "upsert",
          dedupeKey: "outbox-1",
          attempts: 0,
          publishAttempts: 0,
          availableAt: "2026-04-27T00:00:00.000Z",
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z",
        },
        {
          id: "outbox-2",
          postingId: "posting-2",
          operation: "delete",
          dedupeKey: "outbox-2",
          attempts: 0,
          publishAttempts: 0,
          availableAt: "2026-04-27T00:00:01.000Z",
          createdAt: "2026-04-27T00:00:01.000Z",
          updatedAt: "2026-04-27T00:00:01.000Z",
        },
      ]),
      hasNewerSearchOutboxJob: jest.fn(async () => false),
      markSearchOutboxesIndexed,
      findByIdsForIndexing: jest.fn(async () => [
        {
          id: "posting-1",
          status: "published",
          photos: [],
          pricing: {
            daily: {
              amount: 100,
              currency: "CAD",
            },
          },
        },
      ]),
    } as never;
    const postingsSearchService = {
      getWriteAliasName: () => "postings-write",
      bulkUpsertDocuments: jest.fn(async () => undefined),
      bulkDeleteDocuments: jest.fn(async () => undefined),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, {} as never);

    await service.processIndexJobsBatch(
      [
        {
          outboxId: "outbox-1",
          eventId: "outbox-1",
          dedupeKey: "outbox-1",
          operation: "upsert",
          jobType: "upsert",
          postingId: "posting-1",
          targetIndexScope: "live",
          occurredAt: "2026-04-27T00:00:00.000Z",
          attempt: 0,
        },
        {
          outboxId: "outbox-2",
          eventId: "outbox-2",
          dedupeKey: "outbox-2",
          operation: "delete",
          jobType: "delete",
          postingId: "posting-2",
          targetIndexScope: "live",
          occurredAt: "2026-04-27T00:00:01.000Z",
          attempt: 0,
        },
      ],
      3,
    );

    expect(postingsSearchService.bulkUpsertDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "posting-1" })]),
      "postings-write",
    );
    expect(postingsSearchService.bulkDeleteDocuments).toHaveBeenCalledWith(
      ["posting-2"],
      "postings-write",
    );
    expect(markSearchOutboxesIndexed).toHaveBeenCalledTimes(2);
  });

  it("reconciles recent postings back into the live index", async () => {
    const postingsRepository = {
      listRecentForIndexReconciliation: jest.fn(async () => [
        {
          id: "posting-1",
          status: "published",
          photos: [],
          pricing: {
            daily: {
              amount: 100,
              currency: "CAD",
            },
          },
        },
        {
          id: "posting-2",
          status: "archived",
          photos: [],
          pricing: {
            daily: {
              amount: 50,
              currency: "CAD",
            },
          },
        },
      ]),
    } as never;
    const postingsSearchService = {
      isElasticsearchEnabled: () => true,
      ensureLiveIndex: jest.fn(async () => undefined),
      getWriteAliasName: () => "postings-write",
      bulkUpsertDocuments: jest.fn(async () => undefined),
      bulkDeleteDocuments: jest.fn(async () => undefined),
    } as never;
    const service = new SearchService(postingsRepository, postingsSearchService, {} as never);

    const processed = await service.processReconciliationBatch(25);

    expect(processed).toBe(2);
    expect(postingsSearchService.bulkUpsertDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "posting-1" })]),
      "postings-write",
    );
    expect(postingsSearchService.bulkDeleteDocuments).toHaveBeenCalledWith(
      ["posting-2"],
      "postings-write",
    );
  });
});
