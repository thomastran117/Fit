import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import BadRequestError from "@/errors/http/bad-request.error";
import type {
  ListMyRentingsInput,
  ListRentingsResult,
  RentingRecord,
  RentingStatus,
} from "@/features/rentings/rentings.model";
import type { PostingPricing } from "@/features/postings/postings.model";

type RentingPersistence = Prisma.RentingGetPayload<{
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

export class RentingsRepository extends BaseRepository {
  async convertApprovedBookingRequest(
    bookingRequestId: string,
    ownerId: string,
  ): Promise<RentingRecord | null> {
    return this.executeAsync(async () =>
      this.prisma.$transaction(async (transaction) => {
        const bookingRequest = await transaction.bookingRequest.findUnique({
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
            renting: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!bookingRequest || bookingRequest.ownerId !== ownerId) {
          return null;
        }

        const now = new Date();

        if (bookingRequest.status !== "approved") {
          throw new BadRequestError("Only approved booking requests can be converted into rentings.");
        }

        if (bookingRequest.convertedAt || bookingRequest.renting) {
          throw new BadRequestError("This booking request has already been converted into a renting.");
        }

        if (bookingRequest.holdExpiresAt.getTime() <= now.getTime()) {
          throw new BadRequestError("This booking request has already expired.");
        }

        const overlapWithRenting = await transaction.renting.findFirst({
          where: {
            postingId: bookingRequest.postingId,
            startAt: {
              lt: bookingRequest.endAt,
            },
            endAt: {
              gt: bookingRequest.startAt,
            },
          },
          select: {
            id: true,
          },
        });

        if (overlapWithRenting) {
          throw new BadRequestError("The requested dates are no longer available.");
        }

        if (bookingRequest.holdBlockId) {
          await transaction.postingAvailabilityBlock.deleteMany({
            where: {
              id: bookingRequest.holdBlockId,
            },
          });
        }

        await transaction.postingAvailabilityBlock.create({
          data: {
            id: randomUUID(),
            postingId: bookingRequest.postingId,
            startAt: bookingRequest.startAt,
            endAt: bookingRequest.endAt,
            note: `Renting confirmed from booking request: ${bookingRequest.id}`,
          },
        });

        const renting = await transaction.renting.create({
          data: {
            id: randomUUID(),
            postingId: bookingRequest.postingId,
            bookingRequestId: bookingRequest.id,
            renterId: bookingRequest.renterId,
            ownerId: bookingRequest.ownerId,
            status: "confirmed",
            startAt: bookingRequest.startAt,
            endAt: bookingRequest.endAt,
            durationDays: bookingRequest.durationDays,
            guestCount: bookingRequest.guestCount,
            pricingCurrency: bookingRequest.pricingCurrency,
            pricingSnapshot: bookingRequest.pricingSnapshot as Prisma.InputJsonValue,
            dailyPriceAmount: bookingRequest.dailyPriceAmount,
            estimatedTotal: bookingRequest.estimatedTotal,
            confirmedAt: now,
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

        await transaction.bookingRequest.update({
          where: {
            id: bookingRequest.id,
          },
          data: {
            convertedAt: now,
            holdBlockId: null,
          },
        });

        return this.mapRenting(renting);
      }),
    );
  }

  async findById(id: string): Promise<RentingRecord | null> {
    const renting = await this.executeAsync(() =>
      this.prisma.renting.findUnique({
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

    return renting ? this.mapRenting(renting) : null;
  }

  async listMine(input: ListMyRentingsInput): Promise<ListRentingsResult> {
    const where: Prisma.RentingWhereInput = {
      OR: [{ renterId: input.userId }, { ownerId: input.userId }],
      ...(input.status ? { status: input.status } : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [rentings, total] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.renting.findMany({
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
        this.prisma.renting.count({ where }),
      ]),
    );

    return {
      rentings: rentings.map((renting) => this.mapRenting(renting)),
      pagination: this.createPagination(input.page, input.pageSize, total),
      ...(input.status ? { status: input.status } : {}),
    };
  }

  async hasOverlap(postingId: string, startAt: Date, endAt: Date, excludeRentingId?: string): Promise<boolean> {
    const match = await this.executeAsync(() =>
      this.prisma.renting.findFirst({
        where: {
          postingId,
          ...(excludeRentingId
            ? {
                id: {
                  not: excludeRentingId,
                },
              }
            : {}),
          startAt: {
            lt: endAt,
          },
          endAt: {
            gt: startAt,
          },
        },
        select: {
          id: true,
        },
      }),
    );

    return Boolean(match);
  }

  private mapRenting(renting: RentingPersistence): RentingRecord {
    return {
      id: renting.id,
      postingId: renting.postingId,
      bookingRequestId: renting.bookingRequestId,
      renterId: renting.renterId,
      ownerId: renting.ownerId,
      status: renting.status as RentingStatus,
      startAt: renting.startAt.toISOString(),
      endAt: renting.endAt.toISOString(),
      durationDays: renting.durationDays,
      guestCount: renting.guestCount,
      pricingCurrency: renting.pricingCurrency,
      pricingSnapshot: renting.pricingSnapshot as PostingPricing,
      dailyPriceAmount: Number(renting.dailyPriceAmount),
      estimatedTotal: Number(renting.estimatedTotal),
      confirmedAt: renting.confirmedAt.toISOString(),
      createdAt: renting.createdAt.toISOString(),
      updatedAt: renting.updatedAt.toISOString(),
      posting: {
        id: renting.posting.id,
        name: renting.posting.name,
        primaryPhotoUrl: renting.posting.photos[0]?.blobUrl,
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
