import BadRequestError from "@/errors/http/bad-request.error";
import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type { BlobService } from "@/features/blob/blob.service";
import {
  DEFAULT_MAX_BOOKING_DURATION_DAYS,
  MAX_BATCH_IDS,
  MAX_BOOKING_DURATION_DAYS_LIMIT,
  MAX_POSTING_PHOTOS,
  type BatchPostingsResult,
  type ListOwnerPostingsInput,
  type ListOwnerPostingsResult,
  type PublicPostingRecord,
  type PostingAvailabilityBlockInput,
  type PostingPhotoInput,
  type PostingPricing,
  type PostingRecord,
  type SearchPostingsInput,
  type SearchPostingsResult,
  type UpsertPostingInput,
} from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { PostingsSearchService } from "@/features/postings/postings.search.service";

export class PostingsService {
  constructor(
    private readonly postingsRepository: PostingsRepository,
    private readonly postingsSearchService: PostingsSearchService,
    private readonly blobService: BlobService,
  ) {}

  async createDraft(input: UpsertPostingInput): Promise<PostingRecord> {
    const normalizedInput = this.normalizeUpsertInput(input);
    this.assertPublishableDraftShape(normalizedInput);

    return this.postingsRepository.create(normalizedInput);
  }

  async update(id: string, input: UpsertPostingInput): Promise<PostingRecord> {
    const existing = await this.requireOwnerPosting(id, input.ownerId);
    const normalizedInput = this.normalizeUpsertInput(input);
    this.assertPublishableDraftShape(normalizedInput);

    const updated = await this.postingsRepository.update(existing.id, normalizedInput);

    if (!updated) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    return updated;
  }

  async publish(id: string, ownerId: string): Promise<PostingRecord> {
    const posting = await this.requireOwnerPosting(id, ownerId);
    this.assertCanPublish(posting);

    const published = await this.postingsRepository.publish(id, ownerId);

    if (!published) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    return published;
  }

  async archive(id: string, ownerId: string): Promise<PostingRecord> {
    await this.requireOwnerPosting(id, ownerId);
    const archived = await this.postingsRepository.archive(id, ownerId);

    if (!archived) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    return archived;
  }

  async getById(id: string, viewerId?: string): Promise<PostingRecord | PublicPostingRecord> {
    const posting = await this.postingsRepository.findById(id);

    if (!posting) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    if (viewerId && posting.ownerId === viewerId) {
      return posting;
    }

    if (posting.status !== "published" || posting.archivedAt) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    return this.toPublicPosting(posting);
  }

  async listByOwner(input: ListOwnerPostingsInput): Promise<ListOwnerPostingsResult> {
    return this.postingsRepository.listByOwner(input);
  }

  async batchByOwner(ownerId: string, ids: string[]): Promise<BatchPostingsResult<PostingRecord>> {
    const normalizedIds = this.normalizeBatchIds(ids);

    return this.postingsRepository.batchFindByOwner({
      ownerId,
      ids: normalizedIds,
    });
  }

  async batchPublic(ids: string[]): Promise<BatchPostingsResult<PublicPostingRecord>> {
    const normalizedIds = this.normalizeBatchIds(ids);
    const batch = await this.postingsRepository.batchFindPublic({
      ids: normalizedIds,
    });

    return {
      postings: batch.postings.map((posting) => this.toPublicPosting(posting)),
      missingIds: batch.missingIds,
    };
  }

  async searchPublic(input: SearchPostingsInput): Promise<SearchPostingsResult> {
    this.assertValidSearchInput(input);
    return this.postingsSearchService.searchPublic({
      ...input,
      query: input.query?.trim() || undefined,
      tags: input.tags?.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    });
  }

  private normalizeUpsertInput(input: UpsertPostingInput): UpsertPostingInput {
    const normalizedPhotos = this.normalizePhotos(input.photos);
    const normalizedBlocks = this.normalizeAvailabilityBlocks(input.availabilityBlocks);
    const normalizedTags = Array.from(
      new Set(
        input.tags
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0),
      ),
    );
    const normalizedPricing = this.normalizePricing(input.pricing);

