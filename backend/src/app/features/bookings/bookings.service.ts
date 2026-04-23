import BadRequestError from "@/errors/http/bad-request.error";
import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type {
  BookingQuoteFailureReason,
  BookingQuoteInput,
  BookingQuoteResult,
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
  MAX_ACTIVE_BOOKING_REQUESTS_PER_POSTING,
  MAX_BOOKING_GUEST_COUNT,
  MAX_BOOKING_NOTE_LENGTH,
  PENDING_BOOKING_HOLD_HOURS,
} from "@/features/bookings/bookings.model";
import type { BookingsRepository } from "@/features/bookings/bookings.repository";
import type { PostingsAnalyticsRepository } from "@/features/postings/postings.analytics.repository";
import type { PostingRecord } from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface NormalizedBookingRequestInput {
  startAt: Date;
  endAt: Date;
  durationDays: number;
  guestCount: number;
  note: string | null;
}

interface NormalizedCreateBookingRequestInput extends NormalizedBookingRequestInput {
  contactName: string;
  contactEmail: string;
  contactPhoneNumber: string | null;
}

interface BookingRequestValidationResult {
  posting: PostingRecord;
  normalized: NormalizedBookingRequestInput | null;
  maxBookingDurationDays: number;
  failureReasons: BookingQuoteFailureReason[];
}

