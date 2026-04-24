import BadRequestError from "@/errors/http/bad-request.error";
import ConflictError from "@/errors/http/conflict.error";
import ResourceNotFoundError from "@/errors/http/resource-not-found.error";
import type {
  PostingAvailabilityBlockInput,
  PostingAvailabilityBlockRecord,
  PostingRecord,
  UpsertPostingInput,
} from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { PostingsSearchService } from "@/features/postings/postings.search.service";
import { PostingsService } from "@/features/postings/postings.service";
import type { BlobService } from "@/features/blob/blob.service";
import type { CacheService } from "@/features/cache/cache.service";
import { ContentSanitizationService } from "@/features/security/content-sanitization.service";

class FakePostingsRepository {
  createCalls = 0;
  updateCalls = 0;
  findByIdCalls = 0;
  publishCalls = 0;
  pauseCalls = 0;
  unpauseCalls = 0;
  archiveCalls = 0;
  createOwnerAvailabilityBlockCalls = 0;
  updateOwnerAvailabilityBlockCalls = 0;
  deleteOwnerAvailabilityBlockCalls = 0;
  ownerOverlap = false;
  bookingConflict = false;
  rentingConflict = false;
  posting = buildPostingRecord(createValidInput());
  ownerBlocks: PostingAvailabilityBlockRecord[] = [
    buildAvailabilityBlockRecord("block-1", {
      startAt: "2026-05-01T00:00:00.000Z",
      endAt: "2026-05-03T00:00:00.000Z",
    }),
  ];
  blockLookup: PostingAvailabilityBlockRecord | null = this.ownerBlocks[0]!;
  deleteResult = true;

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
      ...this.posting,
      id,
    };
  }

  async publish(id: string): Promise<PostingRecord> {
    this.publishCalls += 1;
    this.posting = {
      ...this.posting,
      id,
      status: "published",
      publishedAt: this.posting.publishedAt ?? "2026-04-21T00:00:00.000Z",
      pausedAt: undefined,
      archivedAt: undefined,
    };
    return this.posting;
  }

  async pause(id: string): Promise<PostingRecord> {
    this.pauseCalls += 1;
    this.posting = {
      ...this.posting,
      id,
      status: "paused",
      publishedAt: this.posting.publishedAt ?? "2026-04-21T00:00:00.000Z",
      pausedAt: "2026-04-23T00:00:00.000Z",
      archivedAt: undefined,
    };
    return this.posting;
  }

  async unpause(id: string): Promise<PostingRecord> {
    this.unpauseCalls += 1;
    this.posting = {
      ...this.posting,
      id,
      status: "published",
      pausedAt: undefined,
      archivedAt: undefined,
    };
    return this.posting;
  }

  async archive(id: string): Promise<PostingRecord> {
    this.archiveCalls += 1;
    this.posting = {
      ...this.posting,
      id,
      status: "archived",
      pausedAt: undefined,
      archivedAt: "2026-04-23T00:00:00.000Z",
    };
    return this.posting;
  }

  async listOwnerAvailabilityBlocks(): Promise<PostingAvailabilityBlockRecord[]> {
    return this.ownerBlocks;
  }

  async findOwnerAvailabilityBlock(): Promise<PostingAvailabilityBlockRecord | null> {
    return this.blockLookup;
  }

  async createOwnerAvailabilityBlock(
    _postingId: string,
    input: PostingAvailabilityBlockInput,
  ): Promise<PostingAvailabilityBlockRecord> {
    this.createOwnerAvailabilityBlockCalls += 1;
    return buildAvailabilityBlockRecord("created-block", input);
  }

  async updateOwnerAvailabilityBlock(
    _postingId: string,
    blockId: string,
    input: PostingAvailabilityBlockInput,
  ): Promise<PostingAvailabilityBlockRecord> {
    this.updateOwnerAvailabilityBlockCalls += 1;
    return buildAvailabilityBlockRecord(blockId, input);
  }

  async deleteOwnerAvailabilityBlock(): Promise<boolean> {
    this.deleteOwnerAvailabilityBlockCalls += 1;
    return this.deleteResult;
  }

  async hasOwnerAvailabilityBlockOverlap(input: { excludeBlockId?: string }): Promise<boolean> {
    if (input.excludeBlockId === "block-1") {
      return false;
    }

    return this.ownerOverlap;
  }

  async hasActiveBookingAvailabilityConflict(): Promise<boolean> {
    return this.bookingConflict;
  }

  async hasRentingAvailabilityConflict(): Promise<boolean> {
    return this.rentingConflict;
  }
}

