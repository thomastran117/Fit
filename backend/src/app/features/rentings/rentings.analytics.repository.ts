import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import type {
  EnqueueRentingViewedEventInput,
  ListRentingAnalyticsInput,
  OwnerRentingsAnalyticsSummary,
  ProcessRentingViewedEventInput,
  RentingAnalyticsBucket,
  RentingAnalyticsDetail,
  RentingAnalyticsDetailInput,
  RentingAnalyticsListItem,
  RentingAnalyticsListResult,
  RentingAnalyticsMetrics,
  RentingAnalyticsOutboxRecord,
  RentingAnalyticsSummaryInput,
  RentingAnalyticsWindow,
} from "@/features/rentings/rentings.analytics.model";

interface AnalyticsAggregateRow {
  views: bigint | number | null;
  uniqueViews: bigint | number | null;
  bookingRequests: bigint | number | null;
  estimatedRevenue: Prisma.Decimal | number | string | null;
}

interface AnalyticsCountRow {
  total: bigint | number;
}

interface RentingAnalyticsListRow extends AnalyticsAggregateRow {
  rentingId: string;
  name: string;
  status: string;
  primaryPhotoUrl: string | null;
}

interface RentingAnalyticsBucketRow extends AnalyticsAggregateRow {
  bucketStart: Date;
}

interface RentingAnalyticsHeaderRow {
  rentingId: string;
  name: string;
  status: string;
  primaryPhotoUrl: string | null;
}

type AnalyticsOutboxPersistence = Prisma.RentingAnalyticsOutboxGetPayload<object>;

