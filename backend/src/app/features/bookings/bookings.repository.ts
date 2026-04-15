import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import BadRequestError from "@/errors/http/bad-request.error";
import {
  DEFAULT_MAX_BOOKING_DURATION_DAYS,
  type PostingPricing,
} from "@/features/postings/postings.model";
import type {
  ActiveBookingOverlapInput,
  BookingRequestExpirationRecord,
  BookingRequestRecord,
  BookingRequestsListResult,
  BookingRequestStatus,
  CreateBookingRequestPersistenceInput,
  ListOwnerBookingRequestsInput,
  ListRenterBookingRequestsInput,
} from "@/features/bookings/bookings.model";

type BookingRequestPersistence = Prisma.BookingRequestGetPayload<{
  include: {
    posting: {
      include: {
        photos: {
          orderBy: {
            position: "asc";
          };
        };
      };
    };
  };
}>;

export class BookingsRepository extends BaseRepository {
  async create(input: CreateBookingRequestPersistenceInput): Promise<BookingRequestRecord> {
    const created = await this.executeAsync(() =>
      this.prisma.bookingRequest.create({
        data: {
          id: randomUUID(),
          postingId: input.postingId,
          renterId: input.renterId,
          ownerId: input.ownerId,
          status: "pending",
          startAt: input.startAt,
          endAt: input.endAt,
          durationDays: input.durationDays,
          guestCount: input.guestCount,
          note: input.note ?? null,
          pricingCurrency: input.pricingCurrency,
          pricingSnapshot: input.pricingSnapshot as Prisma.InputJsonValue,
          dailyPriceAmount: new Prisma.Decimal(input.dailyPriceAmount),
          estimatedTotal: new Prisma.Decimal(input.estimatedTotal),
          holdExpiresAt: input.holdExpiresAt,
        },
        include: {
          posting: {
            include: {
              photos: {
                orderBy: {
                  position: "asc",
                },
              },
            },
          },
        },
      }),
    );

    return this.mapBookingRequest(created);
  }

  async findById(id: string): Promise<BookingRequestRecord | null> {
    const bookingRequest = await this.executeAsync(() =>
      this.prisma.bookingRequest.findUnique({
        where: {
          id,
        },
        include: {
          posting: {
            include: {
              photos: {
                orderBy: {
                  position: "asc",
                },
              },
            },
          },
        },
      }),
    );

    return bookingRequest ? this.mapBookingRequest(bookingRequest) : null;
  }

