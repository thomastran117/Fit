import type { BookingsRepository } from "@/features/bookings/bookings.repository";
import type { CacheService } from "@/features/cache/cache.service";
import type { PostingsAnalyticsRepository } from "@/features/postings/postings.analytics.repository";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import { RentingsService } from "@/features/rentings/rentings.service";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

describe("RentingsService", () => {
  it("releases only the reservation it acquired when conversion fails", async () => {
    const reservation = {
      reservedAt: new Date("2026-04-23T00:00:00.000Z"),
      reservationExpiresAt: new Date("2026-04-23T00:05:00.000Z"),
    };
    const bookingsRepository = {
      findById: jest.fn(async () => ({
        id: "booking-1",
        postingId: "posting-1",
        ownerId: "owner-1",
      })),
      reserveForConversion: jest.fn(async () => reservation),
      releaseConversionReservation: jest.fn(async () => undefined),
    } as unknown as BookingsRepository;
    const rentingsRepository = {
      convertApprovedBookingRequest: jest.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as RentingsRepository;
    const analyticsRepository = {
      enqueueRentingConfirmedEvent: jest.fn(async () => undefined),
    } as unknown as PostingsAnalyticsRepository;
    const postingsRepository = {
      enqueueSearchSync: jest.fn(async () => undefined),
    } as unknown as PostingsRepository;
    const cacheService = {
      acquireLock: jest.fn(async (key: string) => ({
        key,
        token: `${key}-token`,
        release: jest.fn(async () => true),
        extend: jest.fn(async () => true),
      })),
    } as unknown as CacheService;

    const service = new RentingsService(
      rentingsRepository,
      bookingsRepository,
      analyticsRepository,
      postingsRepository,
      cacheService,
    );

    await expect(
      service.convertApprovedBookingRequest({
        bookingRequestId: "booking-1",
        ownerId: "owner-1",
      }),
    ).rejects.toThrow("boom");

    expect(
      (bookingsRepository.releaseConversionReservation as unknown as jest.Mock).mock.calls[0],
    ).toEqual(["booking-1", "owner-1", reservation]);
    expect((cacheService.acquireLock as unknown as jest.Mock).mock.calls.map(([key]) => key)).toEqual([
      "booking-request:booking-1:convert",
      "posting:posting-1:booking-window",
    ]);
  });
});
