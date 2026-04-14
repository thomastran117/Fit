import BadRequestError from "@/errors/http/bad-request.error";
import ForbiddenError from "@/errors/http/forbidden.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type { BlobService } from "@/features/blob/blob.service";
import {
  MAX_BATCH_IDS,
  MAX_RENTING_PHOTOS,
  type BatchRentingsResult,
  type ListOwnerRentingsInput,
  type ListOwnerRentingsResult,
  type PublicRentingRecord,
  type RentingAvailabilityBlockInput,
  type RentingPhotoInput,
  type RentingPricing,
  type RentingRecord,
  type SearchRentingsInput,
  type SearchRentingsResult,
  type UpsertRentingInput,
} from "@/features/rentings/rentings.model";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";
import type { RentingsSearchService } from "@/features/rentings/rentings.search.service";

export class RentingsService {
  constructor(
    private readonly rentingsRepository: RentingsRepository,
    private readonly rentingsSearchService: RentingsSearchService,
    private readonly blobService: BlobService,
  ) {}

  async createDraft(input: UpsertRentingInput): Promise<RentingRecord> {
    const normalizedInput = this.normalizeUpsertInput(input);
    this.assertPublishableDraftShape(normalizedInput);

    return this.rentingsRepository.create(normalizedInput);
  }

  async update(id: string, input: UpsertRentingInput): Promise<RentingRecord> {
    const existing = await this.requireOwnerRenting(id, input.ownerId);
    const normalizedInput = this.normalizeUpsertInput(input);
    this.assertPublishableDraftShape(normalizedInput);

    const updated = await this.rentingsRepository.update(existing.id, normalizedInput);

    if (!updated) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    return updated;
  }

  async publish(id: string, ownerId: string): Promise<RentingRecord> {
    const renting = await this.requireOwnerRenting(id, ownerId);
    this.assertCanPublish(renting);

    const published = await this.rentingsRepository.publish(id, ownerId);

    if (!published) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    return published;
  }

  async archive(id: string, ownerId: string): Promise<RentingRecord> {
    await this.requireOwnerRenting(id, ownerId);
    const archived = await this.rentingsRepository.archive(id, ownerId);

    if (!archived) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    return archived;
  }

  async getById(id: string, viewerId?: string): Promise<RentingRecord | PublicRentingRecord> {
    const renting = await this.rentingsRepository.findById(id);

    if (!renting) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    if (viewerId && renting.ownerId === viewerId) {
      return renting;
    }

    if (renting.status !== "published" || renting.archivedAt) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    return this.toPublicRenting(renting);
  }

  async listByOwner(input: ListOwnerRentingsInput): Promise<ListOwnerRentingsResult> {
    return this.rentingsRepository.listByOwner(input);
  }

  async batchByOwner(ownerId: string, ids: string[]): Promise<BatchRentingsResult<RentingRecord>> {
    const normalizedIds = this.normalizeBatchIds(ids);

    return this.rentingsRepository.batchFindByOwner({
      ownerId,
      ids: normalizedIds,
    });
  }

  async batchPublic(ids: string[]): Promise<BatchRentingsResult<PublicRentingRecord>> {
    const normalizedIds = this.normalizeBatchIds(ids);
    const batch = await this.rentingsRepository.batchFindPublic({
      ids: normalizedIds,
    });

    return {
      rentings: batch.rentings.map((renting) => this.toPublicRenting(renting)),
      missingIds: batch.missingIds,
    };
  }

  async searchPublic(input: SearchRentingsInput): Promise<SearchRentingsResult> {
    this.assertValidSearchInput(input);
    return this.rentingsSearchService.searchPublic({
      ...input,
      query: input.query?.trim() || undefined,
      tags: input.tags?.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
    });
  }

  private normalizeUpsertInput(input: UpsertRentingInput): UpsertRentingInput {
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

  private normalizePhotos(photos: RentingPhotoInput[]): RentingPhotoInput[] {
    if (photos.length === 0) {
      throw new BadRequestError("At least one photo is required.");
    }

    if (photos.length > MAX_RENTING_PHOTOS) {
      throw new BadRequestError(`A renting can include at most ${MAX_RENTING_PHOTOS} photos.`);
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
    blocks: RentingAvailabilityBlockInput[],
  ): RentingAvailabilityBlockInput[] {
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

  private normalizePricing(pricing: RentingPricing): RentingPricing {
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

  private assertCanPublish(renting: RentingRecord): void {
    if (renting.photos.length < 1 || renting.photos.length > MAX_RENTING_PHOTOS) {
      throw new BadRequestError("Published rentings must include between 1 and 10 photos.");
    }

    if (!renting.pricing.daily?.amount || renting.pricing.daily.amount <= 0) {
      throw new BadRequestError("Published rentings must include a valid daily price.");
    }

    if (!this.isValidCoordinate(renting.location.latitude, -90, 90)) {
      throw new BadRequestError("Published rentings must include a valid latitude.");
    }

    if (!this.isValidCoordinate(renting.location.longitude, -180, 180)) {
      throw new BadRequestError("Published rentings must include a valid longitude.");
    }
  }

  private assertPublishableDraftShape(input: UpsertRentingInput): void {
    if (!input.name.trim()) {
      throw new BadRequestError("Renting name is required.");
    }

    if (!input.description.trim()) {
      throw new BadRequestError("Renting description is required.");
    }

    if (!input.pricing.daily || input.pricing.daily.amount <= 0) {
      throw new BadRequestError("Renting daily pricing is required.");
    }

    if (!this.isValidCoordinate(input.location.latitude, -90, 90)) {
      throw new BadRequestError("Latitude must be between -90 and 90.");
    }

    if (!this.isValidCoordinate(input.location.longitude, -180, 180)) {
      throw new BadRequestError("Longitude must be between -180 and 180.");
    }
  }

  private assertManagedBlob(blobUrl: string, blobName: string): void {
    if (!this.blobService.isConfigured()) {
      throw new BadRequestError(
        "Renting photos require Azure Blob Storage to be configured on the backend.",
      );
    }

    if (!this.blobService.isManagedBlobUrl(blobUrl, blobName)) {
      throw new BadRequestError(
        "Renting photo URLs must match the configured Azure Blob Storage location.",
      );
    }
  }

  private assertValidSearchInput(input: SearchRentingsInput): void {
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
  }

  private async requireOwnerRenting(id: string, ownerId: string): Promise<RentingRecord> {
    const renting = await this.rentingsRepository.findById(id);

    if (!renting) {
      throw new ResourceNotFoundError("Renting could not be found.");
    }

    if (renting.ownerId !== ownerId) {
      throw new ForbiddenError("You do not have access to this renting.");
    }

    return renting;
  }

  private normalizeBatchIds(ids: string[]): string[] {
    const normalized = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

    if (normalized.length === 0) {
      throw new BadRequestError("At least one renting id is required.");
    }

    if (normalized.length > MAX_BATCH_IDS) {
      throw new BadRequestError(`At most ${MAX_BATCH_IDS} renting ids may be requested at once.`);
    }

    return normalized;
  }

  private toPublicRenting(renting: RentingRecord | PublicRentingRecord): PublicRentingRecord {
    return {
      ...renting,
      location: {
        city: renting.location.city,
        region: renting.location.region,
        country: renting.location.country,
        postalCode: renting.location.postalCode,
        latitude: Number(renting.location.latitude.toFixed(2)),
        longitude: Number(renting.location.longitude.toFixed(2)),
      },
    };
  }

  private isValidCoordinate(value: number, min: number, max: number): boolean {
    return Number.isFinite(value) && value >= min && value <= max;
  }
}
