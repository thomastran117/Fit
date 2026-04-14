import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/features/rentings/rentings.model";

const optionalReviewTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .nullable()
  .optional();

export const createRentingReviewRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .nullable()
    .optional(),
  comment: optionalReviewTextSchema,
});

export const updateRentingReviewRequestSchema = createRentingReviewRequestSchema;

export const listRentingReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type CreateRentingReviewRequestBody = z.infer<typeof createRentingReviewRequestSchema>;
export type UpdateRentingReviewRequestBody = z.infer<typeof updateRentingReviewRequestSchema>;
export type ListRentingReviewsQuery = z.infer<typeof listRentingReviewsQuerySchema>;

export interface RentingReviewRecord {
  id: string;
  rentingId: string;
  reviewerId: string;
  rating: number;
  title?: string;
  comment?: string;
  reviewer: {
    username?: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RentingReviewSummary {
  averageRating: number;
  reviewCount: number;
}

export interface ListRentingReviewsResult {
  reviews: RentingReviewRecord[];
  summary: RentingReviewSummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface UpsertRentingReviewInput {
  rentingId: string;
  reviewerId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
}
