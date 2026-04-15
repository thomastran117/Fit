import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import type {
  EnqueueBookingRequestedEventInput,
  EnqueueRentingConfirmedEventInput,
  EnqueuePostingViewedEventInput,
  ListPostingAnalyticsInput,
  OwnerPostingsAnalyticsSummary,
  ProcessBookingRequestedEventInput,
  ProcessRentingConfirmedEventInput,
  ProcessPostingViewedEventInput,
  PostingAnalyticsBucket,
  PostingAnalyticsDetail,
  PostingAnalyticsDetailInput,
  PostingAnalyticsListItem,
  PostingAnalyticsListResult,
  PostingAnalyticsMetrics,
  PostingAnalyticsOutboxRecord,
  PostingAnalyticsSummaryInput,
  PostingAnalyticsWindow,
} from "@/features/postings/postings.analytics.model";

interface AnalyticsAggregateRow {
  views: bigint | number | null;
  uniqueViews: bigint | number | null;
  bookingRequests: bigint | number | null;
  confirmedBookings: bigint | number | null;
  estimatedRevenue: Prisma.Decimal | number | string | null;
}

interface AnalyticsCountRow {
  total: bigint | number;
}

interface PostingAnalyticsListRow extends AnalyticsAggregateRow {
  postingId: string;
  name: string;
  status: string;
  primaryPhotoUrl: string | null;
}

interface PostingAnalyticsBucketRow extends AnalyticsAggregateRow {
  bucketStart: Date;
}

interface PostingAnalyticsHeaderRow {
  postingId: string;
  name: string;
  status: string;
  primaryPhotoUrl: string | null;
}

type AnalyticsOutboxPersistence = Prisma.PostingAnalyticsOutboxGetPayload<object>;

