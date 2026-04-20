import { z } from "zod";
import {
  POSTING_FAMILY_VALUES,
  POSTING_SUBTYPE_VALUES,
  type PostingAttributeValue as VariantPostingAttributeValue,
} from "@/features/postings/postings.variants";

export const MAX_POSTING_PHOTOS = 10;
export const MAX_BATCH_IDS = 50;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_MAX_BOOKING_DURATION_DAYS = 30;
export const MAX_BOOKING_DURATION_DAYS_LIMIT = 365;

export const postingStatusSchema = z.enum(["draft", "published", "archived"]);
export const postingAvailabilityStatusSchema = z.enum([
  "available",
  "limited",
  "unavailable",
]);
export const postingFamilySchema = z.enum(POSTING_FAMILY_VALUES);
export const postingSubtypeSchema = z.enum(POSTING_SUBTYPE_VALUES);
export const postingSearchSourceSchema = z.enum(["elasticsearch", "database"]);
export const postingSortSchema = z.enum(["relevance", "newest", "dailyPrice", "nearest"]);

const trimmedStringSchema = z.string().trim().min(1);
const nullableTrimmedStringSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional();

const moneyAmountSchema = z
  .number()
  .finite("Amount must be a valid number.")
  .positive("Amount must be greater than zero.");

const pricingRateSchema = z.object({
  amount: moneyAmountSchema,
});

export const postingPricingSchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter ISO code.")
    .transform((value) => value.toUpperCase()),
  daily: pricingRateSchema,
  hourly: pricingRateSchema.optional(),
  weekly: pricingRateSchema.optional(),
  monthly: pricingRateSchema.optional(),
});

const primitiveAttributeSchema = z.union([
  z.string().trim().min(1).max(100),
  z.number().finite(),
  z.boolean(),
]);

const attributeValueSchema = z.union([
  primitiveAttributeSchema,
  z.array(z.string().trim().min(1).max(100)).max(20),
]);

export const postingAttributesSchema = z
  .record(
    z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(
        /^[a-z][a-z0-9_]*$/i,
        "Attribute keys must start with a letter and contain only letters, numbers, and underscores.",
      ),
    attributeValueSchema,
  )
  .default({});

export const postingVariantSchema = z.object({
  family: postingFamilySchema,
  subtype: postingSubtypeSchema,
});

export const postingPhotoSchema = z.object({
  blobUrl: z.url("Photo URL must be a valid URL."),
  blobName: trimmedStringSchema.max(1024),
  position: z.number().int().min(0).max(MAX_POSTING_PHOTOS - 1),
});

export const postingAvailabilityBlockSchema = z.object({
  startAt: z.string().datetime("Availability block start time must be an ISO datetime."),
  endAt: z.string().datetime("Availability block end time must be an ISO datetime."),
  note: nullableTrimmedStringSchema.pipe(z.string().trim().max(255).nullable().optional()),
});

export const upsertPostingRequestSchema = z.object({
  variant: postingVariantSchema,
  name: trimmedStringSchema.max(150),
  description: trimmedStringSchema.max(5000),
  pricing: postingPricingSchema,
  photos: z.array(postingPhotoSchema).min(1).max(MAX_POSTING_PHOTOS),
  tags: z.array(trimmedStringSchema.max(50)).max(30).default([]),
  attributes: postingAttributesSchema,
  availabilityStatus: postingAvailabilityStatusSchema,
  availabilityNotes: nullableTrimmedStringSchema.pipe(
    z.string().trim().max(500).nullable().optional(),
  ),
  maxBookingDurationDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_BOOKING_DURATION_DAYS_LIMIT)
    .nullable()
    .optional(),
  availabilityBlocks: z.array(postingAvailabilityBlockSchema).max(200).default([]),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    city: trimmedStringSchema.max(120),
    region: trimmedStringSchema.max(120),
    country: trimmedStringSchema.max(120),
    postalCode: nullableTrimmedStringSchema.pipe(
      z.string().trim().max(32).nullable().optional(),
    ),
  }),
});

export const listOwnerPostingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: postingStatusSchema.optional(),
});

export const publicSearchPostingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: z.string().trim().min(1).max(120).optional(),
  family: postingFamilySchema.optional(),
  subtype: postingSubtypeSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  availabilityStatus: postingAvailabilityStatusSchema.optional(),
  minDailyPrice: z.coerce.number().finite().nonnegative().optional(),
  maxDailyPrice: z.coerce.number().finite().nonnegative().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(20_000).optional(),
  startAt: z.string().datetime("Search start time must be an ISO datetime.").optional(),
  endAt: z.string().datetime("Search end time must be an ISO datetime.").optional(),
  sort: postingSortSchema.default("relevance"),
});

