import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import {
  DEFAULT_MAX_BOOKING_DURATION_DAYS,
} from "@/features/postings/postings.model";
import type {
  BatchPublicPostingsInput,
  BatchPostingsResult,
  BatchOwnerPostingsInput,
  ListOwnerPostingsInput,
  ListOwnerPostingsResult,
  PublicPostingRecord,
  PostingAttributeValue,
  PostingAvailabilityBlockRecord,
  PostingAvailabilityStatus,
  PostingPhotoRecord,
  PostingPricing,
  PostingRecord,
  PostingSearchDocument,
  PostingSearchOutboxRecord,
  PostingSort,
  PostingStatus,
  PostingSubtype,
  SearchPostingsInput,
  UpsertPostingInput,
} from "@/features/postings/postings.model";
import type {
  SearchReindexRunRecord,
  SearchReindexStatus,
} from "@/features/search/search.model";
import { getPostingSearchableAttributeDefinitions } from "@/features/postings/postings.variants";

type PostingPersistence = Prisma.PostingGetPayload<{
  include: {
    photos: {
      orderBy: {
        position: "asc";
      };
    };
    availabilityBlocks: {
      orderBy: {
        startAt: "asc";
      };
      include: {
        bookingRequestHold: {
          select: {
            id: true;
            status: true;
            holdExpiresAt: true;
            convertedAt: true;
          };
        };
      };
    };
    bookingRequests: {
      select: {
        id: true;
        status: true;
        startAt: true;
        endAt: true;
        holdExpiresAt: true;
        convertedAt: true;
        conversionReservationExpiresAt: true;
      };
    };
    rentings: {
      select: {
        id: true;
        startAt: true;
        endAt: true;
      };
    };
  };
}>;

interface SearchCountRow {
  total: bigint | number;
}

interface SearchIdRow {
  id: string;
}

const PUBLIC_LOCATION_PRECISION = 2;
const postingInclude = {
  photos: {
    orderBy: {
      position: "asc",
    },
  },
  availabilityBlocks: {
    orderBy: {
      startAt: "asc",
    },
    include: {
      bookingRequestHold: {
        select: {
          id: true,
          status: true,
          holdExpiresAt: true,
          convertedAt: true,
        },
      },
    },
  },
  bookingRequests: {
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      holdExpiresAt: true,
      convertedAt: true,
      conversionReservationExpiresAt: true,
    },
  },
  rentings: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
    },
  },
} satisfies Prisma.PostingInclude;