export class PostingsAnalyticsRepository extends BaseRepository {
  async enqueuePostingViewedEvent(input: EnqueuePostingViewedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.postingAnalyticsOutbox.create({
        data: {
          id: randomUUID(),
          postingId: input.postingId,
          ownerId: input.ownerId,
          eventType: "posting_viewed",
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

  async enqueueBookingRequestedEvent(input: EnqueueBookingRequestedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.postingAnalyticsOutbox.create({
        data: {
          id: randomUUID(),
          postingId: input.postingId,
          ownerId: input.ownerId,
          eventType: "booking_requested",
          payload: {
            occurredAt: input.occurredAt,
            estimatedTotal: input.estimatedTotal,
          } as Prisma.InputJsonValue,
        },
      }),
    );
  }

  async enqueueRentingConfirmedEvent(input: EnqueueRentingConfirmedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.postingAnalyticsOutbox.create({
        data: {
          id: randomUUID(),
          postingId: input.postingId,
          ownerId: input.ownerId,
          eventType: "booking_accepted",
          payload: {
            occurredAt: input.occurredAt,
            estimatedTotal: input.estimatedTotal,
          } as Prisma.InputJsonValue,
        },
      }),
    );
  }

  async claimOutboxBatch(limit: number): Promise<PostingAnalyticsOutboxRecord[]> {
    return this.executeAsync(async () => {
      const now = new Date();
      const staleProcessingThreshold = new Date(now.getTime() - 5 * 60 * 1000);
      const candidates = await this.prisma.postingAnalyticsOutbox.findMany({
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

      const claimed: PostingAnalyticsOutboxRecord[] = [];

      for (const candidate of candidates) {
        const result = await this.prisma.postingAnalyticsOutbox.updateMany({
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
      this.prisma.postingAnalyticsOutbox.update({
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
      this.prisma.postingAnalyticsOutbox.update({
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

  async processPostingViewedEvent(input: ProcessPostingViewedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.$transaction(async (transaction) => {
        const occurredAt = new Date(input.occurredAt);
        const eventDate = new Date(input.eventDate);
        const eventHour = new Date(input.eventHour);

        await transaction.postingViewEvent.create({
          data: {
            id: randomUUID(),
            postingId: input.postingId,
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

        const uniqueInsert = await transaction.postingAnalyticsUniqueView.createMany({
          data: [
            {
              postingId: input.postingId,
              ownerId: input.ownerId,
              viewerHash: input.viewerHash,
              eventDate,
            },
          ],
          skipDuplicates: true,
        });
        const uniqueIncrement = uniqueInsert.count > 0 ? 1 : 0;

        await this.upsertHourlyRollup(transaction, input.postingId, input.ownerId, eventHour, uniqueIncrement);
        await this.upsertDailyRollup(transaction, input.postingId, input.ownerId, eventDate, uniqueIncrement);
      }),
    );
  }

  async processBookingRequestedEvent(input: ProcessBookingRequestedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.$transaction(async (transaction) => {
        const eventDate = new Date(input.eventDate);
        const eventHour = new Date(input.eventHour);

        await this.upsertHourlyBookingRequestRollup(
          transaction,
          input.postingId,
          input.ownerId,
          eventHour,
        );
        await this.upsertDailyBookingRequestRollup(
          transaction,
          input.postingId,
          input.ownerId,
          eventDate,
        );
      }),
    );
  }

  async processRentingConfirmedEvent(input: ProcessRentingConfirmedEventInput): Promise<void> {
    await this.executeAsync(() =>
      this.prisma.$transaction(async (transaction) => {
        const eventDate = new Date(input.eventDate);
        const eventHour = new Date(input.eventHour);
        const estimatedTotal = new Prisma.Decimal(input.estimatedTotal);

        await this.upsertHourlyBookingAcceptedRollup(
          transaction,
          input.postingId,
          input.ownerId,
          eventHour,
          estimatedTotal,
        );
        await this.upsertDailyBookingAcceptedRollup(
          transaction,
          input.postingId,
          input.ownerId,
          eventDate,
          estimatedTotal,
        );
      }),
    );
  }

  async getOwnerSummary(input: PostingAnalyticsSummaryInput): Promise<OwnerPostingsAnalyticsSummary> {
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
          COALESCE(SUM(confirmed_bookings), 0) AS confirmedBookings,
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

  async listOwnerPostingsAnalytics(input: ListPostingAnalyticsInput): Promise<PostingAnalyticsListResult> {
    const range = this.createWindowRange(input.window);
    const skip = (input.page - 1) * input.pageSize;
    const tableSql = this.dailyTableSql();
    const whereSql = Prisma.sql`
      ra.owner_id = ${input.ownerId}
      ${range.startAt ? Prisma.sql`AND ra.bucket_start >= ${range.startAt}` : Prisma.empty}
    `;

    const [rows, countRows] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.$queryRaw<PostingAnalyticsListRow[]>(Prisma.sql`
          SELECT
            ra.posting_id AS postingId,
            r.name AS name,
            r.status AS status,
            (
              SELECT rp.blob_url
              FROM posting_photos rp
              WHERE rp.posting_id = ra.posting_id
              ORDER BY rp.position ASC
              LIMIT 1
            ) AS primaryPhotoUrl,
            COALESCE(SUM(ra.views), 0) AS views,
            COALESCE(SUM(ra.unique_views), 0) AS uniqueViews,
            COALESCE(SUM(ra.booking_requests), 0) AS bookingRequests,
            COALESCE(SUM(ra.confirmed_bookings), 0) AS confirmedBookings,
            COALESCE(SUM(ra.estimated_revenue), 0) AS estimatedRevenue
          FROM ${tableSql} ra
          INNER JOIN postings r ON r.id = ra.posting_id
          WHERE ${whereSql}
          GROUP BY ra.posting_id, r.name, r.status
          ORDER BY views DESC, uniqueViews DESC, r.updated_at DESC
          LIMIT ${input.pageSize}
          OFFSET ${skip}
        `),
        this.prisma.$queryRaw<AnalyticsCountRow[]>(Prisma.sql`
          SELECT COUNT(*) AS total
          FROM (
            SELECT ra.posting_id
            FROM ${tableSql} ra
            WHERE ${whereSql}
            GROUP BY ra.posting_id
          ) AS grouped_postings
        `),
      ]),
    );

    const total = Number(countRows[0]?.total ?? 0);

    return {
      window: input.window,
      postings: rows.map((row): PostingAnalyticsListItem => ({
        postingId: row.postingId,
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

  async getPostingAnalyticsDetail(
    input: PostingAnalyticsDetailInput,
  ): Promise<PostingAnalyticsDetail | null> {
    const header = await this.findPostingAnalyticsHeader(input.postingId, input.ownerId);

    if (!header) {
      return null;
    }

    const range = this.createWindowRange(input.window);
    const totalsTable = this.dailyTableSql();
    const detailTable = input.granularity === "hour" ? this.hourlyTableSql() : this.dailyTableSql();
    const whereTotalsSql = Prisma.sql`
      posting_id = ${input.postingId}
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
            COALESCE(SUM(confirmed_bookings), 0) AS confirmedBookings,
            COALESCE(SUM(estimated_revenue), 0) AS estimatedRevenue
          FROM ${totalsTable}
          WHERE ${whereTotalsSql}
        `),
        this.prisma.$queryRaw<PostingAnalyticsBucketRow[]>(Prisma.sql`
          SELECT
            bucket_start AS bucketStart,
            COALESCE(SUM(views), 0) AS views,
            COALESCE(SUM(unique_views), 0) AS uniqueViews,
            COALESCE(SUM(booking_requests), 0) AS bookingRequests,
            COALESCE(SUM(confirmed_bookings), 0) AS confirmedBookings,
            COALESCE(SUM(estimated_revenue), 0) AS estimatedRevenue
          FROM ${detailTable}
          WHERE ${whereTotalsSql}
          GROUP BY bucket_start
          ORDER BY bucket_start ASC
        `),
      ]),
    );

    return {
      postingId: header.postingId,
      name: header.name,
      status: header.status,
      primaryPhotoUrl: header.primaryPhotoUrl ?? undefined,
      window: input.window,
      granularity: input.granularity,
      totals: this.mapMetrics(totalRows[0]),
      buckets: bucketRows.map((row): PostingAnalyticsBucket => {
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

  private async findPostingAnalyticsHeader(
    postingId: string,
    ownerId: string,
  ): Promise<PostingAnalyticsHeaderRow | null> {
    const [row] = await this.executeAsync(() =>
      this.prisma.$queryRaw<PostingAnalyticsHeaderRow[]>(Prisma.sql`
        SELECT
          r.id AS postingId,
          r.name AS name,
          r.status AS status,
          (
            SELECT rp.blob_url
            FROM posting_photos rp
            WHERE rp.posting_id = r.id
            ORDER BY rp.position ASC
            LIMIT 1
          ) AS primaryPhotoUrl
        FROM postings r
        WHERE r.id = ${postingId}
          AND r.owner_id = ${ownerId}
        LIMIT 1
      `),
    );

    return row ?? null;
  }

  private async upsertHourlyRollup(
    transaction: Prisma.TransactionClient,
    postingId: string,
    ownerId: string,
    bucketStart: Date,
    uniqueIncrement: number,
  ): Promise<void> {
    await transaction.postingAnalyticsHourly.upsert({
      where: {
        postingId_bucketStart: {
          postingId,
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
        postingId,
        ownerId,
        bucketStart,
        views: 1,
        uniqueViews: uniqueIncrement,
        bookingRequests: 0,
        confirmedBookings: 0,
        estimatedRevenue: new Prisma.Decimal(0),
      },
    });
  }

  private async upsertDailyRollup(
    transaction: Prisma.TransactionClient,
    postingId: string,
    ownerId: string,
    bucketStart: Date,
    uniqueIncrement: number,
  ): Promise<void> {
    await transaction.postingAnalyticsDaily.upsert({
      where: {
        postingId_bucketStart: {
          postingId,
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
        postingId,
        ownerId,
        bucketStart,
        views: 1,
        uniqueViews: uniqueIncrement,
        bookingRequests: 0,
        confirmedBookings: 0,
        estimatedRevenue: new Prisma.Decimal(0),
      },
    });
  }

  private async upsertHourlyBookingRequestRollup(
    transaction: Prisma.TransactionClient,
    postingId: string,
    ownerId: string,
    bucketStart: Date,
  ): Promise<void> {
    await transaction.postingAnalyticsHourly.upsert({
      where: {
        postingId_bucketStart: {
          postingId,
          bucketStart,
        },
      },
      update: {
        bookingRequests: {
          increment: 1,
        },
      },
      create: {
        id: randomUUID(),
        postingId,
        ownerId,
        bucketStart,
        views: 0,
        uniqueViews: 0,
        bookingRequests: 1,
        confirmedBookings: 0,
        estimatedRevenue: new Prisma.Decimal(0),
      },
    });
  }

  private async upsertDailyBookingRequestRollup(
    transaction: Prisma.TransactionClient,
    postingId: string,
    ownerId: string,
    bucketStart: Date,
  ): Promise<void> {
    await transaction.postingAnalyticsDaily.upsert({
      where: {
        postingId_bucketStart: {
          postingId,
          bucketStart,
        },
      },
      update: {
        bookingRequests: {
          increment: 1,
        },
      },
      create: {
        id: randomUUID(),
        postingId,
        ownerId,
        bucketStart,
        views: 0,
        uniqueViews: 0,
        bookingRequests: 1,
        confirmedBookings: 0,
        estimatedRevenue: new Prisma.Decimal(0),
      },
    });
  }

  private async upsertHourlyBookingAcceptedRollup(
    transaction: Prisma.TransactionClient,
    postingId: string,
    ownerId: string,
    bucketStart: Date,
    estimatedTotal: Prisma.Decimal,
  ): Promise<void> {
    await transaction.postingAnalyticsHourly.upsert({
      where: {
        postingId_bucketStart: {
          postingId,
          bucketStart,
        },
      },
      update: {
        confirmedBookings: {
          increment: 1,
        },
        estimatedRevenue: {
          increment: estimatedTotal,
        },
      },
      create: {
        id: randomUUID(),
        postingId,
        ownerId,
        bucketStart,
        views: 0,
        uniqueViews: 0,
        bookingRequests: 0,
        confirmedBookings: 1,
        estimatedRevenue: estimatedTotal,
      },
    });
  }

  private async upsertDailyBookingAcceptedRollup(
    transaction: Prisma.TransactionClient,
    postingId: string,
    ownerId: string,
    bucketStart: Date,
    estimatedTotal: Prisma.Decimal,
  ): Promise<void> {
    await transaction.postingAnalyticsDaily.upsert({
      where: {
        postingId_bucketStart: {
          postingId,
          bucketStart,
        },
      },
      update: {
        confirmedBookings: {
          increment: 1,
        },
        estimatedRevenue: {
          increment: estimatedTotal,
        },
      },
      create: {
        id: randomUUID(),
        postingId,
        ownerId,
        bucketStart,
        views: 0,
        uniqueViews: 0,
        bookingRequests: 0,
        confirmedBookings: 1,
        estimatedRevenue: estimatedTotal,
      },
    });
  }

  private dailyTableSql(): Prisma.Sql {
    return Prisma.sql`posting_analytics_daily`;
  }

  private hourlyTableSql(): Prisma.Sql {
    return Prisma.sql`posting_analytics_hourly`;
  }

  private createWindowRange(window: PostingAnalyticsWindow): { startAt?: Date; endAt: Date } {
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

  private mapMetrics(row?: AnalyticsAggregateRow): PostingAnalyticsMetrics {
    return {
      views: Number(row?.views ?? 0),
      uniqueViews: Number(row?.uniqueViews ?? 0),
      bookingRequests: Number(row?.bookingRequests ?? 0),
      confirmedBookings: Number(row?.confirmedBookings ?? 0),
      estimatedRevenue: Number(row?.estimatedRevenue ?? 0),
    };
  }

  private createDataAvailability() {
    return {
      views: "live" as const,
      bookingRequests: "live" as const,
      confirmedBookings: "live" as const,
      estimatedRevenue: "live" as const,
      isPartial: false as const,
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
  ): PostingAnalyticsOutboxRecord {
    return {
      id: outbox.id,
      postingId: outbox.postingId,
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

