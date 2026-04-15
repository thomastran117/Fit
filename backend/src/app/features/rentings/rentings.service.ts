import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type { ConvertBookingRequestInput, ListMyRentingsInput, ListRentingsResult, RentingRecord } from "@/features/rentings/rentings.model";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

export class RentingsService {
  constructor(private readonly rentingsRepository: RentingsRepository) {}

  async convertApprovedBookingRequest(input: ConvertBookingRequestInput): Promise<RentingRecord> {
    const renting = await this.rentingsRepository.convertApprovedBookingRequest(
      input.bookingRequestId,
      input.ownerId,
    );

    if (!renting) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

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
}
