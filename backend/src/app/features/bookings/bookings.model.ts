import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_MAX_BOOKING_DURATION_DAYS,
  MAX_PAGE_SIZE,
  postingPricingSchema,
} from "@/features/postings/postings.model";

export const MAX_BOOKING_NOTE_LENGTH = 1000;
export const MAX_BOOKING_DECISION_NOTE_LENGTH = 1000;
export const MAX_BOOKING_GUEST_COUNT = 20;
export const PENDING_BOOKING_HOLD_HOURS = 24;
export const APPROVED_BOOKING_HOLD_HOURS = 72;
export const CONVERSION_RESERVATION_MINUTES = 5;

const trimmedStringSchema = z.string().trim().min(1);
const nullableTrimmedStringSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional();

export const bookingRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "declined",
  "expired",
]);

export const createBookingRequestSchema = z.object({
  startAt: z.string().datetime("Booking request start time must be an ISO datetime."),
  endAt: z.string().datetime("Booking request end time must be an ISO datetime."),
  guestCount: z.coerce
    .number()
    .int("Guest count must be an integer.")
    .min(1, "Guest count must be at least 1.")
    .max(MAX_BOOKING_GUEST_COUNT, `Guest count must be at most ${MAX_BOOKING_GUEST_COUNT}.`),
  note: nullableTrimmedStringSchema.pipe(
    z.string().trim().max(MAX_BOOKING_NOTE_LENGTH).nullable().optional(),
  ),
});

export const updateBookingRequestSchema = createBookingRequestSchema;

export const decideBookingRequestSchema = z.object({
  note: nullableTrimmedStringSchema.pipe(
    z.string().trim().max(MAX_BOOKING_DECISION_NOTE_LENGTH).nullable().optional(),
  ),
});

export const listBookingRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: bookingRequestStatusSchema.optional(),
});

export type BookingRequestStatus = z.infer<typeof bookingRequestStatusSchema>;
export type CreateBookingRequestBody = z.infer<typeof createBookingRequestSchema>;
export type UpdateBookingRequestBody = z.infer<typeof updateBookingRequestSchema>;
export type DecideBookingRequestBody = z.infer<typeof decideBookingRequestSchema>;
export type ListBookingRequestsQuery = z.infer<typeof listBookingRequestsQuerySchema>;

export interface BookingRequestPostingSummary {
  id: string;
  name: string;
  primaryPhotoUrl?: string;
  effectiveMaxBookingDurationDays: number;
}

export interface BookingRequestRecord {
  id: string;
  postingId: string;
  renterId: string;
  ownerId: string;
  status: BookingRequestStatus;
  startAt: string;
  endAt: string;
  durationDays: number;
  guestCount: number;
  note?: string;
  pricingCurrency: string;
  pricingSnapshot: z.infer<typeof postingPricingSchema>;
  dailyPriceAmount: number;
  estimatedTotal: number;
  decisionNote?: string;
  approvedAt?: string;
  declinedAt?: string;
  expiredAt?: string;
  convertedAt?: string;
  conversionReservedAt?: string;
  conversionReservationExpiresAt?: string;
  holdExpiresAt: string;
  holdBlockId?: string;
  rentingId?: string;
  createdAt: string;
  updatedAt: string;
  posting: BookingRequestPostingSummary;
}

export interface BookingRequestsListResult {
  bookingRequests: BookingRequestRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  status?: BookingRequestStatus;
}

export interface CreateBookingRequestInput {
  postingId: string;
  renterId: string;
  startAt: string;
  endAt: string;
  guestCount: number;
  note?: string | null;
}

export interface DecideBookingRequestInput {
  bookingRequestId: string;
  ownerId: string;
  note?: string | null;
}

export interface UpdateBookingRequestInput {
  bookingRequestId: string;
  renterId: string;
  startAt: string;
  endAt: string;
  guestCount: number;
  note?: string | null;
}

export interface ListRenterBookingRequestsInput {
  renterId: string;
  page: number;
  pageSize: number;
  status?: BookingRequestStatus;
}

export interface ListOwnerBookingRequestsInput {
  ownerId: string;
  postingId: string;
  page: number;
  pageSize: number;
  status?: BookingRequestStatus;
}

export interface CreateBookingRequestPersistenceInput {
  postingId: string;
  renterId: string;
  ownerId: string;
  startAt: Date;
  endAt: Date;
  durationDays: number;
  guestCount: number;
  note?: string | null;
  pricingCurrency: string;
  pricingSnapshot: z.infer<typeof postingPricingSchema>;
  dailyPriceAmount: number;
  estimatedTotal: number;
  holdExpiresAt: Date;
}

export interface ActiveBookingOverlapInput {
  postingId: string;
  startAt: Date;
  endAt: Date;
  excludeBookingRequestId?: string;
  renterId?: string;
}

export interface BookingRequestExpirationRecord {
  id: string;
  status: BookingRequestStatus;
  holdBlockId?: string;
}

export const BOOKING_DEFAULTS = {
  defaultMaxBookingDurationDays: DEFAULT_MAX_BOOKING_DURATION_DAYS,
};
