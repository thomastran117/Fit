import ConflictError from "@/errors/http/conflict.error";
import type { PostingSearchOutboxRecord } from "@/features/postings/postings.model";
import { isPostingSearchIndexable } from "@/features/postings/postings.model";
import { PostingsSearchService } from "@/features/postings/postings.search.service";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type {
  SearchIndexJobPayload,
  SearchQueueCounts,
  SearchReindexRunRecord,
  SearchStatusResult,
} from "@/features/search/search.model";
import { SearchQueueService } from "@/features/search/search.queue.service";
import {
  getSearchTelemetrySnapshot,
  recordQueueInspectionFailure,
  recordReindexRunCompleted,
  recordReindexRunFailed,
} from "@/features/search/search.telemetry";

function createEmptyQueueCounts(): SearchQueueCounts {
  return {
    ready: 0,
    consumers: 0,
  };
}

const REINDEX_HEARTBEAT_BULK_CHUNK_SIZE = 100;

export class SearchService {
  constructor(
    private readonly postingsRepository: PostingsRepository,
    private readonly postingsSearchService: PostingsSearchService,
    private readonly searchQueueService: SearchQueueService,
  ) {}

  async startReindex(): Promise<SearchReindexRunRecord> {
    const run = await this.postingsRepository.withSearchReindexStartLock(
      async ({ findActiveSearchReindexRun, createSearchReindexRun }) => {
        const activeRun = await findActiveSearchReindexRun();

        if (activeRun) {
          throw new ConflictError("A search reindex run is already active.");
        }

        await this.postingsSearchService.ensureLiveIndex();
        const targetIndexName = await this.postingsSearchService.createVersionedIndex();
        return createSearchReindexRun(targetIndexName);
      },
    );

    if (!run) {
      throw new ConflictError("A search reindex run is already active.");
    }

    return run;
  }

  async getReindexRun(id: string): Promise<SearchReindexRunRecord | null> {
    return this.postingsRepository.findSearchReindexRunById(id);
  }

  async getStatus(): Promise<SearchStatusResult> {
    const [aliasHealth, currentReindexRun, pendingOutboxMetrics, queueInspection] =
      await Promise.all([
        this.postingsSearchService.isElasticsearchEnabled()
          ? this.postingsSearchService.getAliasStatus()
          : Promise.resolve(this.createDisabledAliasHealth()),
        this.postingsRepository.findActiveSearchReindexRun(),
        this.postingsRepository.getPendingSearchOutboxMetrics(),
        this.postingsSearchService.isElasticsearchEnabled()
          ? this.searchQueueService
              .getQueueCounts()
              .then((counts) => ({
                inspection: {
                  ok: true as const,
                },
                counts,
              }))
              .catch((error) => {
                recordQueueInspectionFailure();
                return {
                  inspection: {
                    ok: false as const,
                    error: error instanceof Error ? error.message : "Unable to inspect search queues.",
                  },
                };
              })
          : Promise.resolve({
              inspection: {
                ok: true as const,
              },
              counts: {
                main: createEmptyQueueCounts(),
                retry1: createEmptyQueueCounts(),
                retry2: createEmptyQueueCounts(),
                retry3: createEmptyQueueCounts(),
                deadLetter: createEmptyQueueCounts(),
              },
            }),
      ]);
    const telemetry = getSearchTelemetrySnapshot();

    return {
      aliases: {
        read: this.postingsSearchService.getReadAliasName(),
        write: this.postingsSearchService.getWriteAliasName(),
        readTargets: aliasHealth.readTargets,
        writeTargets: aliasHealth.writeTargets,
        health: aliasHealth,
      },
      elasticsearch: {
        enabled: this.postingsSearchService.isElasticsearchEnabled(),
        circuitBreaker: this.postingsSearchService.getCircuitBreakerState(),
        telemetry: {
          ...telemetry.elasticsearchRequests,
          ...telemetry.circuitBreaker,
        },
      },
      currentReindexRun: currentReindexRun ?? undefined,
      pendingOutboxCount: pendingOutboxMetrics.count,
      pendingOutboxOldestAgeMs: pendingOutboxMetrics.oldestAgeMs,
      queueInspection: queueInspection.inspection,
      ...("counts" in queueInspection ? { queueCounts: queueInspection.counts } : {}),
      telemetry: {
        fallbacks: telemetry.fallbacks,
        queueInspectionFailures: telemetry.queueInspectionFailures,
        reindexRuns: telemetry.reindexRuns,
        aliasActions: telemetry.aliasActions,
      },
    };
  }

