import type { BookingsRepository } from "@/features/bookings/bookings.repository";
import type { CacheService } from "@/features/cache/cache.service";
import type { PostingsAnalyticsRepository } from "@/features/postings/analytics/analytics.repository";
import type { PostingsPublicCacheService } from "@/features/postings/postings.public-cache.service";
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
      findById: jest.fn(async () => ({
        id: "posting-1",
        status: "published",
      })),
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
    const postingsPublicCacheService = {
      invalidatePublic: jest.fn(async () => 1),
    } as unknown as PostingsPublicCacheService;

    const service = new RentingsService(
      rentingsRepository,
      bookingsRepository,
      analyticsRepository,
      postingsRepository,
      cacheService,
      postingsPublicCacheService,
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

  it("allows conversion to renting while the posting is paused", async () => {
    const bookingsRepository = {
      findById: jest.fn(async () => ({
        id: "booking-1",
        postingId: "posting-1",
        ownerId: "owner-1",
      })),
      reserveForConversion: jest.fn(async () => ({
        reservedAt: new Date("2026-04-23T00:00:00.000Z"),
        reservationExpiresAt: new Date("2026-04-23T00:05:00.000Z"),
      })),
      releaseConversionReservation: jest.fn(async () => undefined),
    } as unknown as BookingsRepository;
    const rentingsRepository = {
      convertApprovedBookingRequest: jest.fn(async () => ({
        id: "renting-1",
        postingId: "posting-1",
        ownerId: "owner-1",
        renterId: "renter-1",
        bookingRequestId: "booking-1",
        status: "confirmed",
        startAt: "2026-05-01T00:00:00.000Z",
        endAt: "2026-05-04T00:00:00.000Z",
        durationDays: 3,
        guestCount: 2,
        pricingCurrency: "CAD",
        pricingSnapshot: {
          currency: "CAD",
          daily: {
            amount: 120,
          },
        },
        dailyPriceAmount: 120,
        estimatedTotal: 360,
        confirmedAt: "2026-04-23T00:00:00.000Z",
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
        posting: {
          id: "posting-1",
          name: "City loft",
        },
      })),
    } as unknown as RentingsRepository;
    const analyticsRepository = {
      enqueueRentingConfirmedEvent: jest.fn(async () => undefined),
    } as unknown as PostingsAnalyticsRepository;
    const postingsRepository = {
      findById: jest.fn(async () => ({
        id: "posting-1",
        status: "paused",
        archivedAt: undefined,
      })),
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
    const postingsPublicCacheService = {
      invalidatePublic: jest.fn(async () => 1),
    } as unknown as PostingsPublicCacheService;

    const service = new RentingsService(
      rentingsRepository,
      bookingsRepository,
      analyticsRepository,
      postingsRepository,
      cacheService,
      postingsPublicCacheService,
    );

    const renting = await service.convertApprovedBookingRequest({
      bookingRequestId: "booking-1",
      ownerId: "owner-1",
    });

    expect(renting.id).toBe("renting-1");
    expect(
      (rentingsRepository.convertApprovedBookingRequest as unknown as jest.Mock),
    ).toHaveBeenCalledWith("booking-1", "owner-1");
    expect(
      (postingsPublicCacheService.invalidatePublic as unknown as jest.Mock),
    ).toHaveBeenCalledWith("posting-1");
  });
});
