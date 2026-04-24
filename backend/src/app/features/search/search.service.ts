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

function createEmptyQueueCounts(): SearchQueueCounts {
  return {
    ready: 0,
    consumers: 0,
  };
}

export class SearchService {
  constructor(
    private readonly postingsRepository: PostingsRepository,
    private readonly postingsSearchService: PostingsSearchService,
    private readonly searchQueueService: SearchQueueService,
  ) {}

  async startReindex(): Promise<SearchReindexRunRecord> {
    const activeRun = await this.postingsRepository.findActiveSearchReindexRun();

    if (activeRun) {
      throw new ConflictError("A search reindex run is already active.");
    }

    await this.postingsSearchService.ensureLiveIndex();
    const targetIndexName = await this.postingsSearchService.createVersionedIndex();

    return this.postingsRepository.createSearchReindexRun(targetIndexName);
  }

  async getReindexRun(id: string): Promise<SearchReindexRunRecord | null> {
    return this.postingsRepository.findSearchReindexRunById(id);
  }

  async getStatus(): Promise<SearchStatusResult> {
    const [readTargets, writeTargets, currentReindexRun, pendingOutboxCount, queueCounts] =
      await Promise.all([
        this.postingsSearchService.isElasticsearchEnabled()
          ? this.postingsSearchService.getAliasTargets(this.postingsSearchService.getReadAliasName())
          : Promise.resolve([]),
        this.postingsSearchService.isElasticsearchEnabled()
          ? this.postingsSearchService.getAliasTargets(this.postingsSearchService.getWriteAliasName())
          : Promise.resolve([]),
        this.postingsRepository.findActiveSearchReindexRun(),
        this.postingsRepository.getPendingSearchOutboxCount(),
        this.postingsSearchService.isElasticsearchEnabled()
          ? this.searchQueueService.getQueueCounts().catch(() => ({
              main: createEmptyQueueCounts(),
              retry1: createEmptyQueueCounts(),
              retry2: createEmptyQueueCounts(),
              retry3: createEmptyQueueCounts(),
              deadLetter: createEmptyQueueCounts(),
            }))
          : Promise.resolve({
              main: createEmptyQueueCounts(),
              retry1: createEmptyQueueCounts(),
              retry2: createEmptyQueueCounts(),
              retry3: createEmptyQueueCounts(),
              deadLetter: createEmptyQueueCounts(),
            }),
      ]);

    return {
      aliases: {
        read: this.postingsSearchService.getReadAliasName(),
        write: this.postingsSearchService.getWriteAliasName(),
        readTargets,
        writeTargets,
      },
      elasticsearch: {
        enabled: this.postingsSearchService.isElasticsearchEnabled(),
        circuitBreaker: this.postingsSearchService.getCircuitBreakerState(),
      },
      currentReindexRun: currentReindexRun ?? undefined,
      pendingOutboxCount,
      queueCounts,
    };
  }

  async processOutboxRelayBatch(limit: number, maxPublishAttempts: number): Promise<number> {
    await this.postingsSearchService.ensureLiveIndex();
    await this.searchQueueService.ensureTopology();

    const jobs = await this.postingsRepository.claimSearchOutboxBatch(limit);

    for (const job of jobs) {
      let published = false;
      let publishError: string | undefined;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await this.searchQueueService.publishIndexJob(this.toIndexJob(job));
          await this.postingsRepository.markSearchOutboxPublished(job.id, job.id);
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
          return 1;
        }

        const { previousReadTargets, previousWriteTargets } =
          await this.postingsSearchService.swapAliases(run.targetIndexName);
        const retainedIndexName =
          [...previousReadTargets, ...previousWriteTargets].find((index) => index !== run.targetIndexName);

        await this.postingsRepository.markSearchReindexRunCompleted(run.id, retainedIndexName);
      }

      return 1;
    } catch (error) {
      await this.postingsRepository.markSearchReindexRunFailed(
        run.id,
        error instanceof Error ? error.message : "Unknown reindex error.",
      );
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

      await this.postingsSearchService.bulkUpsertDocuments(documents, run.targetIndexName);
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
}
