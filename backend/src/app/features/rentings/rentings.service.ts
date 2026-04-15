import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import { CONVERSION_RESERVATION_MINUTES } from "@/features/bookings/bookings.model";
import type { BookingsRepository } from "@/features/bookings/bookings.repository";
import type { PostingsAnalyticsRepository } from "@/features/postings/postings.analytics.repository";
import type { ConvertBookingRequestInput, ListMyRentingsInput, ListRentingsResult, RentingRecord } from "@/features/rentings/rentings.model";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

export class RentingsService {
  constructor(
    private readonly rentingsRepository: RentingsRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly postingsAnalyticsRepository: PostingsAnalyticsRepository,
  ) {}

  async convertApprovedBookingRequest(input: ConvertBookingRequestInput): Promise<RentingRecord> {
    const reservationExpiresAt = new Date(
      Date.now() + CONVERSION_RESERVATION_MINUTES * 60 * 1000,
    );

    await this.bookingsRepository.reserveForConversion(
      input.bookingRequestId,
      input.ownerId,
      reservationExpiresAt,
    );

    try {
      const renting = await this.rentingsRepository.convertApprovedBookingRequest(
        input.bookingRequestId,
        input.ownerId,
      );

      if (!renting) {
        throw new ResourceNotFoundError("Booking request could not be found.");
      }

      await this.postingsAnalyticsRepository.enqueueRentingConfirmedEvent({
        postingId: renting.postingId,
        ownerId: renting.ownerId,
        occurredAt: renting.confirmedAt,
        estimatedTotal: renting.estimatedTotal,
      });

      return renting;
    } catch (error) {
      await this.bookingsRepository.releaseConversionReservation(
        input.bookingRequestId,
        input.ownerId,
      );
      throw error;
    }
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
}