export type PostingStatus = z.infer<typeof postingStatusSchema>;
export type PostingAvailabilityStatus = z.infer<typeof postingAvailabilityStatusSchema>;
export type PostingFamily = z.infer<typeof postingFamilySchema>;
export type PostingSubtype = z.infer<typeof postingSubtypeSchema>;
export type PostingSearchSource = z.infer<typeof postingSearchSourceSchema>;
export type PostingSort = z.infer<typeof postingSortSchema>;
export type PostingPricing = z.infer<typeof postingPricingSchema>;
export type PostingVariant = z.infer<typeof postingVariantSchema>;
export type PostingAttributeValue = VariantPostingAttributeValue;
export type PostingPhotoInput = z.infer<typeof postingPhotoSchema>;
export type PostingAvailabilityBlockInput = z.infer<typeof postingAvailabilityBlockSchema>;
export type UpsertPostingRequestBody = z.infer<typeof upsertPostingRequestSchema>;
export type ListOwnerPostingsQuery = z.infer<typeof listOwnerPostingsQuerySchema>;
export type PublicSearchPostingsQuery = z.infer<typeof publicSearchPostingsQuerySchema>;

export interface PostingPhotoRecord {
  id: string;
  blobUrl: string;
  blobName: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostingAvailabilityBlockRecord {
  id: string;
  startAt: string;
  endAt: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostingLocationRecord {
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
}

export interface PublicPostingLocationRecord {
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
}

export interface PostingRecord {
  id: string;
  ownerId: string;
  status: PostingStatus;
  variant: PostingVariant;
  name: string;
  description: string;
  pricing: PostingPricing;
  pricingCurrency: string;
  photos: PostingPhotoRecord[];
  tags: string[];
  attributes: Record<string, PostingAttributeValue>;
  availabilityStatus: PostingAvailabilityStatus;
  availabilityNotes?: string;
  maxBookingDurationDays?: number;
  effectiveMaxBookingDurationDays: number;
  availabilityBlocks: PostingAvailabilityBlockRecord[];
  location: PostingLocationRecord;
  publishedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPostingRecord extends Omit<PostingRecord, "location"> {
  location: PublicPostingLocationRecord;
}

export interface PostingPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListOwnerPostingsResult {
  postings: PostingRecord[];
  pagination: PostingPagination;
  status?: PostingStatus;
}

export interface BatchPostingsResult<TRecord> {
  postings: TRecord[];
  missingIds: string[];
}

export interface SearchPostingsResult {
  postings: PublicPostingRecord[];
  pagination: PostingPagination;
  source: PostingSearchSource;
  query?: string;
}

export interface PostingGeoInput {
  latitude: number;
  longitude: number;
}

export interface UpsertPostingInput {
  ownerId: string;
  variant: PostingVariant;
  name: string;
  description: string;
  pricing: PostingPricing;
  photos: PostingPhotoInput[];
  tags: string[];
  attributes: Record<string, PostingAttributeValue>;
  availabilityStatus: PostingAvailabilityStatus;
  availabilityNotes?: string | null;
  maxBookingDurationDays?: number | null;
  availabilityBlocks: PostingAvailabilityBlockInput[];
  location: PostingLocationRecord;
}

export interface ListOwnerPostingsInput {
  ownerId: string;
  page: number;
  pageSize: number;
  status?: PostingStatus;
}

export interface BatchOwnerPostingsInput {
  ownerId: string;
  ids: string[];
}

export interface BatchPublicPostingsInput {
  ids: string[];
}

export interface GetPostingInput {
  id: string;
  viewerId?: string;
}

export interface SearchPostingsInput {
  page: number;
  pageSize: number;
  query?: string;
  family?: PostingFamily;
  subtype?: PostingSubtype;
  tags?: string[];
  availabilityStatus?: PostingAvailabilityStatus;
  minDailyPrice?: number;
  maxDailyPrice?: number;
  geo?: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
  availabilityWindow?: {
    startAt: string;
    endAt: string;
  };
  sort: PostingSort;
}

export interface PostingSearchDocument {
  id: string;
  ownerId: string;
  status: PostingStatus;
  variant: PostingVariant;
  name: string;
  description: string;
  tags: string[];
  availabilityStatus: PostingAvailabilityStatus;
  searchableAttributes: Record<string, PostingAttributeValue>;
  pricing: PostingPricing;
  pricingCurrency: string;
  location: {
    latitude: number;
    longitude: number;
    city: string;
    region: string;
    country: string;
    postalCode?: string;
  };
  photos: Array<{
    blobUrl: string;
    position: number;
  }>;
  blockedRanges: Array<{
    startAt: string;
    endAt: string;
    source: "availability_block" | "booking_request" | "renting";
  }>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface PostingSearchOutboxRecord {
  id: string;
  postingId?: string;
  reindexRunId?: string;
  operation: "upsert" | "delete" | "barrier";
  dedupeKey: string;
  targetIndexName?: string;
  attempts: number;
  publishAttempts: number;
  availableAt: string;
  processingAt?: string;
  publishedAt?: string;
  indexedAt?: string;
  deadLetteredAt?: string;
  brokerMessageId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

