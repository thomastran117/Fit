import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { BaseRepository } from "@/features/base/base.repository";
import type {
  ListRentingReviewsResult,
  RentingReviewRecord,
  RentingReviewSummary,
  UpsertRentingReviewInput,
} from "@/features/rentings/rentings.reviews.model";

type RentingReviewPersistence = Prisma.RentingReviewGetPayload<{
  include: {
    reviewer: {
      include: {
        profile: true;
      };
    };
  };
}>;

type RentingReviewAggregatePersistence = {
  _avg: {
    rating: number | null;
  };
  _count: {
    _all: number;
  };
};

export class RentingsReviewsRepository extends BaseRepository {
  async create(input: UpsertRentingReviewInput): Promise<RentingReviewRecord> {
    const review = await this.executeAsync(() =>
      this.prisma.rentingReview.create({
        data: {
          id: randomUUID(),
          rentingId: input.rentingId,
          reviewerId: input.reviewerId,
          rating: input.rating,
          title: input.title ?? null,
          comment: input.comment ?? null,
        },
        include: {
          reviewer: {
            include: {
              profile: true,
            },
          },
        },
      }),
    );

    return this.mapReview(review);
  }

  async updateOwnReview(input: UpsertRentingReviewInput): Promise<RentingReviewRecord | null> {
    try {
      const review = await this.executeAsync(() =>
        this.prisma.rentingReview.update({
          where: {
            rentingId_reviewerId: {
              rentingId: input.rentingId,
              reviewerId: input.reviewerId,
            },
          },
          data: {
            rating: input.rating,
            title: input.title ?? null,
            comment: input.comment ?? null,
          },
          include: {
            reviewer: {
              include: {
                profile: true,
              },
            },
          },
        }),
      );

      return this.mapReview(review);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }

      throw error;
    }
  }

  async findOwnReview(rentingId: string, reviewerId: string): Promise<RentingReviewRecord | null> {
    const review = await this.executeAsync(() =>
      this.prisma.rentingReview.findUnique({
        where: {
          rentingId_reviewerId: {
            rentingId,
            reviewerId,
          },
        },
        include: {
          reviewer: {
            include: {
              profile: true,
            },
          },
        },
      }),
    );

    return review ? this.mapReview(review) : null;
  }

  async listByRenting(
    rentingId: string,
    page: number,
    pageSize: number,
  ): Promise<ListRentingReviewsResult> {
    const skip = (page - 1) * pageSize;

    const [reviews, total, aggregate] = await this.executeAsync(() =>
      Promise.all([
        this.prisma.rentingReview.findMany({
          where: {
            rentingId,
          },
          skip,
          take: pageSize,
          orderBy: [
            {
              createdAt: "desc",
            },
          ],
          include: {
            reviewer: {
              include: {
                profile: true,
              },
            },
          },
        }),
        this.prisma.rentingReview.count({
          where: {
            rentingId,
          },
        }),
        this.prisma.rentingReview.aggregate({
          where: {
            rentingId,
          },
          _avg: {
            rating: true,
          },
          _count: {
            _all: true,
          },
        }),
      ]),
    );

    return {
      reviews: reviews.map((review) => this.mapReview(review)),
      summary: this.mapSummary(aggregate),
      pagination: this.createPagination(page, pageSize, total),
    };
  }

  async getSummary(rentingId: string): Promise<RentingReviewSummary> {
    const aggregate = await this.executeAsync(() =>
      this.prisma.rentingReview.aggregate({
        where: {
          rentingId,
        },
        _avg: {
          rating: true,
        },
        _count: {
          _all: true,
        },
      }),
    );

    return this.mapSummary(aggregate);
  }

  private mapReview(review: RentingReviewPersistence): RentingReviewRecord {
    return {
      id: review.id,
      rentingId: review.rentingId,
      reviewerId: review.reviewerId,
      rating: review.rating,
      title: review.title ?? undefined,
      comment: review.comment ?? undefined,
      reviewer: {
        username: review.reviewer.profile?.username ?? undefined,
        avatarUrl: review.reviewer.profile?.avatarUrl ?? undefined,
      },
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }

  private mapSummary(aggregate: RentingReviewAggregatePersistence): RentingReviewSummary {
    return {
      averageRating: Number((aggregate._avg.rating ?? 0).toFixed(2)),
      reviewCount: aggregate._count._all,
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
