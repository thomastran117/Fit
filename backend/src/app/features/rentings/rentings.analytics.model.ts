import { z } from "zod";
import { MAX_PAGE_SIZE } from "@/features/rentings/rentings.model";

export const rentingAnalyticsWindowSchema = z.enum(["7d", "30d", "all"]);
export const rentingAnalyticsGranularitySchema = z.enum(["hour", "day"]);

export const rentingAnalyticsSummaryQuerySchema = z.object({
  window: rentingAnalyticsWindowSchema.default("7d"),
});

export const listRentingAnalyticsQuerySchema = z.object({
  window: rentingAnalyticsWindowSchema.default("7d"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export const rentingAnalyticsDetailQuerySchema = z.object({
  window: rentingAnalyticsWindowSchema.default("7d"),
  granularity: rentingAnalyticsGranularitySchema.default("day"),
});

export type RentingAnalyticsWindow = z.infer<typeof rentingAnalyticsWindowSchema>;
export type RentingAnalyticsGranularity = z.infer<typeof rentingAnalyticsGranularitySchema>;
export type RentingAnalyticsSummaryQuery = z.infer<typeof rentingAnalyticsSummaryQuerySchema>;
export type ListRentingAnalyticsQuery = z.infer<typeof listRentingAnalyticsQuerySchema>;
export type RentingAnalyticsDetailQuery = z.infer<typeof rentingAnalyticsDetailQuerySchema>;

export interface RentingAnalyticsMetrics {
  views: number;
  uniqueViews: number;
  bookingRequests: number;
  estimatedRevenue: number;
}

export interface RentingAnalyticsDataAvailability {
  views: "live";
  bookingRequests: "pending";
  estimatedRevenue: "pending";
  isPartial: boolean;
}

export interface RentingAnalyticsRange {
  startAt?: string;
  endAt: string;
}

export interface OwnerRentingsAnalyticsSummary {
  window: RentingAnalyticsWindow;
  totals: RentingAnalyticsMetrics;
  dataAvailability: RentingAnalyticsDataAvailability;
  range: RentingAnalyticsRange;
}

export interface RentingAnalyticsListItem {
  rentingId: string;
  name: string;
  status: string;
  primaryPhotoUrl?: string;
  totals: RentingAnalyticsMetrics;
}

export interface RentingAnalyticsListResult {
  window: RentingAnalyticsWindow;
  rentings: RentingAnalyticsListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  dataAvailability: RentingAnalyticsDataAvailability;
  range: RentingAnalyticsRange;
}

export interface RentingAnalyticsBucket {
  bucketStart: string;
  bucketEnd: string;
  granularity: RentingAnalyticsGranularity;
  metrics: RentingAnalyticsMetrics;
}

export interface RentingAnalyticsDetail {
  rentingId: string;
  name: string;
  status: string;
  primaryPhotoUrl?: string;
  window: RentingAnalyticsWindow;
  granularity: RentingAnalyticsGranularity;
  totals: RentingAnalyticsMetrics;
  buckets: RentingAnalyticsBucket[];
  dataAvailability: RentingAnalyticsDataAvailability;
  range: RentingAnalyticsRange;
}

export interface EnqueueRentingViewedEventInput {
  rentingId: string;
  ownerId: string;
  occurredAt: string;
  viewerHash: string;
  userId?: string;
  ipAddressHash?: string;
  userAgentHash?: string;
  deviceType: string;
}

export interface ProcessRentingViewedEventInput extends EnqueueRentingViewedEventInput {
  eventDate: string;
  eventHour: string;
}

export interface RentingAnalyticsOutboxRecord {
  id: string;
  rentingId: string;
  ownerId: string;
  eventType: "renting_viewed" | "booking_requested" | "booking_accepted" | "payment_captured";
  payload: Record<string, unknown>;
  attempts: number;
  availableAt: string;
  processingAt?: string;
  processedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentingAnalyticsSummaryInput {
  ownerId: string;
  window: RentingAnalyticsWindow;
}

export interface ListRentingAnalyticsInput extends RentingAnalyticsSummaryInput {
  page: number;
  pageSize: number;
}

export interface RentingAnalyticsDetailInput extends RentingAnalyticsSummaryInput {
  rentingId: string;
  granularity: RentingAnalyticsGranularity;
}
