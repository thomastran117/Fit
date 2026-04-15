import { z } from "zod";
import { MAX_PAGE_SIZE } from "@/features/postings/postings.model";

export const postingAnalyticsWindowSchema = z.enum(["7d", "30d", "all"]);
export const postingAnalyticsGranularitySchema = z.enum(["hour", "day"]);

export const postingAnalyticsSummaryQuerySchema = z.object({
  window: postingAnalyticsWindowSchema.default("7d"),
});

export const listPostingAnalyticsQuerySchema = z.object({
  window: postingAnalyticsWindowSchema.default("7d"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export const postingAnalyticsDetailQuerySchema = z.object({
  window: postingAnalyticsWindowSchema.default("7d"),
  granularity: postingAnalyticsGranularitySchema.default("day"),
});

export type PostingAnalyticsWindow = z.infer<typeof postingAnalyticsWindowSchema>;
export type PostingAnalyticsGranularity = z.infer<typeof postingAnalyticsGranularitySchema>;
export type PostingAnalyticsSummaryQuery = z.infer<typeof postingAnalyticsSummaryQuerySchema>;
export type ListPostingAnalyticsQuery = z.infer<typeof listPostingAnalyticsQuerySchema>;
export type PostingAnalyticsDetailQuery = z.infer<typeof postingAnalyticsDetailQuerySchema>;

export interface PostingAnalyticsMetrics {
  views: number;
  uniqueViews: number;
  bookingRequests: number;
  estimatedRevenue: number;
}

export interface PostingAnalyticsDataAvailability {
  views: "live";
  bookingRequests: "pending";
  estimatedRevenue: "pending";
  isPartial: boolean;
}

export interface PostingAnalyticsRange {
  startAt?: string;
  endAt: string;
}

export interface OwnerPostingsAnalyticsSummary {
  window: PostingAnalyticsWindow;
  totals: PostingAnalyticsMetrics;
  dataAvailability: PostingAnalyticsDataAvailability;
  range: PostingAnalyticsRange;
}

export interface PostingAnalyticsListItem {
  postingId: string;
  name: string;
  status: string;
  primaryPhotoUrl?: string;
  totals: PostingAnalyticsMetrics;
}

export interface PostingAnalyticsListResult {
  window: PostingAnalyticsWindow;
  postings: PostingAnalyticsListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  dataAvailability: PostingAnalyticsDataAvailability;
  range: PostingAnalyticsRange;
}

export interface PostingAnalyticsBucket {
  bucketStart: string;
  bucketEnd: string;
  granularity: PostingAnalyticsGranularity;
  metrics: PostingAnalyticsMetrics;
}

export interface PostingAnalyticsDetail {
  postingId: string;
  name: string;
  status: string;
  primaryPhotoUrl?: string;
  window: PostingAnalyticsWindow;
  granularity: PostingAnalyticsGranularity;
  totals: PostingAnalyticsMetrics;
  buckets: PostingAnalyticsBucket[];
  dataAvailability: PostingAnalyticsDataAvailability;
  range: PostingAnalyticsRange;
}

export interface EnqueuePostingViewedEventInput {
  postingId: string;
  ownerId: string;
  occurredAt: string;
  viewerHash: string;
  userId?: string;
  ipAddressHash?: string;
  userAgentHash?: string;
  deviceType: string;
}

export interface EnqueueBookingRequestedEventInput {
  postingId: string;
  ownerId: string;
  occurredAt: string;
  estimatedTotal: number;
}

export interface ProcessPostingViewedEventInput extends EnqueuePostingViewedEventInput {
  eventDate: string;
  eventHour: string;
}

export interface ProcessBookingRequestedEventInput extends EnqueueBookingRequestedEventInput {
  eventDate: string;
  eventHour: string;
}

export interface PostingAnalyticsOutboxRecord {
  id: string;
  postingId: string;
  ownerId: string;
  eventType: "posting_viewed" | "booking_requested" | "booking_accepted" | "payment_captured";
  payload: Record<string, unknown>;
  attempts: number;
  availableAt: string;
  processingAt?: string;
  processedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostingAnalyticsSummaryInput {
  ownerId: string;
  window: PostingAnalyticsWindow;
}

export interface ListPostingAnalyticsInput extends PostingAnalyticsSummaryInput {
  page: number;
  pageSize: number;
}

export interface PostingAnalyticsDetailInput extends PostingAnalyticsSummaryInput {
  postingId: string;
  granularity: PostingAnalyticsGranularity;
}

