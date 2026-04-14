import { z } from "zod";

export const MAX_RENTING_PHOTOS = 10;
export const MAX_BATCH_IDS = 50;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const rentingStatusSchema = z.enum(["draft", "published", "archived"]);
export const rentingAvailabilityStatusSchema = z.enum([
  "available",
  "limited",
  "unavailable",
]);
export const rentingSearchSourceSchema = z.enum(["elasticsearch", "database"]);
export const rentingSortSchema = z.enum(["relevance", "newest", "dailyPrice", "nearest"]);

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

export const rentingPricingSchema = z.object({
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

export const rentingAttributesSchema = z
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

export const rentingPhotoSchema = z.object({
  blobUrl: z.url("Photo URL must be a valid URL."),
  blobName: trimmedStringSchema.max(1024),
  position: z.number().int().min(0).max(MAX_RENTING_PHOTOS - 1),
});

export const rentingAvailabilityBlockSchema = z.object({
  startAt: z.string().datetime("Availability block start time must be an ISO datetime."),
  endAt: z.string().datetime("Availability block end time must be an ISO datetime."),
  note: nullableTrimmedStringSchema.pipe(z.string().trim().max(255).nullable().optional()),
});

export const upsertRentingRequestSchema = z.object({
  name: trimmedStringSchema.max(150),
  description: trimmedStringSchema.max(5000),
  pricing: rentingPricingSchema,
  photos: z.array(rentingPhotoSchema).min(1).max(MAX_RENTING_PHOTOS),
  tags: z.array(trimmedStringSchema.max(50)).max(30).default([]),
  attributes: rentingAttributesSchema,
  availabilityStatus: rentingAvailabilityStatusSchema,
  availabilityNotes: nullableTrimmedStringSchema.pipe(
    z.string().trim().max(500).nullable().optional(),
  ),
  availabilityBlocks: z.array(rentingAvailabilityBlockSchema).max(200).default([]),
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

export const listOwnerRentingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: rentingStatusSchema.optional(),
});

export const publicSearchRentingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: z.string().trim().min(1).max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  availabilityStatus: rentingAvailabilityStatusSchema.optional(),
  minDailyPrice: z.coerce.number().finite().nonnegative().optional(),
  maxDailyPrice: z.coerce.number().finite().nonnegative().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(20_000).optional(),
  sort: rentingSortSchema.default("relevance"),
});

export type RentingStatus = z.infer<typeof rentingStatusSchema>;
export type RentingAvailabilityStatus = z.infer<typeof rentingAvailabilityStatusSchema>;
export type RentingSearchSource = z.infer<typeof rentingSearchSourceSchema>;
export type RentingSort = z.infer<typeof rentingSortSchema>;
export type RentingPricing = z.infer<typeof rentingPricingSchema>;
export type RentingPhotoInput = z.infer<typeof rentingPhotoSchema>;
export type RentingAvailabilityBlockInput = z.infer<typeof rentingAvailabilityBlockSchema>;
export type UpsertRentingRequestBody = z.infer<typeof upsertRentingRequestSchema>;
export type ListOwnerRentingsQuery = z.infer<typeof listOwnerRentingsQuerySchema>;
export type PublicSearchRentingsQuery = z.infer<typeof publicSearchRentingsQuerySchema>;

export interface RentingPhotoRecord {
  id: string;
  blobUrl: string;
  blobName: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface RentingAvailabilityBlockRecord {
  id: string;
  startAt: string;
  endAt: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentingLocationRecord {
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
}

export interface PublicRentingLocationRecord {
  city: string;
  region: string;
  country: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
}

export interface RentingRecord {
  id: string;
  ownerId: string;
  status: RentingStatus;
  name: string;
  description: string;
  pricing: RentingPricing;
  pricingCurrency: string;
  photos: RentingPhotoRecord[];
  tags: string[];
  attributes: Record<string, string | number | boolean | string[]>;
  availabilityStatus: RentingAvailabilityStatus;
  availabilityNotes?: string;
  availabilityBlocks: RentingAvailabilityBlockRecord[];
  location: RentingLocationRecord;
  publishedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRentingRecord extends Omit<RentingRecord, "location"> {
  location: PublicRentingLocationRecord;
}

export interface RentingPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListOwnerRentingsResult {
  rentings: RentingRecord[];
  pagination: RentingPagination;
  status?: RentingStatus;
}

export interface BatchRentingsResult<TRecord> {
  rentings: TRecord[];
  missingIds: string[];
}

export interface SearchRentingsResult {
  rentings: PublicRentingRecord[];
  pagination: RentingPagination;
  source: RentingSearchSource;
  query?: string;
}

export interface RentingGeoInput {
  latitude: number;
  longitude: number;
}

export interface UpsertRentingInput {
  ownerId: string;
  name: string;
  description: string;
  pricing: RentingPricing;
  photos: RentingPhotoInput[];
  tags: string[];
  attributes: Record<string, string | number | boolean | string[]>;
  availabilityStatus: RentingAvailabilityStatus;
  availabilityNotes?: string | null;
  availabilityBlocks: RentingAvailabilityBlockInput[];
  location: RentingLocationRecord;
}

export interface ListOwnerRentingsInput {
  ownerId: string;
  page: number;
  pageSize: number;
  status?: RentingStatus;
}

export interface BatchOwnerRentingsInput {
  ownerId: string;
  ids: string[];
}

export interface BatchPublicRentingsInput {
  ids: string[];
}

export interface GetRentingInput {
  id: string;
  viewerId?: string;
}

export interface SearchRentingsInput {
  page: number;
  pageSize: number;
  query?: string;
  tags?: string[];
  availabilityStatus?: RentingAvailabilityStatus;
  minDailyPrice?: number;
  maxDailyPrice?: number;
  geo?: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
  sort: RentingSort;
}

export interface RentingSearchDocument {
  id: string;
  ownerId: string;
  status: RentingStatus;
  name: string;
  description: string;
  tags: string[];
  attributes: Record<string, string | number | boolean | string[]>;
  availabilityStatus: RentingAvailabilityStatus;
  pricing: RentingPricing;
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
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface RentingSearchOutboxRecord {
  id: string;
  rentingId: string;
  operation: "upsert" | "delete";
  attempts: number;
  availableAt: string;
  processingAt?: string;
  processedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}
