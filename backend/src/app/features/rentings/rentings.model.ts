import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, postingPricingSchema } from "@/features/postings/postings.model";

export const rentingStatusSchema = z.enum(["confirmed"]);

export const listRentingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: rentingStatusSchema.optional(),
});

export type RentingStatus = z.infer<typeof rentingStatusSchema>;
export type ListRentingsQuery = z.infer<typeof listRentingsQuerySchema>;

export interface RentingPostingSummary {
  id: string;
  name: string;
  primaryPhotoUrl?: string;
}

export interface RentingRecord {
  id: string;
  postingId: string;
  bookingRequestId: string;
  renterId: string;
  ownerId: string;
  status: RentingStatus;
  startAt: string;
  endAt: string;
  durationDays: number;
  guestCount: number;
  pricingCurrency: string;
  pricingSnapshot: z.infer<typeof postingPricingSchema>;
  dailyPriceAmount: number;
  estimatedTotal: number;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
  posting: RentingPostingSummary;
}

export interface ListRentingsResult {
  rentings: RentingRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  status?: RentingStatus;
}

export interface ConvertBookingRequestInput {
  bookingRequestId: string;
  ownerId: string;
}

export interface ListMyRentingsInput {
  userId: string;
  page: number;
  pageSize: number;
  status?: RentingStatus;
}