export class RentingsAnalyticsRepository extends BaseRepository {
  async enqueueRentingViewedEvent(input: EnqueueRentingViewedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.rentingAnalyticsOutbox.create({
        data: {
          id: randomUUID(),
          rentingId: input.rentingId,
          ownerId: input.ownerId,
          eventType: "renting_viewed",
          payload: {
            occurredAt: input.occurredAt,
            viewerHash: input.viewerHash,
            userId: input.userId ?? null,
            ipAddressHash: input.ipAddressHash ?? null,
            userAgentHash: input.userAgentHash ?? null,
            deviceType: input.deviceType,
          } as Prisma.InputJsonValue,
        },
      }),
    );
  }

  async claimOutboxBatch(limit: number): Promise<RentingAnalyticsOutboxRecord[]> {
    return this.executeAsync(async () => {
      const now = new Date();
      const staleProcessingThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const candidates = await this.prisma.rentingAnalyticsOutbox.findMany({
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

      const claimed: RentingAnalyticsOutboxRecord[] = [];

      for (const candidate of candidates) {
        const result = await this.prisma.rentingAnalyticsOutbox.updateMany({
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

  async markOutboxProcessed(id: string): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.rentingAnalyticsOutbox.update({
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

  async markOutboxRetry(id: string, attempts: number, errorMessage: string): Promise<void> {
    const backoffSeconds = Math.min(300, 2 ** Math.min(attempts, 8));
    await this.executeAsync(() =>
      this.prisma.rentingAnalyticsOutbox.update({
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

  async processRentingViewedEvent(input: ProcessRentingViewedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.$transaction(async (transaction) => {
        const occurredAt = new Date(input.occurredAt);
        const eventDate = new Date(input.eventDate);
        const eventHour = new Date(input.eventHour);

        await transaction.rentingViewEvent.create({
          data: {
            id: randomUUID(),
            rentingId: input.rentingId,
            ownerId: input.ownerId,
            viewerHash: input.viewerHash,
            userId: input.userId ?? null,
            ipAddressHash: input.ipAddressHash ?? null,
            userAgentHash: input.userAgentHash ?? null,
            deviceType: input.deviceType,
            occurredAt,
            eventDate,
            eventHour,
          },
        });

        const uniqueInsert = await transaction.rentingAnalyticsUniqueView.createMany({
          data: [
            {
              rentingId: input.rentingId,
              ownerId: input.ownerId,
              viewerHash: input.viewerHash,
              eventDate,
            },
          ],
          skipDuplicates: true,
        });
        const uniqueIncrement = uniqueInsert.count > 0 ? 1 : 0;

        await this.upsertHourlyRollup(transaction, input.rentingId, input.ownerId, eventHour, uniqueIncrement);
        await this.upsertDailyRollup(transaction, input.rentingId, input.ownerId, eventDate, uniqueIncrement);
      }),
    );
  }

  async getOwnerSummary(input: RentingAnalyticsSummaryInput): Promise<OwnerRentingsAnalyticsSummary> {
    const tableSql = this.dailyTableSql();
    const range = this.createWindowRange(input.window);
    const whereSql = Prisma.sql`
      owner_id = ${input.ownerId}
      ${range.startAt ? Prisma.sql`AND bucket_start >= ${range.startAt}` : Prisma.empty}
    `;
    const [row] = await this.executeAsync(() =>
      this.prisma.$queryRaw<AnalyticsAggregateRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM(views), 0) AS views,
          COALESCE(SUM(unique_views), 0) AS uniqueViews,
          COALESCE(SUM(booking_requests), 0) AS bookingRequests,
          COALESCE(SUM(estimated_revenue), 0) AS estimatedRevenue
        FROM ${tableSql}
        WHERE ${whereSql}
      `),
    );

    return {
      window: input.window,
      totals: this.mapMetrics(row),
      dataAvailability: this.createDataAvailability(),
      range: this.mapRange(range.startAt, range.endAt),
    };
  }

  async listOwnerRentingsAnalytics(input: ListRentingAnalyticsInput): Promise<RentingAnalyticsListResult> {
    const range = this.createWindowRange(input.window);
    const skip = (input.page - 1) * input.pageSize;
    const tableSql = this.dailyTableSql();
    const whereSql = Prisma.sql`
      ra.owner_id = ${input.ownerId}
      ${range.startAt ? Prisma.sql`AND ra.bucket_start >= ${range.startAt}` : Prisma.empty}
    `;

    const [rows, countRows] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.$queryRaw<RentingAnalyticsListRow[]>(Prisma.sql`
          SELECT
            ra.renting_id AS rentingId,
            r.name AS name,
            r.status AS status,
            (
              SELECT rp.blob_url
              FROM renting_photos rp
              WHERE rp.renting_id = ra.renting_id
              ORDER BY rp.position ASC
              LIMIT 1
            ) AS primaryPhotoUrl,
            COALESCE(SUM(ra.views), 0) AS views,
            COALESCE(SUM(ra.unique_views), 0) AS uniqueViews,
            COALESCE(SUM(ra.booking_requests), 0) AS bookingRequests,
            COALESCE(SUM(ra.estimated_revenue), 0) AS estimatedRevenue
          FROM ${tableSql} ra
          INNER JOIN rentings r ON r.id = ra.renting_id
          WHERE ${whereSql}
          GROUP BY ra.renting_id, r.name, r.status
          ORDER BY views DESC, uniqueViews DESC, r.updated_at DESC
          LIMIT ${input.pageSize}
          OFFSET ${skip}
        `),
        this.prisma.$queryRaw<AnalyticsCountRow[]>(Prisma.sql`
          SELECT COUNT(*) AS total
          FROM (
            SELECT ra.renting_id
            FROM ${tableSql} ra
            WHERE ${whereSql}
            GROUP BY ra.renting_id
          ) AS grouped_rentings
        `),
      ]),
    );

    const total = Number(countRows[0]?.total ?? 0);

    return {
      window: input.window,
      rentings: rows.map((row): RentingAnalyticsListItem => ({
        rentingId: row.rentingId,
        name: row.name,
        status: row.status,
        primaryPhotoUrl: row.primaryPhotoUrl ?? undefined,
        totals: this.mapMetrics(row),
      })),
      pagination: this.createPagination(input.page, input.pageSize, total),
      dataAvailability: this.createDataAvailability(),
      range: this.mapRange(range.startAt, range.endAt),
    };
  }

  async getRentingAnalyticsDetail(
    input: RentingAnalyticsDetailInput,
  ): Promise<RentingAnalyticsDetail | null> {
    const header = await this.findRentingAnalyticsHeader(input.rentingId, input.ownerId);

    if (!header) {
      return null;
    }

    const range = this.createWindowRange(input.window);
    const totalsTable = this.dailyTableSql();
    const detailTable = input.granularity === "hour" ? this.hourlyTableSql() : this.dailyTableSql();
    const whereTotalsSql = Prisma.sql`
      renting_id = ${input.rentingId}
      AND owner_id = ${input.ownerId}
      ${range.startAt ? Prisma.sql`AND bucket_start >= ${range.startAt}` : Prisma.empty}
    `;

    const [totalRows, bucketRows] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.$queryRaw<AnalyticsAggregateRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM(views), 0) AS views,
            COALESCE(SUM(unique_views), 0) AS uniqueViews,
            COALESCE(SUM(booking_requests), 0) AS bookingRequests,
            COALESCE(SUM(estimated_revenue), 0) AS estimatedRevenue
          FROM ${totalsTable}
          WHERE ${whereTotalsSql}
        `),
        this.prisma.$queryRaw<RentingAnalyticsBucketRow[]>(Prisma.sql`
          SELECT
            bucket_start AS bucketStart,
            COALESCE(SUM(views), 0) AS views,
            COALESCE(SUM(unique_views), 0) AS uniqueViews,
            COALESCE(SUM(booking_requests), 0) AS bookingRequests,
            COALESCE(SUM(estimated_revenue), 0) AS estimatedRevenue
          FROM ${detailTable}
          WHERE ${whereTotalsSql}
          GROUP BY bucket_start
          ORDER BY bucket_start ASC
        `),
      ]),
    );

    return {
      rentingId: header.rentingId,
      name: header.name,
      status: header.status,
      primaryPhotoUrl: header.primaryPhotoUrl ?? undefined,
      window: input.window,
      granularity: input.granularity,
      totals: this.mapMetrics(totalRows[0]),
      buckets: bucketRows.map((row): RentingAnalyticsBucket => {
        const startAt = row.bucketStart;
        const endAt = new Date(
          startAt.getTime() +
            (input.granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
        );

        return {
          bucketStart: startAt.toISOString(),
          bucketEnd: endAt.toISOString(),
          granularity: input.granularity,
          metrics: this.mapMetrics(row),
        };
      }),
      dataAvailability: this.createDataAvailability(),
      range: this.mapRange(range.startAt, range.endAt),
    };
  }

  private async findRentingAnalyticsHeader(
    rentingId: string,
    ownerId: string,
  ): Promise<RentingAnalyticsHeaderRow | null> {
    const [row] = await this.executeAsync(() =>
      this.prisma.$queryRaw<RentingAnalyticsHeaderRow[]>(Prisma.sql`
        SELECT
          r.id AS rentingId,
          r.name AS name,
          r.status AS status,
          (
            SELECT rp.blob_url
            FROM renting_photos rp
            WHERE rp.renting_id = r.id
            ORDER BY rp.position ASC
            LIMIT 1
          ) AS primaryPhotoUrl
        FROM rentings r
        WHERE r.id = ${rentingId}
          AND r.owner_id = ${ownerId}
        LIMIT 1
      `),
    );

    return row ?? null;
  }

  private async upsertHourlyRollup(
    transaction: Prisma.TransactionClient,
    rentingId: string,
    ownerId: string,
    bucketStart: Date,
    uniqueIncrement: number,
  ): Promise<void> {
    await transaction.rentingAnalyticsHourly.upsert({
      where: {
        rentingId_bucketStart: {
          rentingId,
          bucketStart,
        },
      },
      update: {
        views: {
          increment: 1,
        },
        uniqueViews: {
          increment: uniqueIncrement,
        },
      },
      create: {
        id: randomUUID(),
        rentingId,
        ownerId,
        bucketStart,
        views: 1,
        uniqueViews: uniqueIncrement,
        bookingRequests: 0,
        estimatedRevenue: new Prisma.Decimal(0),
      },
    });
  }

  private async upsertDailyRollup(
    transaction: Prisma.TransactionClient,
    rentingId: string,
    ownerId: string,
    bucketStart: Date,
    uniqueIncrement: number,
  ): Promise<void> {
    await transaction.rentingAnalyticsDaily.upsert({
      where: {
        rentingId_bucketStart: {
          rentingId,
          bucketStart,
        },
      },
      update: {
        views: {
          increment: 1,
        },
        uniqueViews: {
          increment: uniqueIncrement,
        },
      },
      create: {
        id: randomUUID(),
        rentingId,
        ownerId,
        bucketStart,
        views: 1,
        uniqueViews: uniqueIncrement,
        bookingRequests: 0,
        estimatedRevenue: new Prisma.Decimal(0),
      },
    });
  }

  private dailyTableSql(): Prisma.Sql {
    return Prisma.sql`renting_analytics_daily`;
  }

  private hourlyTableSql(): Prisma.Sql {
    return Prisma.sql`renting_analytics_hourly`;
  }

  private createWindowRange(window: RentingAnalyticsWindow): { startAt?: Date; endAt: Date } {
    const endAt = new Date();

    switch (window) {
      case "7d":
        return {
          startAt: new Date(endAt.getTime() - 7 * 24 * 60 * 60 * 1000),
          endAt,
        };
      case "30d":
        return {
          startAt: new Date(endAt.getTime() - 30 * 24 * 60 * 60 * 1000),
          endAt,
        };
      case "all":
      default:
        return {
          endAt,
        };
    }
  }

  private mapMetrics(row?: AnalyticsAggregateRow): RentingAnalyticsMetrics {
    return {
      views: Number(row?.views ?? 0),
      uniqueViews: Number(row?.uniqueViews ?? 0),
      bookingRequests: Number(row?.bookingRequests ?? 0),
      estimatedRevenue: Number(row?.estimatedRevenue ?? 0),
    };
  }

  private createDataAvailability() {
    return {
      views: "live" as const,
      bookingRequests: "pending" as const,
      estimatedRevenue: "pending" as const,
      isPartial: true,
    };
  }

  private mapRange(startAt: Date | undefined, endAt: Date) {
    return {
      startAt: startAt?.toISOString(),
      endAt: endAt.toISOString(),
    };
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

  private mapOutbox(
    outbox: AnalyticsOutboxPersistence,
    processingAt?: Date,
  ): RentingAnalyticsOutboxRecord {
    return {
      id: outbox.id,
      rentingId: outbox.rentingId,
      ownerId: outbox.ownerId,
      eventType: outbox.eventType,
      payload: (outbox.payload ?? {}) as Record<string, unknown>,
      attempts: outbox.attempts,
      availableAt: outbox.availableAt.toISOString(),
      processingAt: (processingAt ?? outbox.processingAt ?? undefined)?.toISOString(),
      processedAt: outbox.processedAt?.toISOString(),
      lastError: outbox.lastError ?? undefined,
      createdAt: outbox.createdAt.toISOString(),
      updatedAt: outbox.updatedAt.toISOString(),
    };
  }
}
