import BadRequestError from "@/errors/http/bad-request.error";
import type { BookingRequestRecord } from "@/features/bookings/bookings.model";
import type { BookingsRepository } from "@/features/bookings/bookings.repository";
import { BookingsService } from "@/features/bookings/bookings.service";
import type { PostingsAnalyticsRepository } from "@/features/postings/postings.analytics.repository";
import type { PostingRecord } from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

function createPostingRecord(): PostingRecord {
  return {
    id: "posting-1",
    ownerId: "owner-1",
    status: "published",
    variant: {
      family: "place",
      subtype: "entire_place",
    },
    name: "City loft",
    description: "A bright loft.",
    pricing: {
      currency: "CAD",
      daily: {
        amount: 120,
      },
    },
    pricingCurrency: "CAD",
    photos: [],
    tags: [],
    attributes: {},
    availabilityStatus: "available",
    effectiveMaxBookingDurationDays: 30,
    availabilityBlocks: [],
    location: {
      latitude: 43.65,
      longitude: -79.38,
      city: "Toronto",
      region: "Ontario",
      country: "Canada",
    },
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  };
}

function createBookingRequestRecord(overrides: Partial<BookingRequestRecord> = {}): BookingRequestRecord {
  return {
    id: "booking-1",
    postingId: "posting-1",
    renterId: "renter-1",
    ownerId: "owner-1",
    status: "pending",
    startAt: "2026-05-01T00:00:00.000Z",
    endAt: "2026-05-04T00:00:00.000Z",
    durationDays: 3,
    guestCount: 2,
    contactName: "Jordan Lee",
    contactEmail: "jordan@example.com",
    contactPhoneNumber: "+1 416 555 0100",
    pricingCurrency: "CAD",
    pricingSnapshot: {
      currency: "CAD",
      daily: {
        amount: 120,
      },
    },
    dailyPriceAmount: 120,
    estimatedTotal: 360,
    holdExpiresAt: "2026-04-21T00:00:00.000Z",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    posting: {
      id: "posting-1",
      name: "City loft",
      effectiveMaxBookingDurationDays: 30,
    },
    ...overrides,
  };
}

function createService(options?: {
  activeRequestCount?: number;
  createdBooking?: BookingRequestRecord;
}) {
  const posting = createPostingRecord();
  const createdBooking = options?.createdBooking ?? createBookingRequestRecord();

  const bookingsRepository = {
    countActiveRequestsForRenterPosting: jest.fn(
      async () => options?.activeRequestCount ?? 0,
    ),
    create: jest.fn(async () => createdBooking),
    findById: jest.fn(async () => createdBooking),
    updatePending: jest.fn(async () => createdBooking),
    approve: jest.fn(async () => ({
      ...createdBooking,
      status: "awaiting_payment",
    })),
    hasBlockingAvailabilityOverlap: jest.fn(async () => false),
  } as unknown as BookingsRepository;

  const postingsRepository = {
    findById: jest.fn(async () => posting),
    enqueueSearchSync: jest.fn(async () => undefined),
  } as unknown as PostingsRepository;

  const analyticsRepository = {
    enqueueBookingRequestedEvent: jest.fn(async () => undefined),
  } as unknown as PostingsAnalyticsRepository;

  const rentingsRepository = {
    hasOverlap: jest.fn(async () => false),
  } as unknown as RentingsRepository;

  const service = new BookingsService(
    bookingsRepository,
    postingsRepository,
    analyticsRepository,
    rentingsRepository,
  );

  return {
    service,
    bookingsRepository: bookingsRepository as unknown as {
      countActiveRequestsForRenterPosting: jest.Mock;
      create: jest.Mock;
      approve: jest.Mock;
      hasBlockingAvailabilityOverlap: jest.Mock;
    },
    analyticsRepository: analyticsRepository as unknown as {
      enqueueBookingRequestedEvent: jest.Mock;
    },
    postingsRepository: postingsRepository as unknown as {
      findById: jest.Mock;
      enqueueSearchSync: jest.Mock;
    },
  };
}

describe("BookingsService", () => {
  it("allows overlapping booking requests before payment when the posting is otherwise available", async () => {
    const { service, bookingsRepository, analyticsRepository, postingsRepository } = createService();

    const result = await service.create({
      postingId: "posting-1",
      renterId: "renter-1",
      startAt: "2026-05-01T00:00:00.000Z",
      endAt: "2026-05-04T00:00:00.000Z",
      guestCount: 2,
      contactName: "Jordan Lee",
      contactEmail: "jordan@example.com",
      contactPhoneNumber: "+1 416 555 0100",
      note: "Can arrive after 5pm",
    });

    expect(bookingsRepository.countActiveRequestsForRenterPosting).toHaveBeenCalledWith({
      postingId: "posting-1",
      renterId: "renter-1",
      excludeBookingRequestId: undefined,
    });
    expect(bookingsRepository.create).toHaveBeenCalledTimes(1);
    expect(analyticsRepository.enqueueBookingRequestedEvent).toHaveBeenCalledTimes(1);
    expect(postingsRepository.enqueueSearchSync).toHaveBeenCalledWith("posting-1");
    expect(result.id).toBe("booking-1");
  });

  it("rejects creating a third active booking request for the same posting", async () => {
    const { service } = createService({
      activeRequestCount: 2,
    });

    await expect(
      service.create({
        postingId: "posting-1",
        renterId: "renter-1",
        startAt: "2026-05-01T00:00:00.000Z",
        endAt: "2026-05-04T00:00:00.000Z",
        guestCount: 2,
        contactName: "Jordan Lee",
        contactEmail: "jordan@example.com",
        contactPhoneNumber: "+1 416 555 0100",
      }),
    ).rejects.toMatchObject<Partial<BadRequestError>>({
      message:
        "You can only keep 2 active booking requests for this posting at a time. Please update or complete an existing request before creating another.",
    });
  });

  it("persists booking contact info as part of the request snapshot", async () => {
    const { service, bookingsRepository } = createService();

    await service.create({
      postingId: "posting-1",
      renterId: "renter-1",
      startAt: "2026-05-01T00:00:00.000Z",
      endAt: "2026-05-04T00:00:00.000Z",
      guestCount: 2,
      contactName: "Jordan Lee",
      contactEmail: "Jordan@example.com",
      contactPhoneNumber: "  +1 416 555 0100  ",
      note: null,
    });

    expect(bookingsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contactName: "Jordan Lee",
        contactEmail: "jordan@example.com",
        contactPhoneNumber: "+1 416 555 0100",
      }),
    );
  });
});
