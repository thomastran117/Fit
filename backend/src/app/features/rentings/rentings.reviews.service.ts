import ConflictError from "@/errors/http/conflict.error";
import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type {
  CreateRentingReviewRequestBody,
  ListRentingReviewsResult,
  RentingReviewRecord,
  UpsertRentingReviewInput,
} from "@/features/rentings/rentings.reviews.model";
import type { RentingsReviewsRepository } from "@/features/rentings/rentings.reviews.repository";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

export class RentingsReviewsService {
  constructor(
    private readonly rentingsReviewsRepository: RentingsReviewsRepository,
    private readonly rentingsRepository: RentingsRepository,
  ) {}

  async create(
    rentingId: string,
    reviewerId: string,
    body: CreateRentingReviewRequestBody,
  ): Promise<RentingReviewRecord> {
    const renting = await this.requirePublishedRenting(rentingId);
    this.assertReviewerIsNotOwner(renting.ownerId, reviewerId);

    const existing = await this.rentingsReviewsRepository.findOwnReview(rentingId, reviewerId);

    if (existing) {
      throw new ConflictError("You have already reviewed this renting.");
    }

    return this.rentingsReviewsRepository.create(this.toUpsertInput(rentingId, reviewerId, body));
  }

  async updateOwn(
    rentingId: string,
    reviewerId: string,
    body: CreateRentingReviewRequestBody,
  ): Promise<RentingReviewRecord> {
    const renting = await this.requirePublishedRenting(rentingId);
    this.assertReviewerIsNotOwner(renting.ownerId, reviewerId);

    const review = await this.rentingsReviewsRepository.updateOwnReview(
      this.toUpsertInput(rentingId, reviewerId, body),
    );

    if (!review) {
      throw new ResourceNotFoundError("Review could not be found.");
    }

    return review;
  }

  async list(rentingId: string, page: number, pageSize: number): Promise<ListRentingReviewsResult> {
    await this.requirePublishedRenting(rentingId);
    return this.rentingsReviewsRepository.listByRenting(rentingId, page, pageSize);
  }

  private async requirePublishedRenting(rentingId: string) {
    const renting = await this.rentingsRepository.findById(rentingId);

    if (!renting || renting.status !== "published" || renting.archivedAt) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    return renting;
  }

  private assertReviewerIsNotOwner(ownerId: string, reviewerId: string): void {
    if (ownerId === reviewerId) {
      throw new ForbiddenError("You cannot review your own renting.");
    }
  }

  private toUpsertInput(
    rentingId: string,
    reviewerId: string,
    body: CreateRentingReviewRequestBody,
  ): UpsertRentingReviewInput {
    return {
      rentingId,
      reviewerId,
      rating: body.rating,
      title: body.title?.trim() || null,
      comment: body.comment?.trim() || null,
    };
  }
}