export class BookingsService {
  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly postingsRepository: PostingsRepository,
    private readonly postingsAnalyticsRepository: PostingsAnalyticsRepository,
    private readonly rentingsRepository: RentingsRepository,
  ) {}

  async create(input: CreateBookingRequestInput): Promise<BookingRequestRecord> {
    const validation = await this.validateBookingRequest(input);
    this.assertBookingRequestValidationPassed(validation);

    const { posting, normalized } = validation;

    const created = await this.bookingsRepository.create({
      postingId: posting.id,
      renterId: input.renterId,
      ownerId: posting.ownerId,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      durationDays: normalized.durationDays,
      guestCount: normalized.guestCount,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      contactPhoneNumber: input.contactPhoneNumber?.trim() || null,
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
    await this.postingsRepository.enqueueSearchSync(created.postingId);

    return created;
  }

  async quote(input: BookingQuoteInput): Promise<BookingQuoteResult> {
    const validation = await this.validateBookingRequest(input);
    const { posting, normalized } = validation;
    const estimatedTotal = normalized
      ? posting.pricing.daily.amount * normalized.durationDays
      : null;

    return {
      postingId: posting.id,
      bookable: validation.failureReasons.length === 0,
      durationDays: normalized?.durationDays ?? null,
      pricingCurrency: posting.pricing.currency,
      dailyPriceAmount: posting.pricing.daily.amount,
      estimatedTotal,
      maxBookingDurationDays: validation.maxBookingDurationDays,
      failureReasons: validation.failureReasons,
    };
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
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhoneNumber: input.contactPhoneNumber,
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
    await this.assertNoRentingOverlap(posting.id, normalized.startAt, normalized.endAt);

    const updated = await this.bookingsRepository.updatePending(existing.id, input.renterId, {
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      durationDays: normalized.durationDays,
      guestCount: normalized.guestCount,
      contactName: normalized.contactName,
      contactEmail: normalized.contactEmail,
      contactPhoneNumber: normalized.contactPhoneNumber,
      note: normalized.note,
      pricingCurrency: posting.pricing.currency,
      pricingSnapshot: posting.pricing,
      dailyPriceAmount: posting.pricing.daily.amount,
      estimatedTotal: posting.pricing.daily.amount * normalized.durationDays,
    });

    if (!updated) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    await this.postingsRepository.enqueueSearchSync(updated.postingId);
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
    await this.assertNoRentingOverlap(
      bookingRequest.postingId,
      new Date(bookingRequest.startAt),
      new Date(bookingRequest.endAt),
    );
    await this.assertNoBlockingAvailabilityOverlap(
      bookingRequest.postingId,
      new Date(bookingRequest.startAt),
      new Date(bookingRequest.endAt),
      bookingRequest.id,
    );

    const approved = await this.bookingsRepository.approve(
      bookingRequest.id,
      input.ownerId,
      input.note,
      this.addHours(new Date(), APPROVED_BOOKING_HOLD_HOURS),
    );

    if (!approved) {
      throw new ResourceNotFoundError("Booking request could not be found.");
    }

    await this.postingsRepository.enqueueSearchSync(approved.postingId);
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

    await this.postingsRepository.enqueueSearchSync(declined.postingId);
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

  private async requirePosting(postingId: string): Promise<PostingRecord> {
    const posting = await this.postingsRepository.findById(postingId);

    if (!posting) {
      throw new ResourceNotFoundError("Posting could not be found.");
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

  private normalizeCreateInput(
    input: CreateBookingRequestInput,
    posting: PostingRecord,
  ): NormalizedCreateBookingRequestInput {
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
    const contactName = input.contactName.trim();
    const contactEmail = input.contactEmail.trim().toLowerCase();
    const contactPhoneNumber = input.contactPhoneNumber?.trim() || null;

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
      contactName,
      contactEmail,
      contactPhoneNumber,
      note,
      durationDays,
    };
  }

  private normalizeCreateInputForQuote(
    input: BookingQuoteInput,
    maxBookingDurationDays: number,
  ): {
    normalized: NormalizedBookingRequestInput | null;
    failureReasons: BookingQuoteFailureReason[];
  } {
    const failureReasons: BookingQuoteFailureReason[] = [];
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
      failureReasons.push({
        code: "invalid_dates",
        field: "startAt",
        message: "Booking request dates must define a valid, non-empty range.",
      });
      return {
        normalized: null,
        failureReasons,
      };
    }

    const durationDays = Math.ceil((endAt.getTime() - startAt.getTime()) / MILLISECONDS_PER_DAY);

    if (durationDays < 1) {
      failureReasons.push({
        code: "invalid_dates",
        field: "startAt",
        message: "Booking requests must be at least one day long.",
      });
    }

    if (durationDays > maxBookingDurationDays) {
      failureReasons.push({
        code: "max_duration_exceeded",
        field: "endAt",
        message: `Booking duration cannot exceed ${maxBookingDurationDays} day${maxBookingDurationDays === 1 ? "" : "s"}.`,
        details: {
          durationDays,
          maxBookingDurationDays,
        },
      });
    }

    if (!Number.isInteger(input.guestCount) || input.guestCount < 1) {
      failureReasons.push({
        code: "invalid_guest_count",
        field: "guestCount",
        message: "Guest count must be a positive integer.",
      });
    } else if (input.guestCount > MAX_BOOKING_GUEST_COUNT) {
      failureReasons.push({
        code: "guest_count_exceeded",
        field: "guestCount",
        message: `Guest count cannot exceed ${MAX_BOOKING_GUEST_COUNT}.`,
        details: {
          maxGuestCount: MAX_BOOKING_GUEST_COUNT,
        },
      });
    }

    const note = input.note?.trim() || null;

    if (note && note.length > MAX_BOOKING_NOTE_LENGTH) {
      failureReasons.push({
        code: "note_too_long",
        field: "note",
        message: `Booking note cannot exceed ${MAX_BOOKING_NOTE_LENGTH} characters.`,
        details: {
          maxLength: MAX_BOOKING_NOTE_LENGTH,
        },
      });
    }

    return {
      normalized: {
        startAt,
        endAt,
        guestCount: input.guestCount,
        note,
        durationDays,
      },
      failureReasons,
    };
  }

  private async validateBookingRequest(
    input: BookingQuoteInput,
  ): Promise<BookingRequestValidationResult> {
    const posting = await this.requirePosting(input.postingId);
    const maxBookingDurationDays =
      posting.maxBookingDurationDays ?? BOOKING_DEFAULTS.defaultMaxBookingDurationDays;
    const failureReasons: BookingQuoteFailureReason[] = [];

    if (posting.status !== "published" || posting.archivedAt) {
      failureReasons.push({
        code: "posting_unavailable",
        message: "Booking requests are only allowed for published postings.",
      });
    }

    if (posting.ownerId === input.renterId) {
      failureReasons.push({
        code: "own_posting",
        message: "You cannot create a booking request for your own posting.",
      });
    }

    const normalizedResult = this.normalizeCreateInputForQuote(input, maxBookingDurationDays);
    failureReasons.push(...normalizedResult.failureReasons);

    if (normalizedResult.normalized) {
      const [rentingOverlap, availabilityOverlap, activeRequestCount] = await Promise.all([
        this.rentingsRepository.hasOverlap(
          posting.id,
          normalizedResult.normalized.startAt,
          normalizedResult.normalized.endAt,
        ),
        this.bookingsRepository.hasBlockingAvailabilityOverlap({
          postingId: posting.id,
          startAt: normalizedResult.normalized.startAt,
          endAt: normalizedResult.normalized.endAt,
          excludeBookingRequestId: undefined,
        }),
        this.bookingsRepository.countActiveRequestsForRenterPosting({
          postingId: posting.id,
          renterId: input.renterId,
          excludeBookingRequestId: undefined,
        }),
      ]);

      if (rentingOverlap) {
        failureReasons.push({
          code: "renting_overlap",
          message: "The requested dates are already reserved by an existing renting.",
        });
      }

      if (availabilityOverlap) {
        failureReasons.push({
          code: "availability_block_overlap",
          message: "The requested dates overlap with existing availability blocks.",
        });
      }

      if (activeRequestCount >= MAX_ACTIVE_BOOKING_REQUESTS_PER_POSTING) {
        failureReasons.push({
          code: "active_request_limit_exceeded",
          message: `You can only keep ${MAX_ACTIVE_BOOKING_REQUESTS_PER_POSTING} active booking requests for this posting at a time. Please update or complete an existing request before creating another.`,
          details: {
            activeRequestCount,
            maxActiveRequests: MAX_ACTIVE_BOOKING_REQUESTS_PER_POSTING,
          },
        });
      }
    }

    return {
      posting,
      normalized: normalizedResult.normalized,
      maxBookingDurationDays,
      failureReasons,
    };
  }

  private assertBookingRequestValidationPassed(
    validation: BookingRequestValidationResult,
  ): asserts validation is BookingRequestValidationResult & {
    normalized: NormalizedBookingRequestInput;
  } {
    const firstFailure = validation.failureReasons[0];

    if (!firstFailure || !validation.normalized) {
      return;
    }

    if (firstFailure.code === "own_posting") {
      throw new ForbiddenError(firstFailure.message);
    }

    throw new BadRequestError(firstFailure.message);
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

  private async assertWithinPostingRequestCap(
    postingId: string,
    renterId: string,
    excludeBookingRequestId?: string,
  ): Promise<void> {
    const activeRequestCount = await this.bookingsRepository.countActiveRequestsForRenterPosting({
      postingId,
      renterId,
      excludeBookingRequestId,
    });

    if (activeRequestCount >= MAX_ACTIVE_BOOKING_REQUESTS_PER_POSTING) {
      throw new BadRequestError(
        `You can only keep ${MAX_ACTIVE_BOOKING_REQUESTS_PER_POSTING} active booking requests for this posting at a time. Please update or complete an existing request before creating another.`,
      );
    }
  }

  private async assertNoRentingOverlap(postingId: string, startAt: Date, endAt: Date): Promise<void> {
    const overlap = await this.rentingsRepository.hasOverlap(postingId, startAt, endAt);

    if (overlap) {
      throw new BadRequestError("The requested dates are already reserved by an existing renting.");
    }
  }

  private addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }
}
