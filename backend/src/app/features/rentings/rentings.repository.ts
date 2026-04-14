import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import type {
  BatchPublicRentingsInput,
  BatchRentingsResult,
  BatchOwnerRentingsInput,
  ListOwnerRentingsInput,
  ListOwnerRentingsResult,
  PublicRentingRecord,
  RentingAvailabilityBlockRecord,
  RentingAvailabilityStatus,
  RentingPhotoRecord,
  RentingPricing,
  RentingRecord,
  RentingSearchDocument,
  RentingSearchOutboxRecord,
  RentingSort,
  RentingStatus,
  SearchRentingsInput,
  UpsertRentingInput,
} from "@/features/rentings/rentings.model";

type RentingPersistence = Prisma.RentingGetPayload<{
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

export class RentingsRepository extends BaseRepository {
  async create(input: UpsertRentingInput): Promise<RentingRecord> {
    return this.executeAsync(async () => {
      const renting = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.renting.create({
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
            },
          },
        });

        await this.enqueueOutbox(transaction, created.id, "upsert");
        await this.syncOwnerPostingCounts(transaction, input.ownerId);

        return created;
      });

      return this.mapRenting(renting);
    });
  }

  async update(id: string, input: UpsertRentingInput): Promise<RentingRecord | null> {
    return this.executeAsync(async () => {
      try {
        const renting = await this.prisma.$transaction(async (transaction) => {
          const updated = await transaction.renting.update({
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

        return this.mapRenting(renting);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    });
  }

  async publish(id: string, ownerId: string): Promise<RentingRecord | null> {
    return this.executeAsync(async () => {
      try {
        const renting = await this.prisma.$transaction(async (transaction) => {
          const updated = await transaction.renting.update({
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
              },
            },
          });

          await this.enqueueOutbox(transaction, updated.id, "upsert");
          await this.syncOwnerPostingCounts(transaction, ownerId);

          return updated;
        });

        return this.mapRenting(renting);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    });
  }

  async archive(id: string, ownerId: string): Promise<RentingRecord | null> {
    return this.executeAsync(async () => {
      try {
        const renting = await this.prisma.$transaction(async (transaction) => {
          const updated = await transaction.renting.update({
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
              },
            },
          });

          await this.enqueueOutbox(transaction, updated.id, "delete");
          await this.syncOwnerPostingCounts(transaction, ownerId);

          return updated;
        });

        return this.mapRenting(renting);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    });
  }

  async findById(id: string): Promise<RentingRecord | null> {
    const renting = await this.executeAsync(() =>
      this.prisma.renting.findUnique({
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
          },
        },
      }),
    );

    return renting ? this.mapRenting(renting) : null;
  }

  async listByOwner(input: ListOwnerRentingsInput): Promise<ListOwnerRentingsResult> {
    const where: Prisma.RentingWhereInput = {
      ownerId: input.ownerId,
      ...(input.status ? { status: input.status } : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [rentings, total] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.renting.findMany({
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
            },
          },
        }),
        this.prisma.renting.count({
          where,
        }),
      ]),
    );

    return {
      rentings: rentings.map((renting) => this.mapRenting(renting)),
      pagination: this.createPagination(input.page, input.pageSize, total),
      ...(input.status ? { status: input.status } : {}),
    };
  }

  async batchFindByOwner(
    input: BatchOwnerRentingsInput,
  ): Promise<BatchRentingsResult<RentingRecord>> {
    const rentings = await this.executeAsync(() =>
      this.prisma.renting.findMany({
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
          },
        },
      }),
    );

    const mapped = rentings.map((renting) => this.mapRenting(renting));
    return this.orderBatchResult(input.ids, mapped);
  }

  async batchFindPublic(
    input: BatchPublicRentingsInput,
  ): Promise<BatchRentingsResult<PublicRentingRecord>> {
    const rentings = await this.executeAsync(() =>
      this.prisma.renting.findMany({
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
          },
        },
      }),
    );

    const mapped = rentings.map((renting) => this.mapPublicRenting(renting));
    return this.orderBatchResult(input.ids, mapped);
  }

  async searchPublicFallback(input: SearchRentingsInput): Promise<{
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
          Prisma.sql`SELECT COUNT(*) AS total FROM rentings WHERE ${whereSql}`,
        ),
        this.prisma.$queryRaw<SearchIdRow[]>(
          Prisma.sql`
            SELECT id
            FROM rentings
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

  async findByIdsForIndexing(ids: string[]): Promise<RentingSearchDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    const rentings = await this.executeAsync(() =>
      this.prisma.renting.findMany({
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
          },
        },
      }),
    );

    return rentings.map((renting) => this.mapSearchDocument(renting));
  }

  async claimSearchOutboxBatch(limit: number): Promise<RentingSearchOutboxRecord[]> {
    return this.executeAsync(async () => {
      const now = new Date();
      const staleProcessingThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const candidates = await this.prisma.rentingSearchOutbox.findMany({
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

      const claimed: RentingSearchOutboxRecord[] = [];

      for (const candidate of candidates) {
        const result = await this.prisma.rentingSearchOutbox.updateMany({
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
      this.prisma.rentingSearchOutbox.update({
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
      this.prisma.rentingSearchOutbox.update({
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
      this.prisma.rentingSearchOutbox.count({
        where: {
          processedAt: null,
        },
      }),
    );
  }

  private createFallbackOrderBy(
    sort: RentingSort,
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
    rentingId: string,
    operation: "upsert" | "delete",
  ): Promise<void> {
    await transaction.rentingSearchOutbox.create({
      data: {
        id: randomUUID(),
        rentingId,
        operation,
      },
    });
  }

  private async syncOwnerPostingCounts(
    transaction: Prisma.TransactionClient,
    ownerId: string,
  ): Promise<void> {
    const [totalRentings, availableRentings] = await Promise.all([
      transaction.renting.count({
        where: {
          ownerId,
          status: {
            in: ["draft", "published"],
          },
        },
      }),
      transaction.renting.count({
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
        rentPostingsCount: totalRentings,
        availableRentPostingsCount: availableRentings,
      },
    });
  }

  private toCreateData(input: UpsertRentingInput): Prisma.RentingCreateInput {
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

  private toUpdateData(input: UpsertRentingInput): Prisma.RentingUpdateInput {
    return {
      name: input.name,
      description: input.description,
      pricingCurrency: input.pricing.currency,
      pricing: input.pricing as Prisma.InputJsonValue,
      tags: input.tags as Prisma.InputJsonValue,
      attributes: input.attributes as Prisma.InputJsonValue,
      availabilityStatus: input.availabilityStatus,
      availabilityNotes: input.availabilityNotes ?? null,
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

  private mapRenting(renting: RentingPersistence): RentingRecord {
    const pricing = renting.pricing as RentingPricing;
    const tags = Array.isArray(renting.tags) ? (renting.tags as string[]) : [];
    const attributes = (renting.attributes ?? {}) as Record<
      string,
      string | number | boolean | string[]
    >;

    return {
      id: renting.id,
      ownerId: renting.ownerId,
      status: renting.status as RentingStatus,
      name: renting.name,
      description: renting.description,
      pricing,
      pricingCurrency: renting.pricingCurrency,
      photos: renting.photos.map((photo): RentingPhotoRecord => ({
        id: photo.id,
        blobUrl: photo.blobUrl,
        blobName: photo.blobName,
        position: photo.position,
        createdAt: photo.createdAt.toISOString(),
        updatedAt: photo.updatedAt.toISOString(),
      })),
      tags,
      attributes,
      availabilityStatus: renting.availabilityStatus as RentingAvailabilityStatus,
      availabilityNotes: renting.availabilityNotes ?? undefined,
      availabilityBlocks: renting.availabilityBlocks.map(
        (block): RentingAvailabilityBlockRecord => ({
          id: block.id,
          startAt: block.startAt.toISOString(),
          endAt: block.endAt.toISOString(),
          note: block.note ?? undefined,
          createdAt: block.createdAt.toISOString(),
          updatedAt: block.updatedAt.toISOString(),
        }),
      ),
      location: {
        latitude: renting.latitude,
        longitude: renting.longitude,
        city: renting.city,
        region: renting.region,
        country: renting.country,
        postalCode: renting.postalCode ?? undefined,
      },
      publishedAt: renting.publishedAt?.toISOString(),
      archivedAt: renting.archivedAt?.toISOString(),
      createdAt: renting.createdAt.toISOString(),
      updatedAt: renting.updatedAt.toISOString(),
    };
  }

  private mapPublicRenting(renting: RentingPersistence): PublicRentingRecord {
    const record = this.mapRenting(renting);

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

  private mapSearchDocument(renting: RentingPersistence): RentingSearchDocument {
    return {
      id: renting.id,
      ownerId: renting.ownerId,
      status: renting.status as RentingStatus,
      name: renting.name,
      description: renting.description,
      tags: Array.isArray(renting.tags) ? (renting.tags as string[]) : [],
      attributes: (renting.attributes ?? {}) as Record<
        string,
        string | number | boolean | string[]
      >,
      availabilityStatus: renting.availabilityStatus as RentingAvailabilityStatus,
      pricing: renting.pricing as RentingPricing,
      pricingCurrency: renting.pricingCurrency,
      location: {
        latitude: renting.latitude,
        longitude: renting.longitude,
        city: renting.city,
        region: renting.region,
        country: renting.country,
        postalCode: renting.postalCode ?? undefined,
      },
      photos: renting.photos.map((photo) => ({
        blobUrl: photo.blobUrl,
        position: photo.position,
      })),
      createdAt: renting.createdAt.toISOString(),
      updatedAt: renting.updatedAt.toISOString(),
      publishedAt: renting.publishedAt?.toISOString(),
    };
  }

  private mapOutbox(
    outbox: Prisma.RentingSearchOutboxGetPayload<object>,
    processingAt?: Date,
  ): RentingSearchOutboxRecord {
    return {
      id: outbox.id,
      rentingId: outbox.rentingId,
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
  ): BatchRentingsResult<TRecord> {
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
      rentings: orderedRecords,
      missingIds,
    };
  }
}
