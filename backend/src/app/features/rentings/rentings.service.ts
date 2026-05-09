import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import { CONVERSION_RESERVATION_MINUTES } from "@/features/bookings/bookings.model";
import type { BookingsRepository } from "@/features/bookings/bookings.repository";
import type { CacheService } from "@/features/cache/cache.service";
import { flowLockKeys, withFlowLocks } from "@/features/cache/cache-locks";
import type { PostingsAnalyticsRepository } from "@/features/postings/analytics/analytics.repository";
import { invalidatePublicPostingProjection } from "@/features/postings/postings.public-cache-invalidation";
import type { PostingsPublicCacheService } from "@/features/postings/postings.public-cache.service";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { ConvertBookingRequestInput, ListMyRentingsInput, ListRentingsResult, RentingRecord } from "@/features/rentings/rentings.model";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

export class RentingsService {
  constructor(
    private readonly rentingsRepository: RentingsRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly postingsAnalyticsRepository: PostingsAnalyticsRepository,
    private readonly postingsRepository: PostingsRepository,
    private readonly cacheService: CacheService,
    private readonly postingsPublicCacheService: PostingsPublicCacheService,
  ) {}

  async convertApprovedBookingRequest(input: ConvertBookingRequestInput): Promise<RentingRecord> {
    const bookingRequest = await this.bookingsRepository.findById(input.bookingRequestId);

    if (!bookingRequest) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    if (bookingRequest.ownerId !== input.ownerId) {
      throw new ForbiddenError("You do not have access to this booking request.");
    }

    await this.requirePostingActionableForConversion(bookingRequest.postingId);

    const renting = await withFlowLocks(
      this.cacheService,
      [
        flowLockKeys.bookingRequestConvert(input.bookingRequestId),
        flowLockKeys.postingBookingWindow(bookingRequest.postingId),
      ],
      async () => {
        const reservation = await this.bookingsRepository.reserveForConversion(
          input.bookingRequestId,
          input.ownerId,
          new Date(Date.now() + CONVERSION_RESERVATION_MINUTES * 60 * 1000),
        );
        await this.syncPostingSearchState(bookingRequest.postingId);

        try {
          const nextRenting = await this.rentingsRepository.convertApprovedBookingRequest(
            input.bookingRequestId,
            input.ownerId,
          );

          if (!nextRenting) {
            throw new ResourceNotFoundError("Booking request could not be found.");
          }

          return nextRenting;
        } catch (error) {
          await this.bookingsRepository.releaseConversionReservation(
            input.bookingRequestId,
            input.ownerId,
            reservation,
          );
          await this.syncPostingSearchState(bookingRequest.postingId);
          throw error;
        }
      },
      "Another request is already converting this booking request. Please retry.",
    );

    await this.postingsAnalyticsRepository.enqueueRentingConfirmedEvent({
      postingId: renting.postingId,
      ownerId: renting.ownerId,
      occurredAt: renting.confirmedAt,
      estimatedTotal: renting.estimatedTotal,
    });
    await this.syncPostingSearchState(renting.postingId);

    return renting;
  }

  async getById(id: string, userId: string): Promise<RentingRecord> {
    const renting = await this.rentingsRepository.findById(id);

    if (!renting) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    if (renting.ownerId !== userId && renting.renterId !== userId) {
      throw new ForbiddenError("You do not have access to this renting.");
    }

    return renting;
  }

  async listMine(input: ListMyRentingsInput): Promise<ListRentingsResult> {
    return this.rentingsRepository.listMine(input);
  }

  private async requirePostingActionableForConversion(postingId: string): Promise<void> {
    const posting = await this.postingsRepository.findById(postingId);

    if (!posting) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    if (posting.archivedAt || !["published", "paused"].includes(posting.status)) {
      throw new ForbiddenError("This posting can no longer be converted into a renting.");
    }
  }

  private async syncPostingSearchState(postingId: string): Promise<void> {
    await invalidatePublicPostingProjection(this.postingsPublicCacheService, postingId);
    await this.postingsRepository.enqueueSearchSync(postingId);
  }
}
