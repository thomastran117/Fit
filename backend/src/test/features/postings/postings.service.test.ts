import BadRequestError from "@/errors/http/bad-request.error";
import type {
  PostingRecord,
  UpsertPostingInput,
} from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { PostingsSearchService } from "@/features/postings/postings.search.service";
import { PostingsService } from "@/features/postings/postings.service";
import type { BlobService } from "@/features/blob/blob.service";
import { ContentSanitizationService } from "@/features/security/content-sanitization.service";

class FakePostingsRepository {
  createCalls = 0;
  updateCalls = 0;
  findByIdCalls = 0;

  async create(input: UpsertPostingInput): Promise<PostingRecord> {
    this.createCalls += 1;
    return buildPostingRecord(input);
  }

  async update(id: string, input: UpsertPostingInput): Promise<PostingRecord> {
    this.updateCalls += 1;
    return {
      ...buildPostingRecord(input),
      id,
    };
  }

  async findById(id: string): Promise<PostingRecord> {
    this.findByIdCalls += 1;

    return {
      ...buildPostingRecord(createValidInput()),
      id,
    };
  }
}

function createService(repository: FakePostingsRepository): PostingsService {
  const searchService = {} as PostingsSearchService;
  const blobService = {
    isConfigured: () => true,
    isManagedBlobUrl: () => true,
  } as unknown as BlobService;

  return new PostingsService(
    repository as unknown as PostingsRepository,
    searchService,
    blobService,
    new ContentSanitizationService(),
  );
}

function createValidInput(): UpsertPostingInput {
  return {
    ownerId: "owner-1",
    name: "Sunny loft near transit",
    description: "Bright loft with large windows, private balcony, and storage locker.",
    pricing: {
      currency: "cad",
      daily: {
        amount: 125,
      },
    },
    photos: [
      {
        blobUrl: "https://example.blob.core.windows.net/postings/photo-1.jpg",
        blobName: "postings/photo-1.jpg",
        position: 0,
      },
    ],
    tags: ["Loft", "Transit"],
    attributes: {
      furnished: true,
      petPolicy: "Cats allowed",
      amenities: ["washer", "dryer"],
    },
    availabilityStatus: "available",
    availabilityNotes: "Available immediately",
    maxBookingDurationDays: 14,
    availabilityBlocks: [
      {
        startAt: "2026-05-01T00:00:00.000Z",
        endAt: "2026-05-03T00:00:00.000Z",
        note: "Owner maintenance window",
      },
    ],
    location: {
      latitude: 43.6532,
      longitude: -79.3832,
      city: "Toronto",
      region: "Ontario",
      country: "Canada",
      postalCode: "M5H 2N2",
    },
  };
}

function buildPostingRecord(input: UpsertPostingInput): PostingRecord {
  return {
    id: "posting-1",
    ownerId: input.ownerId,
    status: "draft",
    name: input.name,
    description: input.description,
    pricing: input.pricing,
    pricingCurrency: input.pricing.currency,
    photos: input.photos.map((photo, index) => ({
      id: `photo-${index + 1}`,
      blobUrl: photo.blobUrl,
      blobName: photo.blobName,
      position: photo.position,
      createdAt: "2026-04-18T00:00:00.000Z",
      updatedAt: "2026-04-18T00:00:00.000Z",
    })),
    tags: input.tags,
    attributes: input.attributes,
    availabilityStatus: input.availabilityStatus,
    availabilityNotes: input.availabilityNotes ?? undefined,
    maxBookingDurationDays: input.maxBookingDurationDays ?? undefined,
    effectiveMaxBookingDurationDays: input.maxBookingDurationDays ?? 30,
    availabilityBlocks: input.availabilityBlocks.map((block, index) => ({
      id: `block-${index + 1}`,
      startAt: block.startAt,
      endAt: block.endAt,
      note: block.note ?? undefined,
      createdAt: "2026-04-18T00:00:00.000Z",
      updatedAt: "2026-04-18T00:00:00.000Z",
    })),
    location: input.location,
    createdAt: "2026-04-18T00:00:00.000Z",
    updatedAt: "2026-04-18T00:00:00.000Z",
  };
}

function getValidationDetails(error: unknown): Array<{ path: string; message: string }> {
  expect(error).toBeInstanceOf(BadRequestError);
  expect(Array.isArray((error as BadRequestError).details)).toBe(true);
  return (error as BadRequestError).details as Array<{ path: string; message: string }>;
}

describe("PostingsService", () => {
  it("rejects unsafe content before create persists", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);
    const input = createValidInput();
    input.description = "<script>alert('boom')</script>";

    const error = await service.createDraft(input).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BadRequestError);
    const details = getValidationDetails(error);
    expect(details[0]?.path).toBe("description");

    expect(repository.createCalls).toBe(0);
  });

  it("rejects unsafe attribute and block note paths on create", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);
    const input = createValidInput();
    input.attributes.petPolicy = "No shitty behavior";
    input.availabilityBlocks[0]!.note = "javascript:alert('x')";

    const error = await service.createDraft(input).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BadRequestError);
    const details = getValidationDetails(error);
    expect(details.map((detail) => detail.path).sort()).toEqual([
      "attributes.petPolicy",
      "availabilityBlocks.0.note",
    ]);

    expect(repository.createCalls).toBe(0);
  });

  it("rejects unsafe content before update persists", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);
    const input = createValidInput();
    input.tags = ["safe", "' OR 1=1 --"];

    const error = await service
      .update("posting-123", input)
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BadRequestError);
    const details = getValidationDetails(error);
    expect(details[0]?.path).toBe("tags.1");

    expect(repository.findByIdCalls).toBe(1);
    expect(repository.updateCalls).toBe(0);
  });

  it("accepts clean content and persists normalized data", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);
    const input = createValidInput();
    input.tags = ["  Loft  ", "loft", "Transit"];

    const created = await service.createDraft(input);

    expect(repository.createCalls).toBe(1);
    expect(created.tags).toEqual(["loft", "transit"]);
  });
});