  async processOutboxRelayBatch(limit: number, maxPublishAttempts: number): Promise<number> {
    await this.postingsSearchService.ensureLiveIndex();
    await this.searchQueueService.ensureTopology();

    const jobs = await this.postingsRepository.claimSearchOutboxBatch(limit);
    const relayJobs = this.coalesceRelayJobs(jobs);

    for (const relayJob of relayJobs) {
      const job = relayJob.primary;
      let published = false;
      let publishError: string | undefined;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await this.searchQueueService.publishIndexJob(this.toIndexJob(job));
          await this.postingsRepository.markSearchOutboxPublished(job.id, job.id);
          await this.postingsRepository.markSearchOutboxSuperseded(relayJob.supersededIds, job.id);
          published = true;
          break;
        } catch (error) {
          publishError = error instanceof Error ? error.message : "Unknown relay error.";
        }
      }

      if (published) {
        continue;
      }

      try {
        const errorMessage = publishError ?? "Unknown relay error.";
        await this.postingsRepository.releaseSearchOutboxClaims(relayJob.supersededIds);

        if (job.publishAttempts + 1 >= maxPublishAttempts) {
          await this.postingsRepository.markSearchOutboxDeadLettered(job.id, errorMessage);
        } else {
          await this.postingsRepository.markSearchOutboxPublishRetry(
            job.id,
            job.publishAttempts + 1,
            errorMessage,
          );
        }
      } catch (error) {
        console.error("Failed to persist relay failure state", {
          outboxId: job.id,
          error,
        });
      }
    }

    return jobs.length;
  }

  async processIndexJob(payload: SearchIndexJobPayload, maxAttempts: number): Promise<void> {
    const job = await this.postingsRepository.getSearchOutboxById(payload.outboxId);

    if (!job || job.deadLetteredAt || job.indexedAt) {
      return;
    }

      if (job.operation === "barrier") {
        await this.postingsRepository.markSearchOutboxIndexed(job.id);
        return;
      }

      try {
        if (!job.postingId) {
          throw new Error("Search outbox job is missing a posting id.");
        }

        if (await this.postingsRepository.hasNewerSearchOutboxJob(job)) {
          console.info("Skipping stale search outbox job because a newer job exists.", {
            outboxId: job.id,
            postingId: job.postingId,
            targetIndexName: job.targetIndexName,
          });
          await this.postingsRepository.markSearchOutboxIndexed(job.id);
          return;
        }

        if (job.operation === "delete") {
          await this.postingsSearchService.deleteDocument(job.postingId, job.targetIndexName);
        } else {
        const documents = await this.postingsRepository.findByIdsForIndexing([job.postingId]);
        const document = documents[0];

        if (!document || !isPostingSearchIndexable(document.status)) {
          await this.postingsSearchService.deleteDocument(job.postingId, job.targetIndexName);
        } else {
          await this.postingsSearchService.upsertDocument(document, job.targetIndexName);
        }
      }

      await this.postingsRepository.markSearchOutboxIndexed(job.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown indexing error.";
      const attempt = await this.postingsRepository.incrementSearchOutboxAttempt(job.id, errorMessage);
      const nextPayload = {
        ...payload,
        attempt,
      };

      if (attempt >= maxAttempts) {
        await this.searchQueueService.publishDeadLetterJob(nextPayload);
        await this.postingsRepository.markSearchOutboxDeadLettered(job.id, errorMessage);
        return;
      }

      await this.searchQueueService.publishRetryJob(nextPayload, attempt);
    }
  }

  async processReindexRuns(batchSize: number): Promise<number> {
    await this.postingsSearchService.ensureLiveIndex();
    await this.searchQueueService.ensureTopology();

    const run = await this.postingsRepository.claimNextSearchReindexRun();

    if (!run) {
      return 0;
    }

    try {
      if (run.status === "pending" || run.status === "running") {
        await this.rebuildTargetIndex(run, batchSize);
        return 1;
      }

      if (run.status === "waiting_for_catchup") {
        const caughtUp = await this.postingsRepository.isSearchReindexRunCaughtUp(run.id);

        if (!caughtUp) {
          await this.postingsRepository.clearSearchReindexRunProcessing(run.id);
          return 1;
        }

        const { previousReadTargets, previousWriteTargets } =
          await this.postingsSearchService.swapAliases(run.targetIndexName);
        const retainedIndexName =
          [...previousReadTargets, ...previousWriteTargets].find((index) => index !== run.targetIndexName);

        await this.postingsRepository.markSearchReindexRunCompleted(run.id, retainedIndexName);
        recordReindexRunCompleted(this.readReindexDurationMs(run));
      }

      return 1;
    } catch (error) {
      await this.postingsRepository.markSearchReindexRunFailed(
        run.id,
        error instanceof Error ? error.message : "Unknown reindex error.",
      );
      recordReindexRunFailed(this.readReindexDurationMs(run));
      console.error("Search reindex run failed.", {
        runId: run.id,
        targetIndexName: run.targetIndexName,
        error,
      });
      return 1;
    }
  }

  private async rebuildTargetIndex(
    run: SearchReindexRunRecord,
    batchSize: number,
  ): Promise<void> {
    const totalPostings = await this.postingsRepository.countPublishedPostingsForIndexing();
    await this.postingsRepository.markSearchReindexRunRunning(run.id, totalPostings);

    let cursorId: string | undefined;
    let indexedPostings = 0;

    while (true) {
      const documents = await this.postingsRepository.listPublishedForIndexingBatch(
        batchSize,
        cursorId,
      );

      if (documents.length === 0) {
        break;
      }

      for (const chunk of this.chunkDocuments(documents, REINDEX_HEARTBEAT_BULK_CHUNK_SIZE)) {
        await this.postingsRepository.touchSearchReindexRunProcessing(run.id);
        await this.postingsSearchService.bulkUpsertDocuments(chunk, run.targetIndexName);
        await this.postingsRepository.touchSearchReindexRunProcessing(run.id);
      }
      indexedPostings += documents.length;
      cursorId = documents[documents.length - 1]?.id;

      await this.postingsRepository.updateSearchReindexRunProgress(run.id, {
        indexedPostings,
      });
    }

    await this.postingsRepository.enqueueSearchReindexBarrier(run.id, run.targetIndexName);
  }

  private toIndexJob(job: PostingSearchOutboxRecord): SearchIndexJobPayload {
    return {
      outboxId: job.id,
      eventId: job.id,
      dedupeKey: job.dedupeKey,
      operation: job.operation,
      jobType: job.operation,
      postingId: job.postingId,
      reindexRunId: job.reindexRunId,
      targetIndexScope: job.reindexRunId ? "reindex" : "live",
      targetIndexName: job.targetIndexName,
      occurredAt: job.createdAt,
      attempt: job.attempts,
    };
  }

  private createDisabledAliasHealth(): SearchStatusResult["aliases"]["health"] {
    return {
      state: "disabled",
      readAlias: this.postingsSearchService.getReadAliasName(),
      writeAlias: this.postingsSearchService.getWriteAliasName(),
      readTargets: [],
      writeTargets: [],
    };
  }

  private readReindexDurationMs(run: SearchReindexRunRecord): number | undefined {
    if (!run.startedAt) {
      return undefined;
    }

    const startedAt = new Date(run.startedAt).getTime();

    if (Number.isNaN(startedAt)) {
      return undefined;
    }

    return Math.max(0, Date.now() - startedAt);
  }

  private coalesceRelayJobs(
    jobs: PostingSearchOutboxRecord[],
  ): Array<{ primary: PostingSearchOutboxRecord; supersededIds: string[] }> {
    const groups = new Map<
      string,
      {
        primary: PostingSearchOutboxRecord;
        supersededIds: string[];
      }
    >();

    for (const job of jobs) {
      const key = this.createRelayCoalescingKey(job);

      if (!key) {
        groups.set(`outbox:${job.id}`, {
          primary: job,
          supersededIds: [],
        });
        continue;
      }

      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          primary: job,
          supersededIds: [],
        });
        continue;
      }

      existing.supersededIds.push(existing.primary.id);
      existing.primary = job;
    }

    return Array.from(groups.values());
  }

  private createRelayCoalescingKey(job: PostingSearchOutboxRecord): string | null {
    if (job.operation === "barrier" || !job.postingId) {
      return null;
    }

    return [job.postingId, job.reindexRunId ?? "live", job.targetIndexName ?? "live"].join(":");
  }

  private chunkDocuments<T>(documents: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < documents.length; index += size) {
      chunks.push(documents.slice(index, index + size));
    }

    return chunks;
  }
}