    return {
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
      pricing: normalizedPricing,
      photos: normalizedPhotos,
      tags: normalizedTags,
      attributes: this.normalizeAttributes(input.attributes),
      availabilityStatus: input.availabilityStatus,
      availabilityNotes: input.availabilityNotes?.trim() || null,
      maxBookingDurationDays: input.maxBookingDurationDays ?? null,
      availabilityBlocks: normalizedBlocks,
      location: {
        ...input.location,
        city: input.location.city.trim(),
        region: input.location.region.trim(),
        country: input.location.country.trim(),
        postalCode: input.location.postalCode?.trim() || undefined,
      },
    };
  }

  private normalizePhotos(photos: PostingPhotoInput[]): PostingPhotoInput[] {
    if (photos.length === 0) {
      throw new BadRequestError("At least one photo is required.");
    }

    if (photos.length > MAX_POSTING_PHOTOS) {
      throw new BadRequestError(`A posting can include at most ${MAX_POSTING_PHOTOS} photos.`);
    }

    const uniquePositions = new Set<number>();

    for (const photo of photos) {
      if (uniquePositions.has(photo.position)) {
        throw new BadRequestError("Photo positions must be unique.");
      }

      uniquePositions.add(photo.position);
      this.assertManagedBlob(photo.blobUrl, photo.blobName);
    }

    return photos
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((photo, index) => ({
        ...photo,
        position: index,
      }));
  }

  private normalizeAvailabilityBlocks(
    blocks: PostingAvailabilityBlockInput[],
  ): PostingAvailabilityBlockInput[] {
    const normalized = blocks
      .map((block) => ({
        ...block,
        note: block.note?.trim() || undefined,
      }))
      .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());

    for (const block of normalized) {
      const startAt = new Date(block.startAt);
      const endAt = new Date(block.endAt);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
        throw new BadRequestError("Availability block dates must define a valid, non-empty range.");
      }
    }

    for (let index = 1; index < normalized.length; index += 1) {
      const previous = normalized[index - 1];
      const current = normalized[index];

      if (new Date(current.startAt) < new Date(previous.endAt)) {
        throw new BadRequestError("Availability blocks may not overlap.");
      }
    }

    return normalized;
  }

  private normalizePricing(pricing: PostingPricing): PostingPricing {
    return {
      currency: pricing.currency.trim().toUpperCase(),
      daily: {
        amount: pricing.daily.amount,
      },
      ...(pricing.hourly ? { hourly: { amount: pricing.hourly.amount } } : {}),
      ...(pricing.weekly ? { weekly: { amount: pricing.weekly.amount } } : {}),
      ...(pricing.monthly ? { monthly: { amount: pricing.monthly.amount } } : {}),
    };
  }

  private normalizeAttributes(
    attributes: Record<string, string | number | boolean | string[]>,
  ): Record<string, string | number | boolean | string[]> {
    return Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [
        key.trim(),
        Array.isArray(value) ? value.map((entry) => entry.trim()) : value,
      ]),
    );
  }

  private assertCanPublish(posting: PostingRecord): void {
    if (posting.photos.length < 1 || posting.photos.length > MAX_POSTING_PHOTOS) {
      throw new BadRequestError("Published postings must include between 1 and 10 photos.");
    }

    if (!posting.pricing.daily?.amount || posting.pricing.daily.amount <= 0) {
      throw new BadRequestError("Published postings must include a valid daily price.");
    }

    if (!this.isValidCoordinate(posting.location.latitude, -90, 90)) {
      throw new BadRequestError("Published postings must include a valid latitude.");
    }

    if (!this.isValidCoordinate(posting.location.longitude, -180, 180)) {
      throw new BadRequestError("Published postings must include a valid longitude.");
    }
  }

  private assertPublishableDraftShape(input: UpsertPostingInput): void {
    if (!input.name.trim()) {
      throw new BadRequestError("Posting name is required.");
    }

    if (!input.description.trim()) {
      throw new BadRequestError("Posting description is required.");
    }

    if (!input.pricing.daily || input.pricing.daily.amount <= 0) {
      throw new BadRequestError("Posting daily pricing is required.");
    }

    if (!this.isValidCoordinate(input.location.latitude, -90, 90)) {
      throw new BadRequestError("Latitude must be between -90 and 90.");
    }

    if (!this.isValidCoordinate(input.location.longitude, -180, 180)) {
      throw new BadRequestError("Longitude must be between -180 and 180.");
    }

    if (
      input.maxBookingDurationDays !== undefined &&
      input.maxBookingDurationDays !== null &&
      (!Number.isInteger(input.maxBookingDurationDays) ||
        input.maxBookingDurationDays < 1 ||
        input.maxBookingDurationDays > MAX_BOOKING_DURATION_DAYS_LIMIT)
    ) {
      throw new BadRequestError(
        `Maximum booking duration must be an integer between 1 and ${MAX_BOOKING_DURATION_DAYS_LIMIT} days.`,
      );
    }
  }

  private assertManagedBlob(blobUrl: string, blobName: string): void {
    if (!this.blobService.isConfigured()) {
      throw new BadRequestError(
        "Posting photos require Azure Blob Storage to be configured on the backend.",
      );
    }

    if (!this.blobService.isManagedBlobUrl(blobUrl, blobName)) {
      throw new BadRequestError(
        "Posting photo URLs must match the configured Azure Blob Storage location.",
      );
    }
  }

  private assertValidSearchInput(input: SearchPostingsInput): void {
    if (
      input.minDailyPrice !== undefined &&
      input.maxDailyPrice !== undefined &&
      input.minDailyPrice > input.maxDailyPrice
    ) {
      throw new BadRequestError("Minimum daily price cannot exceed maximum daily price.");
    }

    if (input.sort === "nearest" && !input.geo) {
      throw new BadRequestError("Nearest sorting requires latitude and longitude.");
    }

    if (input.availabilityWindow) {
      const startAt = new Date(input.availabilityWindow.startAt);
      const endAt = new Date(input.availabilityWindow.endAt);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
        throw new BadRequestError("Availability window must define a valid, non-empty range.");
      }
    }
  }

  private async requireOwnerPosting(id: string, ownerId: string): Promise<PostingRecord> {
    const posting = await this.postingsRepository.findById(id);

    if (!posting) {
      throw new ResourceNotFoundError("Posting could not be found.");
    }

    if (posting.ownerId !== ownerId) {
      throw new ForbiddenError("You do not have access to this posting.");
    }

    return posting;
  }

  private normalizeBatchIds(ids: string[]): string[] {
    const normalized = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

    if (normalized.length === 0) {
      throw new BadRequestError("At least one posting id is required.");
    }

    if (normalized.length > MAX_BATCH_IDS) {
      throw new BadRequestError(`At most ${MAX_BATCH_IDS} posting ids may be requested at once.`);
    }

    return normalized;
  }

  private toPublicPosting(posting: PostingRecord | PublicPostingRecord): PublicPostingRecord {
    return {
      ...posting,
      effectiveMaxBookingDurationDays:
        posting.maxBookingDurationDays ?? DEFAULT_MAX_BOOKING_DURATION_DAYS,
      location: {
        city: posting.location.city,
        region: posting.location.region,
        country: posting.location.country,
        postalCode: posting.location.postalCode,
        latitude: Number(posting.location.latitude.toFixed(2)),
        longitude: Number(posting.location.longitude.toFixed(2)),
      },
    };
  }

  private isValidCoordinate(value: number, min: number, max: number): boolean {
    return Number.isFinite(value) && value >= min && value <= max;
  }
}