function createService(repository: FakePostingsRepository): PostingsService {
  const searchService = {} as PostingsSearchService;
  const blobService = {
    isConfigured: () => true,
    isManagedBlobUrl: () => true,
  } as unknown as BlobService;
  const cacheService = {
    acquireLock: jest.fn(async (key: string) => ({
      key,
      token: `${key}-token`,
      release: jest.fn(async () => true),
      extend: jest.fn(async () => true),
    })),
  } as unknown as CacheService;

  return new PostingsService(
    repository as unknown as PostingsRepository,
    searchService,
    blobService,
    new ContentSanitizationService(),
    cacheService,
  );
}

function createValidInput(): UpsertPostingInput {
  return {
    ownerId: "owner-1",
    variant: {
      family: "place",
      subtype: "entire_place",
    },
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
    variant: input.variant,
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
    publishedAt: undefined,
    pausedAt: undefined,
    archivedAt: undefined,
    createdAt: "2026-04-18T00:00:00.000Z",
    updatedAt: "2026-04-18T00:00:00.000Z",
  };
}

function buildAvailabilityBlockRecord(
  id: string,
  input: PostingAvailabilityBlockInput,
): PostingAvailabilityBlockRecord {
  return {
    id,
    startAt: input.startAt,
    endAt: input.endAt,
    note: input.note ?? undefined,
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

  it("pauses a published posting while preserving its published timestamp", async () => {
    const repository = new FakePostingsRepository();
    repository.posting = {
      ...repository.posting,
      id: "posting-1",
      status: "published",
      publishedAt: "2026-04-21T00:00:00.000Z",
    };
    const service = createService(repository);

    const paused = await service.pause("posting-1", "owner-1");

    expect(paused.status).toBe("paused");
    expect(paused.publishedAt).toBe("2026-04-21T00:00:00.000Z");
    expect(paused.pausedAt).toBeDefined();
    expect(repository.pauseCalls).toBe(1);
  });

  it("unpauses a paused posting without changing its original published timestamp", async () => {
    const repository = new FakePostingsRepository();
    repository.posting = {
      ...repository.posting,
      id: "posting-1",
      status: "paused",
      publishedAt: "2026-04-21T00:00:00.000Z",
      pausedAt: "2026-04-23T00:00:00.000Z",
    };
    const service = createService(repository);

    const unpaused = await service.unpause("posting-1", "owner-1");

    expect(unpaused.status).toBe("published");
    expect(unpaused.publishedAt).toBe("2026-04-21T00:00:00.000Z");
    expect(unpaused.pausedAt).toBeUndefined();
    expect(repository.unpauseCalls).toBe(1);
  });

  it("rejects invalid posting lifecycle transitions", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);

    repository.posting = {
      ...repository.posting,
      status: "paused",
    };
    await expect(service.publish("posting-1", "owner-1")).rejects.toBeInstanceOf(BadRequestError);

    repository.posting = {
      ...repository.posting,
      status: "draft",
    };
    await expect(service.pause("posting-1", "owner-1")).rejects.toBeInstanceOf(BadRequestError);

    repository.posting = {
      ...repository.posting,
      status: "published",
    };
    await expect(service.unpause("posting-1", "owner-1")).rejects.toBeInstanceOf(BadRequestError);
  });

  it("hides paused postings from public getById while still allowing owners to view them", async () => {
    const repository = new FakePostingsRepository();
    repository.posting = {
      ...repository.posting,
      id: "posting-1",
      status: "paused",
      ownerId: "owner-1",
      publishedAt: "2026-04-21T00:00:00.000Z",
      pausedAt: "2026-04-23T00:00:00.000Z",
    };
    const service = createService(repository);

    await expect(service.getById("posting-1", "renter-1")).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );

    const ownerView = await service.getById("posting-1", "owner-1");
    expect(ownerView.status).toBe("paused");
  });

  it("rejects subtypes that do not belong to the selected family", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);
    const input = createValidInput();
    input.variant = {
      family: "place",
      subtype: "car",
    };

    const error = await service.createDraft(input).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BadRequestError);
    const details = getValidationDetails(error);
    expect(details[0]?.path).toBe("variant.subtype");
    expect(repository.createCalls).toBe(0);
  });

  it("rejects invalid searchable attribute types for the selected variant", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);
    const input = createValidInput();
    input.attributes.guest_capacity = "four";

    const error = await service.createDraft(input).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BadRequestError);
    const details = getValidationDetails(error);
    expect(details[0]?.path).toBe("attributes.guest_capacity");
    expect(repository.createCalls).toBe(0);
  });

  it("keeps unknown attributes while normalizing searchable variant attributes", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);
    const input = createValidInput();
    input.attributes = {
      guest_capacity: 4,
      amenities: [" WiFi ", "WiFi", " Desk "],
      ownerNote: "  Bring ID  ",
    };

    const created = await service.createDraft(input);

    expect(created.attributes).toEqual({
      guest_capacity: 4,
      amenities: ["WiFi", "Desk"],
      ownerNote: "Bring ID",
    });
  });

  it("lists owner availability blocks without a full posting payload", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);

    const result = await service.listOwnerAvailabilityBlocks("posting-1", "owner-1");

    expect(result.availabilityBlocks).toEqual(repository.ownerBlocks);
    expect(repository.findByIdCalls).toBe(1);
  });

  it("creates an owner availability block after validating conflicts", async () => {
    const repository = new FakePostingsRepository();
    const service = createService(repository);

    const created = await service.createOwnerAvailabilityBlock("posting-1", "owner-1", {
      startAt: "2026-06-01T00:00:00.000Z",
      endAt: "2026-06-03T00:00:00.000Z",
      note: "  maintenance  ",
    });

    expect(created).toMatchObject({
      id: "created-block",
      note: "maintenance",
    });
    expect(repository.createOwnerAvailabilityBlockCalls).toBe(1);
  });

  it("rejects owner availability blocks that overlap another owner block", async () => {
    const repository = new FakePostingsRepository();
    repository.ownerOverlap = true;
    const service = createService(repository);

    const error = await service
      .createOwnerAvailabilityBlock("posting-1", "owner-1", {
        startAt: "2026-05-02T00:00:00.000Z",
        endAt: "2026-05-04T00:00:00.000Z",
      })
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BadRequestError);
    expect(repository.createOwnerAvailabilityBlockCalls).toBe(0);
  });

  it("rejects owner availability blocks that conflict with active bookings", async () => {
    const repository = new FakePostingsRepository();
    repository.bookingConflict = true;
    const service = createService(repository);

    const error = await service
      .createOwnerAvailabilityBlock("posting-1", "owner-1", {
        startAt: "2026-06-01T00:00:00.000Z",
        endAt: "2026-06-03T00:00:00.000Z",
      })
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(ConflictError);
    expect(repository.createOwnerAvailabilityBlockCalls).toBe(0);
  });

  it("rejects owner availability blocks that conflict with confirmed rentings", async () => {
    const repository = new FakePostingsRepository();
    repository.rentingConflict = true;
    const service = createService(repository);

    const error = await service
      .createOwnerAvailabilityBlock("posting-1", "owner-1", {
        startAt: "2026-06-01T00:00:00.000Z",
        endAt: "2026-06-03T00:00:00.000Z",
      })
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(ConflictError);
    expect(repository.createOwnerAvailabilityBlockCalls).toBe(0);
  });

  it("updates an owner availability block while excluding itself from overlap checks", async () => {
    const repository = new FakePostingsRepository();
    repository.ownerOverlap = true;
    const service = createService(repository);

    const updated = await service.updateOwnerAvailabilityBlock("posting-1", "owner-1", "block-1", {
      startAt: "2026-05-01T00:00:00.000Z",
      endAt: "2026-05-04T00:00:00.000Z",
    });

    expect(updated.id).toBe("block-1");
    expect(repository.updateOwnerAvailabilityBlockCalls).toBe(1);
  });

  it("does not update or delete non-owner availability blocks", async () => {
    const repository = new FakePostingsRepository();
    repository.blockLookup = null;
    repository.deleteResult = false;
    const service = createService(repository);

    await expect(
      service.updateOwnerAvailabilityBlock("posting-1", "owner-1", "booking-hold-1", {
        startAt: "2026-05-01T00:00:00.000Z",
        endAt: "2026-05-04T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await expect(
      service.deleteOwnerAvailabilityBlock("posting-1", "owner-1", "booking-hold-1"),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("returns a conflict when the posting availability lock is busy", async () => {
    const repository = new FakePostingsRepository();
    const searchService = {} as PostingsSearchService;
    const blobService = {
      isConfigured: () => true,
      isManagedBlobUrl: () => true,
    } as unknown as BlobService;
    const cacheService = {
      acquireLock: jest.fn(async () => null),
    } as unknown as CacheService;
    const service = new PostingsService(
      repository as unknown as PostingsRepository,
      searchService,
      blobService,
      new ContentSanitizationService(),
      cacheService,
    );

    await expect(
      service.createOwnerAvailabilityBlock("posting-1", "owner-1", {
        startAt: "2026-06-01T00:00:00.000Z",
        endAt: "2026-06-03T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
