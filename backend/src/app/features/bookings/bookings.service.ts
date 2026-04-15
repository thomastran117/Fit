import BadRequestError from "@/errors/http/bad-request.error";
import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type {
  BookingRequestRecord,
  BookingRequestsListResult,
  CreateBookingRequestInput,
  DecideBookingRequestInput,
  ListOwnerBookingRequestsInput,
  ListRenterBookingRequestsInput,
  UpdateBookingRequestInput,
} from "@/features/bookings/bookings.model";
import {
  APPROVED_BOOKING_HOLD_HOURS,
  BOOKING_DEFAULTS,
  MAX_BOOKING_GUEST_COUNT,
  MAX_BOOKING_NOTE_LENGTH,
  PENDING_BOOKING_HOLD_HOURS,
} from "@/features/bookings/bookings.model";
import type { BookingsRepository } from "@/features/bookings/bookings.repository";
import type { PostingsAnalyticsRepository } from "@/features/postings/postings.analytics.repository";
import type { PostingRecord } from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export class BookingsService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly postingsRepository: PostingsRepository,
    private readonly postingsAnalyticsRepository: PostingsAnalyticsRepository,
  ) {}

  async create(input: CreateBookingRequestInput): Promise<BookingRequestRecord> {
    const posting = await this.requireBookablePosting(input.postingId);

    if (posting.ownerId === input.renterId) {
      throw new ForbiddenError("You cannot create a booking request for your own posting.");
    }

    const normalized = this.normalizeCreateInput(input, posting);
    await this.assertNoBlockingAvailabilityOverlap(posting.id, normalized.startAt, normalized.endAt);

    const hasActiveOverlap = await this.bookingsRepository.hasActiveOverlap({
      postingId: posting.id,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
    });

    if (hasActiveOverlap) {
      throw new BadRequestError("The requested dates are already held by another booking request.");
    }

    const hasRenterOverlap = await this.bookingsRepository.hasActiveOverlap({
      postingId: posting.id,
      renterId: input.renterId,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
    });

    if (hasRenterOverlap) {
      throw new BadRequestError(
        "You already have an active booking request for this posting that overlaps these dates.",
      );
    }

    const created = await this.bookingsRepository.create({
      postingId: posting.id,
      renterId: input.renterId,
      ownerId: posting.ownerId,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      durationDays: normalized.durationDays,
      guestCount: normalized.guestCount,
      note: normalized.note,
      pricingCurrency: posting.pricing.currency,
      pricingSnapshot: posting.pricing,
      dailyPriceAmount: posting.pricing.daily.amount,
      estimatedTotal: posting.pricing.daily.amount * normalized.durationDays,
      holdExpiresAt: this.addHours(new Date(), PENDING_BOOKING_HOLD_HOURS),
    });

    await this.postingsAnalyticsRepository.enqueueBookingRequestedEvent({
      postingId: created.postingId,
      ownerId: created.ownerId,
      occurredAt: created.createdAt,
      estimatedTotal: created.estimatedTotal,
    });

    return created;
  }

  async listMine(input: ListRenterBookingRequestsInput): Promise<BookingRequestsListResult> {
    return this.bookingsRepository.listByRenter(input);
  }

  async getById(id: string, userId: string): Promise<BookingRequestRecord> {
    const bookingRequest = await this.bookingsRepository.findById(id);

    if (!bookingRequest) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    if (bookingRequest.ownerId !== userId && bookingRequest.renterId !== userId) {
      throw new ForbiddenError("You do not have access to this booking request.");
    }

    return bookingRequest;
  }

  async updateOwnPending(input: UpdateBookingRequestInput): Promise<BookingRequestRecord> {
    const existing = await this.bookingsRepository.findById(input.bookingRequestId);

    if (!existing) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    if (existing.renterId !== input.renterId) {
      throw new ForbiddenError("You do not have access to this booking request.");
    }

    if (existing.status !== "pending") {
      throw new BadRequestError("Only pending booking requests can be updated.");
    }

    if (new Date(existing.holdExpiresAt).getTime() <= Date.now()) {
      throw new BadRequestError("This booking request has already expired.");
    }

    const posting = await this.requireBookablePosting(existing.postingId);
    const normalized = this.normalizeCreateInput(
      {
        postingId: existing.postingId,
        renterId: input.renterId,
        startAt: input.startAt,
        endAt: input.endAt,
        guestCount: input.guestCount,
        note: input.note,
      },
      posting,
    );

    await this.assertNoBlockingAvailabilityOverlap(
      posting.id,
      normalized.startAt,
      normalized.endAt,
      existing.id,
    );

    const hasActiveOverlap = await this.bookingsRepository.hasActiveOverlap({
      postingId: posting.id,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      excludeBookingRequestId: existing.id,
    });

    if (hasActiveOverlap) {
      throw new BadRequestError("The requested dates are already held by another booking request.");
    }

    const hasRenterOverlap = await this.bookingsRepository.hasActiveOverlap({
      postingId: posting.id,
      renterId: input.renterId,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      excludeBookingRequestId: existing.id,
    });

    if (hasRenterOverlap) {
      throw new BadRequestError(
        "You already have an active booking request for this posting that overlaps these dates.",
      );
    }

    const updated = await this.bookingsRepository.updatePending(existing.id, input.renterId, {
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      durationDays: normalized.durationDays,
      guestCount: normalized.guestCount,
      note: normalized.note,
      pricingCurrency: posting.pricing.currency,
      pricingSnapshot: posting.pricing,
      dailyPriceAmount: posting.pricing.daily.amount,
      estimatedTotal: posting.pricing.daily.amount * normalized.durationDays,
    });

    if (!updated) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    return updated;
  }

  async listForOwnerPosting(
    input: ListOwnerBookingRequestsInput,
  ): Promise<BookingRequestsListResult> {
    const posting = await this.postingsRepository.findById(input.postingId);

    if (!posting) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    if (posting.ownerId !== input.ownerId) {
      throw new ForbiddenError("You do not have access to this posting.");
    }

    return this.bookingsRepository.listByOwnerAndPosting(input);
  }

  async approve(input: DecideBookingRequestInput): Promise<BookingRequestRecord> {
    const bookingRequest = await this.requireOwnerBookingRequest(input.bookingRequestId, input.ownerId);
    this.assertCanDecide(bookingRequest, "approve");

    await this.requireBookablePosting(bookingRequest.postingId);
    await this.assertNoBlockingAvailabilityOverlap(
      bookingRequest.postingId,
      new Date(bookingRequest.startAt),
      new Date(bookingRequest.endAt),
      bookingRequest.id,
    );

    const hasActiveOverlap = await this.bookingsRepository.hasActiveOverlap({
      postingId: bookingRequest.postingId,
      startAt: new Date(bookingRequest.startAt),
      endAt: new Date(bookingRequest.endAt),
      excludeBookingRequestId: bookingRequest.id,
    });

    if (hasActiveOverlap) {
      throw new BadRequestError("The requested dates are no longer available.");
    }

    const approved = await this.bookingsRepository.approve(
      bookingRequest.id,
      input.ownerId,
      input.note,
      this.addHours(new Date(), APPROVED_BOOKING_HOLD_HOURS),
    );

    if (!approved) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    return approved;
  }

  async decline(input: DecideBookingRequestInput): Promise<BookingRequestRecord> {
    const bookingRequest = await this.requireOwnerBookingRequest(input.bookingRequestId, input.ownerId);
    this.assertCanDecide(bookingRequest, "decline");

    const declined = await this.bookingsRepository.decline(
      bookingRequest.id,
      input.ownerId,
      input.note,
    );

    if (!declined) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    return declined;
  }

  private async requireBookablePosting(postingId: string): Promise<PostingRecord> {
    const posting = await this.postingsRepository.findById(postingId);

    if (!posting) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    if (posting.status !== "published" || posting.archivedAt) {
      throw new BadRequestError("Booking requests are only allowed for published postings.");
    }

    return posting;
  }

  private async requireOwnerBookingRequest(
    bookingRequestId: string,
    ownerId: string,
  ): Promise<BookingRequestRecord> {
    const bookingRequest = await this.bookingsRepository.findById(bookingRequestId);

    if (!bookingRequest) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    if (bookingRequest.ownerId !== ownerId) {
      throw new ForbiddenError("You do not have access to this booking request.");
    }

    return bookingRequest;
  }

  private normalizeCreateInput(input: CreateBookingRequestInput, posting: PostingRecord) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
      throw new BadRequestError("Booking request dates must define a valid, non-empty range.");
    }

    const durationDays = Math.ceil((endAt.getTime() - startAt.getTime()) / MILLISECONDS_PER_DAY);

    if (durationDays < 1) {
      throw new BadRequestError("Booking requests must be at least one day long.");
    }

    const effectiveMaxDuration =
      posting.maxBookingDurationDays ?? BOOKING_DEFAULTS.defaultMaxBookingDurationDays;

    if (durationDays > effectiveMaxDuration) {
      throw new BadRequestError(
        `Booking duration cannot exceed ${effectiveMaxDuration} day${effectiveMaxDuration === 1 ? "" : "s"}.`,
      );
    }

    if (!Number.isInteger(input.guestCount) || input.guestCount < 1) {
      throw new BadRequestError("Guest count must be a positive integer.");
    }

    if (input.guestCount > MAX_BOOKING_GUEST_COUNT) {
      throw new BadRequestError(
        `Guest count cannot exceed ${MAX_BOOKING_GUEST_COUNT}.`,
      );
    }

    const note = input.note?.trim() || null;

    if (note && note.length > MAX_BOOKING_NOTE_LENGTH) {
      throw new BadRequestError(
        `Booking note cannot exceed ${MAX_BOOKING_NOTE_LENGTH} characters.`,
      );
    }

    return {
      ...input,
      startAt,
      endAt,
      guestCount: input.guestCount,
      note,
      durationDays,
    };
  }

  private assertCanDecide(
    bookingRequest: BookingRequestRecord,
    action: "approve" | "decline",
  ): void {
    if (bookingRequest.status !== "pending") {
      throw new BadRequestError(
        `Only pending booking requests can be ${action === "approve" ? "approved" : "declined"}.`,
      );
    }

    if (new Date(bookingRequest.holdExpiresAt).getTime() <= Date.now()) {
      throw new BadRequestError("This booking request has already expired.");
    }
  }

  private async assertNoBlockingAvailabilityOverlap(
    postingId: string,
    startAt: Date,
    endAt: Date,
    excludeBookingRequestId?: string,
  ): Promise<void> {
    const overlap = await this.bookingsRepository.hasBlockingAvailabilityOverlap({
      postingId,
      startAt,
      endAt,
      excludeBookingRequestId,
    });

    if (overlap) {
      throw new BadRequestError("The requested dates overlap with existing availability blocks.");
    }
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }
}
