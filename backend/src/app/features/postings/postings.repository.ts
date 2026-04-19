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
  PostingAvailabilityBlockRecord,
  PostingAvailabilityStatus,
  PostingPhotoRecord,
  PostingPricing,
  PostingRecord,
  PostingSearchDocument,
  PostingSearchOutboxRecord,
  PostingSort,
  PostingStatus,
  SearchPostingsInput,
  UpsertPostingInput,
} from "@/features/postings/postings.model";

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
  };
}>;

interface SearchCountRow {
  total: bigint | number;
}

interface SearchIdRow {
  id: string;
}

const PUBLIC_LOCATION_PRECISION = 2;

export class PostingsRepository extends BaseRepository {
  async create(input: UpsertPostingInput): Promise<PostingRecord> {
    return this.executeAsync(async () => {
      const posting = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.posting.create({
          data: this.toCreateData(input),
          include: {
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
          },
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
            include: {
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
            },
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
            include: {
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
            },
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
            include: {
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
                    },
                  },
                },
              },
            },
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
        include: {
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
        },
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
          include: {
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
          },
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
        include: {
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
        },
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
        include: {
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
        },
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

    const orderBy = this.createFallbackOrderBy(input.sort, distanceExpression);

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
        include: {
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
        },
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

  async markSearchOutboxProcessed(id: string): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.update({
        where: {
          id,
        },
        data: {
          processedAt: new Date(),
          processingAt: null,
          lastError: null,
        },
      }),
    );
  }

  async markSearchOutboxRetry(id: string, attempts: number, errorMessage: string): Promise<void> {
    const backoffSeconds = Math.min(300, 2 ** Math.min(attempts, 8));
    await this.executeAsync(() =>
      this.prisma.postingSearchOutbox.update({
        where: {
          id,
        },
        data: {
          attempts: {
            increment: 1,
          },
          processingAt: null,
          availableAt: new Date(Date.now() + backoffSeconds * 1000),
          lastError: errorMessage.slice(0, 2048),
        },
      }),
    );
  }

  async getPendingSearchOutboxCount(): Promise<number> {
    return this.executeAsync(() =>
      this.prisma.postingSearchOutbox.count({
        where: {
          processedAt: null,
        },
      }),
    );
  }

  private createFallbackOrderBy(
    sort: PostingSort,
    distanceExpression: Prisma.Sql | null,
  ): Prisma.Sql {
    switch (sort) {
      case "dailyPrice":
        return Prisma.sql`CAST(JSON_UNQUOTE(JSON_EXTRACT(pricing, '$.daily.amount')) AS DECIMAL(18, 2)) ASC, published_at DESC, created_at DESC`;
      case "nearest":
        if (distanceExpression) {
          return Prisma.sql`${distanceExpression} ASC, published_at DESC, created_at DESC`;
        }

        return Prisma.sql`published_at DESC, created_at DESC`;
      case "newest":
      case "relevance":
      default:
        return Prisma.sql`published_at DESC, created_at DESC`;
    }
  }

  private async enqueueOutbox(
    transaction: Prisma.TransactionClient,
    postingId: string,
    operation: "upsert" | "delete",
  ): Promise<void> {
    await transaction.postingSearchOutbox.create({
      data: {
        id: randomUUID(),
        postingId,
        operation,
      },
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
    const attributes = (posting.attributes ?? {}) as Record<
      string,
      string | number | boolean | string[]
    >;
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
    return {
      id: posting.id,
      ownerId: posting.ownerId,
      status: posting.status as PostingStatus,
      name: posting.name,
      description: posting.description,
      tags: Array.isArray(posting.tags) ? (posting.tags as string[]) : [],
      attributes: (posting.attributes ?? {}) as Record<
        string,
        string | number | boolean | string[]
      >,
      availabilityStatus: posting.availabilityStatus as PostingAvailabilityStatus,
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
      createdAt: posting.createdAt.toISOString(),
      updatedAt: posting.updatedAt.toISOString(),
      publishedAt: posting.publishedAt?.toISOString(),
    };
  }

  private mapOutbox(
    outbox: Prisma.PostingSearchOutboxGetPayload<object>,
    processingAt?: Date,
  ): PostingSearchOutboxRecord {
    return {
      id: outbox.id,
      postingId: outbox.postingId,
      operation: outbox.operation,
      attempts: outbox.attempts,
      availableAt: outbox.availableAt.toISOString(),
      processingAt: (processingAt ?? outbox.processingAt ?? undefined)?.toISOString(),
      processedAt: outbox.processedAt?.toISOString(),
      lastError: outbox.lastError ?? undefined,
      createdAt: outbox.createdAt.toISOString(),
      updatedAt: outbox.updatedAt.toISOString(),
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