  async updatePending(
    bookingRequestId: string,
    renterId: string,
    input: {
      startAt: Date;
      endAt: Date;
      durationDays: number;
      guestCount: number;
      note?: string | null;
      pricingCurrency: string;
      pricingSnapshot: PostingPricing;
      dailyPriceAmount: number;
      estimatedTotal: number;
    },
  ): Promise<BookingRequestRecord | null> {
    const updated = await this.executeAsync(async () =>
      this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.bookingRequest.findUnique({
          where: {
            id: bookingRequestId,
          },
          select: {
            id: true,
            renterId: true,
            status: true,
            holdExpiresAt: true,
          },
        });

        if (!existing || existing.renterId !== renterId) {
          return null;
        }

        if (existing.status !== "pending" || existing.holdExpiresAt.getTime() <= Date.now()) {
          return null;
        }

        return transaction.bookingRequest.update({
          where: {
            id: bookingRequestId,
          },
          data: {
            startAt: input.startAt,
            endAt: input.endAt,
            durationDays: input.durationDays,
            guestCount: input.guestCount,
            note: input.note ?? null,
            pricingCurrency: input.pricingCurrency,
            pricingSnapshot: input.pricingSnapshot as Prisma.InputJsonValue,
            dailyPriceAmount: new Prisma.Decimal(input.dailyPriceAmount),
            estimatedTotal: new Prisma.Decimal(input.estimatedTotal),
          },
          include: {
            posting: {
              include: {
                photos: {
                  orderBy: {
                    position: "asc",
                  },
                },
              },
            },
          },
        });
      }),
    );

    return updated ? this.mapBookingRequest(updated) : null;
  }

  async listByRenter(input: ListRenterBookingRequestsInput): Promise<BookingRequestsListResult> {
    const where: Prisma.BookingRequestWhereInput = {
      renterId: input.renterId,
      ...(input.status ? { status: input.status } : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [rows, total] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.bookingRequest.findMany({
          where,
          skip,
          take: input.pageSize,
          orderBy: [{ createdAt: "desc" }],
          include: {
            posting: {
              include: {
                photos: {
                  orderBy: {
                    position: "asc",
                  },
                },
              },
            },
          },
        }),
        this.prisma.bookingRequest.count({ where }),
      ]),
    );

    return {
      bookingRequests: rows.map((row) => this.mapBookingRequest(row)),
      pagination: this.createPagination(input.page, input.pageSize, total),
      ...(input.status ? { status: input.status } : {}),
    };
  }

  async listByOwnerAndPosting(
    input: ListOwnerBookingRequestsInput,
  ): Promise<BookingRequestsListResult> {
    const where: Prisma.BookingRequestWhereInput = {
      ownerId: input.ownerId,
      postingId: input.postingId,
      ...(input.status ? { status: input.status } : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [rows, total] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.bookingRequest.findMany({
          where,
          skip,
          take: input.pageSize,
          orderBy: [{ createdAt: "desc" }],
          include: {
            posting: {
              include: {
                photos: {
                  orderBy: {
                    position: "asc",
                  },
                },
              },
            },
          },
        }),
        this.prisma.bookingRequest.count({ where }),
      ]),
    );

    return {
      bookingRequests: rows.map((row) => this.mapBookingRequest(row)),
      pagination: this.createPagination(input.page, input.pageSize, total),
      ...(input.status ? { status: input.status } : {}),
    };
  }

  async hasActiveOverlap(input: ActiveBookingOverlapInput): Promise<boolean> {
    const now = new Date();
    const match = await this.executeAsync(() =>
      this.prisma.bookingRequest.findFirst({
        where: {
          postingId: input.postingId,
          status: {
            in: ["pending", "approved"],
          },
          holdExpiresAt: {
            gt: now,
          },
          ...(input.excludeBookingRequestId
            ? {
                id: {
                  not: input.excludeBookingRequestId,
                },
              }
            : {}),
          ...(input.renterId
            ? {
                renterId: input.renterId,
              }
            : {}),
          startAt: {
            lt: input.endAt,
          },
          endAt: {
            gt: input.startAt,
          },
        },
        select: {
          id: true,
        },
      }),
    );

    return Boolean(match);
  }

  async approve(
    bookingRequestId: string,
    ownerId: string,
    note: string | null | undefined,
    holdExpiresAt: Date,
  ): Promise<BookingRequestRecord | null> {
    return this.executeAsync(async () => {
      try {
        const approved = await this.prisma.$transaction(async (transaction) => {
          const existing = await transaction.bookingRequest.findUnique({
            where: {
              id: bookingRequestId,
            },
            include: {
              posting: {
                include: {
                  photos: {
                    orderBy: {
                      position: "asc",
                    },
                  },
                },
              },
            },
          });

          if (!existing || existing.ownerId !== ownerId) {
            return null;
          }

          const now = new Date();

          if (existing.status !== "pending" || existing.holdExpiresAt <= now) {
            return null;
          }

          const availabilityBlock = await transaction.postingAvailabilityBlock.findFirst({
            where: {
              postingId: existing.postingId,
              startAt: {
                lt: existing.endAt,
              },
              endAt: {
                gt: existing.startAt,
              },
              OR: [
                {
                  bookingRequestHold: null,
                },
                {
                  bookingRequestHold: {
                    status: "approved",
                    holdExpiresAt: {
                      gt: now,
                    },
                    id: {
                      not: existing.id,
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
            },
          });

          if (availabilityBlock) {
            throw new BadRequestError("The requested dates are no longer available.");
          }

          const overlap = await transaction.bookingRequest.findFirst({
            where: {
              postingId: existing.postingId,
              status: {
                in: ["pending", "approved"],
              },
              holdExpiresAt: {
                gt: now,
              },
              id: {
                not: existing.id,
              },
              startAt: {
                lt: existing.endAt,
              },
              endAt: {
                gt: existing.startAt,
              },
            },
            select: {
              id: true,
            },
          });

          if (overlap) {
            throw new BadRequestError("The requested dates are no longer available.");
          }

          const holdBlock = await transaction.postingAvailabilityBlock.create({
            data: {
              id: randomUUID(),
              postingId: existing.postingId,
              startAt: existing.startAt,
              endAt: existing.endAt,
              note: `Booking request hold: ${existing.id}`,
            },
          });

          const updated = await transaction.bookingRequest.update({
            where: {
              id: existing.id,
            },
            data: {
              status: "approved",
              approvedAt: now,
              decisionNote: note ?? null,
              holdExpiresAt,
              holdBlockId: holdBlock.id,
            },
            include: {
              posting: {
                include: {
                  photos: {
                    orderBy: {
                      position: "asc",
                    },
                  },
                },
              },
            },
          });

          return updated;
        });

        return approved ? this.mapBookingRequest(approved) : null;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    });
  }

  async decline(
    bookingRequestId: string,
    ownerId: string,
    note: string | null | undefined,
  ): Promise<BookingRequestRecord | null> {
    const declined = await this.executeAsync(async () =>
      this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.bookingRequest.findUnique({
          where: {
            id: bookingRequestId,
          },
          select: {
            id: true,
            ownerId: true,
          },
        });

        if (!existing || existing.ownerId !== ownerId) {
          return null;
        }

        return transaction.bookingRequest.update({
          where: {
            id: bookingRequestId,
          },
          data: {
            status: "declined",
            declinedAt: new Date(),
            decisionNote: note ?? null,
          },
          include: {
            posting: {
              include: {
                photos: {
                  orderBy: {
                    position: "asc",
                  },
                },
              },
            },
          },
        });
      }),
    );

    return declined ? this.mapBookingRequest(declined) : null;
  }

  async listExpiredCandidates(limit: number): Promise<BookingRequestExpirationRecord[]> {
    const now = new Date();
    const rows = await this.executeAsync(() =>
      this.prisma.bookingRequest.findMany({
        where: {
          status: {
            in: ["pending", "approved"],
          },
          holdExpiresAt: {
            lte: now,
          },
        },
        orderBy: [{ holdExpiresAt: "asc" }, { createdAt: "asc" }],
        take: limit,
        select: {
          id: true,
          status: true,
          holdBlockId: true,
        },
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      status: row.status as BookingRequestStatus,
      holdBlockId: row.holdBlockId ?? undefined,
    }));
  }

  async hasBlockingAvailabilityOverlap(input: {
    postingId: string;
    startAt: Date;
    endAt: Date;
    excludeBookingRequestId?: string;
  }): Promise<boolean> {
    const now = new Date();
    const block = await this.executeAsync(() =>
      this.prisma.postingAvailabilityBlock.findFirst({
        where: {
          postingId: input.postingId,
          startAt: {
            lt: input.endAt,
          },
          endAt: {
            gt: input.startAt,
          },
          OR: [
            {
              bookingRequestHold: null,
            },
            {
              bookingRequestHold: {
                status: "approved",
                holdExpiresAt: {
                  gt: now,
                },
                ...(input.excludeBookingRequestId
                  ? {
                      id: {
                        not: input.excludeBookingRequestId,
                      },
                    }
                  : {}),
              },
            },
          ],
        },
        select: {
          id: true,
        },
      }),
    );

    return Boolean(block);
  }

  async expire(bookingRequestId: string): Promise<boolean> {
    return this.executeAsync(async () =>
      this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.bookingRequest.findUnique({
          where: {
            id: bookingRequestId,
          },
          select: {
            id: true,
            status: true,
            holdExpiresAt: true,
            holdBlockId: true,
          },
        });

        if (!existing) {
          return false;
        }

        if (!["pending", "approved"].includes(existing.status)) {
          return false;
        }

        if (existing.holdExpiresAt.getTime() > Date.now()) {
          return false;
        }

        const result = await transaction.bookingRequest.updateMany({
          where: {
            id: existing.id,
            status: existing.status,
            holdExpiresAt: {
              lte: new Date(),
            },
          },
          data: {
            status: "expired",
            expiredAt: new Date(),
            holdBlockId: null,
          },
        });

        if (result.count !== 1) {
          return false;
        }

        if (existing.status === "approved" && existing.holdBlockId) {
          await transaction.postingAvailabilityBlock.deleteMany({
            where: {
              id: existing.holdBlockId,
            },
          });
        }

        return true;
      }),
    );
  }

  private mapBookingRequest(bookingRequest: BookingRequestPersistence): BookingRequestRecord {
    return {
      id: bookingRequest.id,
      postingId: bookingRequest.postingId,
      renterId: bookingRequest.renterId,
      ownerId: bookingRequest.ownerId,
      status: bookingRequest.status as BookingRequestStatus,
      startAt: bookingRequest.startAt.toISOString(),
      endAt: bookingRequest.endAt.toISOString(),
      durationDays: bookingRequest.durationDays,
      guestCount: bookingRequest.guestCount,
      note: bookingRequest.note ?? undefined,
      pricingCurrency: bookingRequest.pricingCurrency,
      pricingSnapshot: bookingRequest.pricingSnapshot as PostingPricing,
      dailyPriceAmount: Number(bookingRequest.dailyPriceAmount),
      estimatedTotal: Number(bookingRequest.estimatedTotal),
      decisionNote: bookingRequest.decisionNote ?? undefined,
      approvedAt: bookingRequest.approvedAt?.toISOString(),
      declinedAt: bookingRequest.declinedAt?.toISOString(),
      expiredAt: bookingRequest.expiredAt?.toISOString(),
      holdExpiresAt: bookingRequest.holdExpiresAt.toISOString(),
      holdBlockId: bookingRequest.holdBlockId ?? undefined,
      createdAt: bookingRequest.createdAt.toISOString(),
      updatedAt: bookingRequest.updatedAt.toISOString(),
      posting: {
        id: bookingRequest.posting.id,
        name: bookingRequest.posting.name,
        primaryPhotoUrl: bookingRequest.posting.photos[0]?.blobUrl,
        effectiveMaxBookingDurationDays:
          bookingRequest.posting.maxBookingDurationDays ?? DEFAULT_MAX_BOOKING_DURATION_DAYS,
      },
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
}