export class PostingsRepository extends BaseRepository {
  async create(input: UpsertPostingInput): Promise<PostingRecord> {
    return this.executeAsync(async () => {
      const posting = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.posting.create({
          data: this.toCreateData(input),
          include: postingInclude,
        });

        await this.enqueueOutbox(transaction, created.id, "upsert");
        await this.syncOwnerPostingCounts(transaction, input.ownerId);

        return created;
      });

      return this.mapPosting(posting);
    });
  }

  async update(id: string, input: UpsertPostingInput): Promise<PostingRecord | null> {
    return this.executeAsync(async () => {
      try {
        const posting = await this.prisma.$transaction(async (transaction) => {
          const updated = await transaction.posting.update({
            where: {
              id,
            },
            data: this.toUpdateData(input),
            include: postingInclude,
          });

          await this.enqueueOutbox(
            transaction,
            updated.id,
            updated.status === "archived" ? "delete" : "upsert",
          );
          await this.syncOwnerPostingCounts(transaction, input.ownerId);

          return updated;
        });

        return this.mapPosting(posting);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    });
  }

  async publish(id: string, ownerId: string): Promise<PostingRecord | null> {
    return this.executeAsync(async () => {
      try {
        const posting = await this.prisma.$transaction(async (transaction) => {
          const updated = await transaction.posting.update({
            where: {
              id,
            },
            data: {
              status: "published",
              publishedAt: new Date(),
              archivedAt: null,
            },
            include: postingInclude,
          });

          await this.enqueueOutbox(transaction, updated.id, "upsert");
          await this.syncOwnerPostingCounts(transaction, ownerId);

          return updated;
        });

        return this.mapPosting(posting);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    });
  }

  async archive(id: string, ownerId: string): Promise<PostingRecord | null> {
    return this.executeAsync(async () => {
      try {
        const posting = await this.prisma.$transaction(async (transaction) => {
          const updated = await transaction.posting.update({
            where: {
              id,
            },
            data: {
              status: "archived",
              archivedAt: new Date(),
            },
            include: postingInclude,
          });

          await this.enqueueOutbox(transaction, updated.id, "delete");
          await this.syncOwnerPostingCounts(transaction, ownerId);

          return updated;
        });

        return this.mapPosting(posting);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    });
  }

  async findById(id: string): Promise<PostingRecord | null> {
    const posting = await this.executeAsync(() =>
      this.prisma.posting.findUnique({
        where: {
          id,
        },
        include: postingInclude,
      }),
    );

    return posting ? this.mapPosting(posting) : null;
  }

  async listByOwner(input: ListOwnerPostingsInput): Promise<ListOwnerPostingsResult> {
    const where: Prisma.PostingWhereInput = {
      ownerId: input.ownerId,
      ...(input.status ? { status: input.status } : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [postings, total] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.posting.findMany({
          where,
          skip,
          take: input.pageSize,
          orderBy: [
            {
              updatedAt: "desc",
            },
            {
              createdAt: "desc",
            },
          ],
          include: postingInclude,
        }),
        this.prisma.posting.count({
          where,
        }),
      ]),
    );

    return {
      postings: postings.map((posting) => this.mapPosting(posting)),
      pagination: this.createPagination(input.page, input.pageSize, total),
      ...(input.status ? { status: input.status } : {}),
    };
  }

  async batchFindByOwner(
    input: BatchOwnerPostingsInput,
  ): Promise<BatchPostingsResult<PostingRecord>> {
    const postings = await this.executeAsync(() =>
      this.prisma.posting.findMany({
        where: {
          ownerId: input.ownerId,
          id: {
            in: input.ids,
          },
        },
        include: postingInclude,
      }),
    );

    const mapped = postings.map((posting) => this.mapPosting(posting));
    return this.orderBatchResult(input.ids, mapped);
  }

  async batchFindPublic(
    input: BatchPublicPostingsInput,
  ): Promise<BatchPostingsResult<PublicPostingRecord>> {
    const postings = await this.executeAsync(() =>
      this.prisma.posting.findMany({
        where: {
          id: {
            in: input.ids,
          },
          status: "published",
          archivedAt: null,
        },
        include: postingInclude,
      }),
    );

    const mapped = postings.map((posting) => this.mapPublicPosting(posting));
    return this.orderBatchResult(input.ids, mapped);
  }

  async searchPublicFallback(input: SearchPostingsInput): Promise<{
    ids: string[];
    total: number;
  }> {
    const skip = (input.page - 1) * input.pageSize;
    const whereClauses: Prisma.Sql[] = [
      Prisma.sql`status = 'published'`,
      Prisma.sql`archived_at IS NULL`,
    ];

    if (input.query) {
      const likeValue = `%${input.query}%`;
      whereClauses.push(
        Prisma.sql`(
          name LIKE ${likeValue}
          OR description LIKE ${likeValue}
          OR city LIKE ${likeValue}
          OR region LIKE ${likeValue}
          OR country LIKE ${likeValue}
          OR CAST(tags AS CHAR) LIKE ${likeValue}
        )`,
      );
    }

    if (input.family) {
      whereClauses.push(Prisma.sql`family = ${input.family}`);
    }

    if (input.subtype) {
      whereClauses.push(Prisma.sql`subtype = ${input.subtype}`);
    }

    for (const tag of input.tags ?? []) {
      whereClauses.push(Prisma.sql`JSON_SEARCH(tags, 'one', ${tag}) IS NOT NULL`);
    }

    if (input.availabilityStatus) {
      whereClauses.push(Prisma.sql`availability_status = ${input.availabilityStatus}`);
    }

    if (input.minDailyPrice !== undefined) {
      whereClauses.push(
        Prisma.sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(pricing, '$.daily.amount')) AS DECIMAL(18, 2)) >= ${input.minDailyPrice}`,
      );
    }

    if (input.maxDailyPrice !== undefined) {
      whereClauses.push(
        Prisma.sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(pricing, '$.daily.amount')) AS DECIMAL(18, 2)) <= ${input.maxDailyPrice}`,
      );
    }

    if (input.availabilityWindow) {
      const requestedStartAt = new Date(input.availabilityWindow.startAt);
      const requestedEndAt = new Date(input.availabilityWindow.endAt);
      const now = new Date();

      whereClauses.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM posting_availability_blocks pab
          LEFT JOIN booking_requests br
            ON br.hold_block_id = pab.id
          WHERE pab.posting_id = postings.id
            AND pab.start_at < ${requestedEndAt}
            AND pab.end_at > ${requestedStartAt}
            AND (
              br.id IS NULL
              OR (
                br.status IN ('awaiting_payment', 'payment_processing', 'paid')
                AND br.converted_at IS NULL
                AND br.hold_expires_at > ${now}
              )
            )
        )`,
      );

      whereClauses.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM booking_requests br
          WHERE br.posting_id = postings.id
            AND br.status IN ('pending', 'awaiting_payment', 'payment_processing', 'paid')
            AND br.converted_at IS NULL
            AND (
              br.conversion_reservation_expires_at IS NULL
              OR br.conversion_reservation_expires_at <= ${now}
            )
            AND br.hold_expires_at > ${now}
            AND br.start_at < ${requestedEndAt}
            AND br.end_at > ${requestedStartAt}
        )`,
      );

      whereClauses.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM rentings r
          WHERE r.posting_id = postings.id
            AND r.start_at < ${requestedEndAt}
            AND r.end_at > ${requestedStartAt}
        )`,
      );
    }

    const distanceExpression = input.geo
      ? Prisma.sql`(
          6371 * ACOS(
            LEAST(
              1,
              GREATEST(
                -1,
                COS(RADIANS(${input.geo.latitude})) * COS(RADIANS(latitude))
                * COS(RADIANS(longitude) - RADIANS(${input.geo.longitude}))
                + SIN(RADIANS(${input.geo.latitude})) * SIN(RADIANS(latitude))
              )
            )
          )
        )`
      : null;

    if (distanceExpression && input.geo?.radiusKm !== undefined) {
      whereClauses.push(Prisma.sql`${distanceExpression} <= ${input.geo.radiusKm}`);
    }

    const orderBy = this.createFallbackOrderBy(input, distanceExpression);

    const whereSql = Prisma.join(whereClauses, " AND ");
    const [countRows, idRows] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.$queryRaw<SearchCountRow[]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM postings WHERE ${whereSql}`,
        ),
        this.prisma.$queryRaw<SearchIdRow[]>(
          Prisma.sql`
            SELECT id
            FROM postings
            WHERE ${whereSql}
            ORDER BY ${orderBy}
            LIMIT ${input.pageSize}
            OFFSET ${skip}
          `,
        ),
      ]),
    );

    return {
      ids: idRows.map((row) => row.id),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async findByIdsForIndexing(ids: string[]): Promise<PostingSearchDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    const postings = await this.executeAsync(() =>
      this.prisma.posting.findMany({
        where: {
          id: {
            in: ids,
          },
        },
        include: postingInclude,
      }),
    );

    return postings.map((posting) => this.mapSearchDocument(posting));
  }

  async claimSearchOutboxBatch(limit: number): Promise<PostingSearchOutboxRecord[]> {
    return this.executeAsync(async () => {
      const now = new Date();
      const staleProcessingThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const candidates = await this.prisma.postingSearchOutbox.findMany({
        where: {
          processedAt: null,
          deadLetteredAt: null,
          availableAt: {
            lte: now,
          },
          OR: [
            {
              processingAt: null,
            },
            {
              processingAt: {
                lt: staleProcessingThreshold,
              },
            },
          ],
        },
        orderBy: [
          {
            availableAt: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
        take: limit,
      });

      const claimed: PostingSearchOutboxRecord[] = [];

      for (const candidate of candidates) {
        const result = await this.prisma.postingSearchOutbox.updateMany({
          where: {
            id: candidate.id,
            processedAt: null,
            deadLetteredAt: null,
            OR: [
              {
                processingAt: null,
              },
              {
                processingAt: {
                  lt: staleProcessingThreshold,
                },
              },
            ],
          },
          data: {
            processingAt: now,
          },
        });

        if (result.count === 1) {
          claimed.push(this.mapOutbox(candidate, now));
        }
      }

      return claimed;
    });
  }

  async markSearchOutboxPublished(id: string, brokerMessageId?: string): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.update({
        where: {
          id,
        },
        data: {
          processedAt: new Date(),
          processingAt: null,
          brokerMessageId: brokerMessageId ?? null,
          lastError: null,
        },
      }),
    );
  }

  async markSearchOutboxPublishRetry(id: string, attempts: number, errorMessage: string): Promise<void> {
    const backoffSeconds = Math.min(300, 2 ** Math.min(attempts, 8));
    await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.update({
        where: {
          id,
        },
        data: {
          publishAttempts: {
            increment: 1,
          },
          processingAt: null,
          availableAt: new Date(Date.now() + backoffSeconds * 1000),
          lastError: errorMessage.slice(0, 2048),
        },
      }),
    );
  }

  async markSearchOutboxIndexed(id: string): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.update({
        where: {
          id,
        },
        data: {
          indexedAt: new Date(),
          lastError: null,
        },
      }),
    );
  }

  async incrementSearchOutboxAttempt(id: string, errorMessage: string): Promise<number> {
    const updated = await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.update({
        where: {
          id,
        },
        data: {
          attempts: {
            increment: 1,
          },
          lastError: errorMessage.slice(0, 2048),
        },
      }),
    );

    return updated.attempts;
  }

  async markSearchOutboxDeadLettered(id: string, errorMessage: string): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.update({
        where: {
          id,
        },
        data: {
          deadLetteredAt: new Date(),
          processingAt: null,
          lastError: errorMessage.slice(0, 2048),
        },
      }),
    );
  }

  async getSearchOutboxById(id: string): Promise<PostingSearchOutboxRecord | null> {
    const outbox = await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.findUnique({
        where: {
          id,
        },
      }),
    );

    return outbox ? this.mapOutbox(outbox) : null;
  }

  async enqueueSearchSync(postingId: string, operation: "upsert" | "delete" = "upsert"): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.$transaction(async (transaction) => {
        await this.enqueueOutbox(transaction, postingId, operation);
      }),
    );
  }

  async createSearchReindexRun(targetIndexName: string): Promise<SearchReindexRunRecord> {
    const run = await this.executeAsync(() =>
      this.prisma.searchReindexRun.create({
        data: {
          id: randomUUID(),
          status: "pending",
          targetIndexName,
          sourceSnapshotAt: new Date(),
        },
      }),
    );

    return this.mapSearchReindexRun(run);
  }

  async findSearchReindexRunById(id: string): Promise<SearchReindexRunRecord | null> {
    const run = await this.executeAsync(() =>
      this.prisma.searchReindexRun.findUnique({
        where: {
          id,
        },
      }),
    );

    return run ? this.mapSearchReindexRun(run) : null;
  }

  async findActiveSearchReindexRun(): Promise<SearchReindexRunRecord | null> {
    const run = await this.executeAsync(() =>
      this.prisma.searchReindexRun.findFirst({
        where: {
          status: {
            in: ["pending", "running", "waiting_for_catchup"],
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
      }),
    );

    return run ? this.mapSearchReindexRun(run) : null;
  }

  async claimNextSearchReindexRun(): Promise<SearchReindexRunRecord | null> {
    return this.executeAsync(async () => {
      const now = new Date();
      const staleProcessingThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const candidate = await this.prisma.searchReindexRun.findFirst({
        where: {
          status: {
            in: ["pending", "running", "waiting_for_catchup"],
          },
          OR: [
            {
              processingAt: null,
            },
            {
              processingAt: {
                lt: staleProcessingThreshold,
              },
            },
          ],
        },
        orderBy: [
          {
            createdAt: "asc",
          },
        ],
      });

      if (!candidate) {
        return null;
      }

      const result = await this.prisma.searchReindexRun.updateMany({
        where: {
          id: candidate.id,
          OR: [
            {
              processingAt: null,
            },
            {
              processingAt: {
                lt: staleProcessingThreshold,
              },
            },
          ],
        },
        data: {
          processingAt: now,
        },
      });

      if (result.count !== 1) {
        return null;
      }

      return this.mapSearchReindexRun({
        ...candidate,
        processingAt: now,
      });
    });
  }

  async markSearchReindexRunRunning(id: string, totalPostings: number): Promise<SearchReindexRunRecord> {
    const run = await this.executeAsync(() =>
      this.prisma.searchReindexRun.update({
        where: {
          id,
        },
        data: {
          status: "running",
          totalPostings,
          startedAt: new Date(),
          lastError: null,
        },
      }),
    );

    return this.mapSearchReindexRun(run);
  }

  async updateSearchReindexRunProgress(
    id: string,
    input: {
      indexedPostings: number;
      failedPostings?: number;
    },
  ): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.searchReindexRun.update({
        where: {
          id,
        },
        data: {
          indexedPostings: input.indexedPostings,
          ...(input.failedPostings !== undefined
            ? {
                failedPostings: input.failedPostings,
              }
            : {}),
        },
      }),
    );
  }

  async enqueueSearchReindexBarrier(
    reindexRunId: string,
    targetIndexName: string,
  ): Promise<PostingSearchOutboxRecord> {
    return this.executeAsync(async () =>
      this.prisma.$transaction(async (transaction) => {
        const barrierId = randomUUID();

        const created = await transaction.postingSearchOutbox.create({
          data: {
            id: barrierId,
            reindexRunId,
            operation: "barrier",
            dedupeKey: barrierId,
            targetIndexName,
          },
        });

        await transaction.searchReindexRun.update({
          where: {
            id: reindexRunId,
          },
          data: {
            status: "waiting_for_catchup",
            barrierOutboxId: barrierId,
          },
        });

        return this.mapOutbox(created);
      }),
    );
  }

  async isSearchReindexRunCaughtUp(id: string): Promise<boolean> {
    return this.executeAsync(async () => {
      const run = await this.prisma.searchReindexRun.findUnique({
        where: {
          id,
        },
        select: {
          barrierOutboxId: true,
        },
      });

      if (!run?.barrierOutboxId) {
        return false;
      }

      const barrier = await this.prisma.postingSearchOutbox.findUnique({
        where: {
          id: run.barrierOutboxId,
        },
        select: {
          createdAt: true,
          indexedAt: true,
          deadLetteredAt: true,
        },
      });

      if (!barrier || barrier.deadLetteredAt || !barrier.indexedAt) {
        return false;
      }

      const remaining = await this.prisma.postingSearchOutbox.count({
        where: {
          reindexRunId: id,
          deadLetteredAt: null,
          indexedAt: null,
          createdAt: {
            lte: barrier.createdAt,
          },
        },
      });

      return remaining === 0;
    });
  }

  async markSearchReindexRunCompleted(
    id: string,
    retainedIndexName?: string,
  ): Promise<SearchReindexRunRecord> {
    const run = await this.executeAsync(() =>
      this.prisma.searchReindexRun.update({
        where: {
          id,
        },
        data: {
          status: "completed",
          retainedIndexName: retainedIndexName ?? null,
          completedAt: new Date(),
          processingAt: null,
          lastError: null,
        },
      }),
    );

    return this.mapSearchReindexRun(run);
  }

  async markSearchReindexRunFailed(id: string, errorMessage: string): Promise<SearchReindexRunRecord> {
    const run = await this.executeAsync(() =>
      this.prisma.searchReindexRun.update({
        where: {
          id,
        },
        data: {
          status: "failed",
          failedAt: new Date(),
          processingAt: null,
          lastError: errorMessage.slice(0, 2048),
        },
      }),
    );

    return this.mapSearchReindexRun(run);
  }

  async countPublishedPostingsForIndexing(): Promise<number> {
    return this.executeAsync(() =>
      this.prisma.posting.count({
        where: {
          status: "published",
          archivedAt: null,
        },
      }),
    );
  }

  async listPublishedForIndexingBatch(
    limit: number,
    cursorId?: string,
  ): Promise<PostingSearchDocument[]> {
    const postings = await this.executeAsync(() =>
      this.prisma.posting.findMany({
        where: {
          status: "published",
          archivedAt: null,
        },
        orderBy: {
          id: "asc",
        },
        take: limit,
        ...(cursorId
          ? {
              cursor: {
                id: cursorId,
              },
              skip: 1,
            }
          : {}),
        include: postingInclude,
      }),
    );

    return postings.map((posting) => this.mapSearchDocument(posting));
  }

  async getPendingSearchOutboxCount(): Promise<number> {
    return this.executeAsync(() =>
      this.prisma.postingSearchOutbox.count({
        where: {
          indexedAt: null,
          deadLetteredAt: null,
        },
      }),
    );
  }

  private createFallbackOrderBy(
    input: SearchPostingsInput,
    distanceExpression: Prisma.Sql | null,
  ): Prisma.Sql {
    switch (input.sort) {
      case "dailyPrice":
        return Prisma.sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(pricing, '$.daily.amount')) AS DECIMAL(18, 2)) ASC, published_at DESC, created_at DESC`;
      case "nearest":
        if (distanceExpression) {
          return Prisma.sql`${distanceExpression} ASC, published_at DESC, created_at DESC`;
        }

        return Prisma.sql`published_at DESC, created_at DESC`;
      case "newest":
        return Prisma.sql`published_at DESC, created_at DESC`;
      case "relevance":
      default:
        if (input.query) {
          const likeValue = `%${input.query}%`;

          return Prisma.sql`(
            CASE WHEN name LIKE ${likeValue} THEN 6 ELSE 0 END
            + CASE WHEN CAST(tags AS CHAR) LIKE ${likeValue} THEN 3 ELSE 0 END
            + CASE WHEN description LIKE ${likeValue} THEN 2 ELSE 0 END
            + CASE WHEN city LIKE ${likeValue} THEN 2 ELSE 0 END
            + CASE WHEN region LIKE ${likeValue} THEN 1 ELSE 0 END
            + CASE WHEN country LIKE ${likeValue} THEN 1 ELSE 0 END
          ) DESC, published_at DESC, created_at DESC`;
        }

        return Prisma.sql`published_at DESC, created_at DESC`;
    }
  }

  private async enqueueOutbox(
    transaction: Prisma.TransactionClient,
    postingId: string,
    operation: "upsert" | "delete",
  ): Promise<void> {
    const activeRun = await transaction.searchReindexRun.findFirst({
      where: {
        status: {
          in: ["pending", "running", "waiting_for_catchup"],
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      select: {
        id: true,
        targetIndexName: true,
      },
    });
    const primaryEventId = randomUUID();
    const entries: Prisma.PostingSearchOutboxCreateManyInput[] = [
      {
        id: primaryEventId,
        postingId,
        operation,
        dedupeKey: primaryEventId,
      },
    ];

    if (activeRun) {
      const secondaryEventId = randomUUID();
      entries.push({
        id: secondaryEventId,
        postingId,
        reindexRunId: activeRun.id,
        operation,
        dedupeKey: secondaryEventId,
        targetIndexName: activeRun.targetIndexName,
      });
    }

    await transaction.postingSearchOutbox.createMany({
      data: entries,
    });
  }

  private async syncOwnerPostingCounts(
    transaction: Prisma.TransactionClient,
    ownerId: string,
  ): Promise<void> {
    const [totalPostings, availablePostings] = await Promise.all([
      transaction.posting.count({
        where: {
          ownerId,
          status: {
            in: ["draft", "published"],
          },
        },
      }),
      transaction.posting.count({
        where: {
          ownerId,
          status: "published",
          availabilityStatus: {
            in: ["available", "limited"],
          },
          archivedAt: null,
        },
      }),
    ]);

    await transaction.profile.updateMany({
      where: {
        userId: ownerId,
      },
      data: {
        rentPostingsCount: totalPostings,
        availableRentPostingsCount: availablePostings,
      },
    });
  }

  private toCreateData(input: UpsertPostingInput): Prisma.PostingCreateInput {
    return {
      id: randomUUID(),
      owner: {
        connect: {
          id: input.ownerId,
        },
      },
      status: "draft",
      family: input.variant.family,
      subtype: input.variant.subtype,
      name: input.name,
      description: input.description,
      pricingCurrency: input.pricing.currency,
      pricing: input.pricing as Prisma.InputJsonValue,
      tags: input.tags as Prisma.InputJsonValue,
      attributes: input.attributes as Prisma.InputJsonValue,
      availabilityStatus: input.availabilityStatus,
      availabilityNotes: input.availabilityNotes ?? null,
      maxBookingDurationDays: input.maxBookingDurationDays ?? null,
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      city: input.location.city,
      region: input.location.region,
      country: input.location.country,
      postalCode: input.location.postalCode ?? null,
      photos: {
        create: input.photos.map((photo) => ({
          id: randomUUID(),
          blobUrl: photo.blobUrl,
          blobName: photo.blobName,
          position: photo.position,
        })),
      },
      availabilityBlocks: {
        create: input.availabilityBlocks.map((block) => ({
          id: randomUUID(),
          startAt: new Date(block.startAt),
          endAt: new Date(block.endAt),
          note: block.note ?? null,
        })),
      },
    };
  }

  private toUpdateData(input: UpsertPostingInput): Prisma.PostingUpdateInput {
    return {
      family: input.variant.family,
      subtype: input.variant.subtype,
      name: input.name,
      description: input.description,
      pricingCurrency: input.pricing.currency,
      pricing: input.pricing as Prisma.InputJsonValue,
      tags: input.tags as Prisma.InputJsonValue,
      attributes: input.attributes as Prisma.InputJsonValue,
      availabilityStatus: input.availabilityStatus,
      availabilityNotes: input.availabilityNotes ?? null,
      maxBookingDurationDays: input.maxBookingDurationDays ?? null,
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      city: input.location.city,
      region: input.location.region,
      country: input.location.country,
      postalCode: input.location.postalCode ?? null,
      photos: {
        deleteMany: {},
        create: input.photos.map((photo) => ({
          id: randomUUID(),
          blobUrl: photo.blobUrl,
          blobName: photo.blobName,
          position: photo.position,
        })),
      },
      availabilityBlocks: {
        deleteMany: {},
        create: input.availabilityBlocks.map((block) => ({
          id: randomUUID(),
          startAt: new Date(block.startAt),
          endAt: new Date(block.endAt),
          note: block.note ?? null,
        })),
      },
    };
  }

  private mapPosting(posting: PostingPersistence): PostingRecord {
    const pricing = posting.pricing as PostingPricing;
    const tags = Array.isArray(posting.tags) ? (posting.tags as string[]) : [];
    const attributes = (posting.attributes ?? {}) as Record<string, PostingAttributeValue>;
    const now = Date.now();
    const availabilityBlocks = posting.availabilityBlocks
      .filter((block) => {
        if (!block.bookingRequestHold) {
          return true;
        }

        return (
          ["awaiting_payment", "payment_processing", "paid"].includes(
            block.bookingRequestHold.status,
          ) &&
          !block.bookingRequestHold.convertedAt &&
          block.bookingRequestHold.holdExpiresAt.getTime() > now
        );
      })
      .map(
        (block): PostingAvailabilityBlockRecord => ({
          id: block.id,
          startAt: block.startAt.toISOString(),
          endAt: block.endAt.toISOString(),
          note: block.note ?? undefined,
          createdAt: block.createdAt.toISOString(),
          updatedAt: block.updatedAt.toISOString(),
        }),
      );

    return {
      id: posting.id,
      ownerId: posting.ownerId,
      status: posting.status as PostingStatus,
      variant: {
        family: posting.family,
        subtype: posting.subtype as PostingSubtype,
      },
      name: posting.name,
      description: posting.description,
      pricing,
      pricingCurrency: posting.pricingCurrency,
      photos: posting.photos.map((photo): PostingPhotoRecord => ({
        id: photo.id,
        blobUrl: photo.blobUrl,
        blobName: photo.blobName,
        position: photo.position,
        createdAt: photo.createdAt.toISOString(),
        updatedAt: photo.updatedAt.toISOString(),
      })),
      tags,
      attributes,
      availabilityStatus: posting.availabilityStatus as PostingAvailabilityStatus,
      availabilityNotes: posting.availabilityNotes ?? undefined,
      maxBookingDurationDays: posting.maxBookingDurationDays ?? undefined,
      effectiveMaxBookingDurationDays:
        posting.maxBookingDurationDays ?? DEFAULT_MAX_BOOKING_DURATION_DAYS,
      availabilityBlocks,
      location: {
        latitude: posting.latitude,
        longitude: posting.longitude,
        city: posting.city,
        region: posting.region,
        country: posting.country,
        postalCode: posting.postalCode ?? undefined,
      },
      publishedAt: posting.publishedAt?.toISOString(),
      archivedAt: posting.archivedAt?.toISOString(),
      createdAt: posting.createdAt.toISOString(),
      updatedAt: posting.updatedAt.toISOString(),
    };
  }

  private mapPublicPosting(posting: PostingPersistence): PublicPostingRecord {
    const record = this.mapPosting(posting);

    return {
      ...record,
      location: {
        city: record.location.city,
        region: record.location.region,
        country: record.location.country,
        postalCode: record.location.postalCode,
        latitude: this.roundCoordinate(record.location.latitude),
        longitude: this.roundCoordinate(record.location.longitude),
      },
    };
  }

  private mapSearchDocument(posting: PostingPersistence): PostingSearchDocument {
    const attributes = (posting.attributes ?? {}) as Record<string, PostingAttributeValue>;

    return {
      id: posting.id,
      ownerId: posting.ownerId,
      status: posting.status as PostingStatus,
      variant: {
        family: posting.family,
        subtype: posting.subtype as PostingSubtype,
      },
      name: posting.name,
      description: posting.description,
      tags: Array.isArray(posting.tags) ? (posting.tags as string[]) : [],
      availabilityStatus: posting.availabilityStatus as PostingAvailabilityStatus,
      searchableAttributes: this.extractSearchableAttributes(
        posting.family,
        posting.subtype as PostingSubtype,
        attributes,
      ),
      pricing: posting.pricing as PostingPricing,
      pricingCurrency: posting.pricingCurrency,
      location: {
        latitude: posting.latitude,
        longitude: posting.longitude,
        city: posting.city,
        region: posting.region,
        country: posting.country,
        postalCode: posting.postalCode ?? undefined,
      },
      photos: posting.photos.map((photo) => ({
        blobUrl: photo.blobUrl,
        position: photo.position,
      })),
      blockedRanges: this.collectBlockedRanges(posting),
      createdAt: posting.createdAt.toISOString(),
      updatedAt: posting.updatedAt.toISOString(),
      publishedAt: posting.publishedAt?.toISOString(),
    };
  }

  private collectBlockedRanges(posting: PostingPersistence): PostingSearchDocument["blockedRanges"] {
    const now = Date.now();

    const availabilityBlockRanges = posting.availabilityBlocks
      .filter((block) => {
        if (!block.bookingRequestHold) {
          return true;
        }

        return (
          ["awaiting_payment", "payment_processing", "paid"].includes(
            block.bookingRequestHold.status,
          ) &&
          !block.bookingRequestHold.convertedAt &&
          block.bookingRequestHold.holdExpiresAt.getTime() > now
        );
      })
      .map((block) => ({
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        source: "availability_block" as const,
      }));

    const bookingRequestRanges = posting.bookingRequests
      .filter((bookingRequest) => {
        if (!["pending", "awaiting_payment", "payment_processing", "paid"].includes(bookingRequest.status)) {
          return false;
        }

        if (bookingRequest.convertedAt) {
          return false;
        }

        if (bookingRequest.holdExpiresAt.getTime() <= now) {
          return false;
        }

        return (
          !bookingRequest.conversionReservationExpiresAt ||
          bookingRequest.conversionReservationExpiresAt.getTime() <= now
        );
      })
      .map((bookingRequest) => ({
        startAt: bookingRequest.startAt.toISOString(),
        endAt: bookingRequest.endAt.toISOString(),
        source: "booking_request" as const,
      }));

    const rentingRanges = posting.rentings.map((renting) => ({
      startAt: renting.startAt.toISOString(),
      endAt: renting.endAt.toISOString(),
      source: "renting" as const,
    }));

    return [...availabilityBlockRanges, ...bookingRequestRanges, ...rentingRanges];
  }

  private extractSearchableAttributes(
    family: PostingRecord["variant"]["family"],
    subtype: PostingRecord["variant"]["subtype"],
    attributes: Record<string, PostingAttributeValue>,
  ): Record<string, PostingAttributeValue> {
    const definitions = getPostingSearchableAttributeDefinitions(family, subtype);

    if (!definitions) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(attributes).filter(([key]) => definitions[key] !== undefined),
    );
  }

  private mapOutbox(
    outbox: Prisma.PostingSearchOutboxGetPayload<object>,
    processingAt?: Date,
  ): PostingSearchOutboxRecord {
    return {
      id: outbox.id,
      postingId: outbox.postingId ?? undefined,
      reindexRunId: outbox.reindexRunId ?? undefined,
      operation: outbox.operation,
      dedupeKey: outbox.dedupeKey,
      targetIndexName: outbox.targetIndexName ?? undefined,
      attempts: outbox.attempts,
      publishAttempts: outbox.publishAttempts,
      availableAt: outbox.availableAt.toISOString(),
      processingAt: (processingAt ?? outbox.processingAt ?? undefined)?.toISOString(),
      publishedAt: outbox.processedAt?.toISOString(),
      indexedAt: outbox.indexedAt?.toISOString(),
      deadLetteredAt: outbox.deadLetteredAt?.toISOString(),
      brokerMessageId: outbox.brokerMessageId ?? undefined,
      lastError: outbox.lastError ?? undefined,
      createdAt: outbox.createdAt.toISOString(),
      updatedAt: outbox.updatedAt.toISOString(),
    };
  }

  private mapSearchReindexRun(
    run: Prisma.SearchReindexRunGetPayload<object>,
  ): SearchReindexRunRecord {
    return {
      id: run.id,
      status: run.status as SearchReindexStatus,
      targetIndexName: run.targetIndexName,
      retainedIndexName: run.retainedIndexName ?? undefined,
      sourceSnapshotAt: run.sourceSnapshotAt.toISOString(),
      barrierOutboxId: run.barrierOutboxId ?? undefined,
      totalPostings: run.totalPostings,
      indexedPostings: run.indexedPostings,
      failedPostings: run.failedPostings,
      startedAt: run.startedAt?.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      failedAt: run.failedAt?.toISOString(),
      processingAt: run.processingAt?.toISOString(),
      lastError: run.lastError ?? undefined,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  }

  private roundCoordinate(value: number): number {
    return Number(value.toFixed(PUBLIC_LOCATION_PRECISION));
  }

  private createPagination(page: number, pageSize: number, total: number) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  private orderBatchResult<TRecord extends { id: string }>(
    ids: string[],
    records: TRecord[],
  ): BatchPostingsResult<TRecord> {
    const byId = new Map(records.map((record) => [record.id, record]));
    const orderedRecords: TRecord[] = [];
    const missingIds: string[] = [];

    for (const id of ids) {
      const record = byId.get(id);

      if (!record) {
        missingIds.push(id);
        continue;
      }

      orderedRecords.push(record);
    }

    return {
      postings: orderedRecords,
      missingIds,
    };
  }
}

