import assert from "node:assert/strict";
import type {
  PostingRecord,
  UpsertPostingInput,
} from "@/features/postings/postings.model";
import { PostingsService } from "@/features/postings/postings.service";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { PostingsSearchService } from "@/features/postings/postings.search.service";
import type { BlobService } from "@/features/blob/blob.service";
import BadRequestError from "@/errors/http/bad-request.error";
import { ContentSanitizationService } from "@/features/security/content-sanitization.service";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

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
  assert.ok(error instanceof BadRequestError);
  assert.ok(Array.isArray(error.details));
  return error.details as Array<{ path: string; message: string }>;
}

const tests: TestCase[] = [
  {
    name: "postings service rejects unsafe content before create persists",
    run: async () => {
      const repository = new FakePostingsRepository();
      const service = createService(repository);
      const input = createValidInput();
      input.description = "<script>alert('boom')</script>";

      await assert.rejects(
        service.createDraft(input),
        (error: unknown) => {
          const details = getValidationDetails(error);
          assert.equal(details[0]?.path, "description");
          return true;
        },
      );

      assert.equal(repository.createCalls, 0);
    },
  },
  {
    name: "postings service rejects unsafe attribute and block note paths on create",
    run: async () => {
      const repository = new FakePostingsRepository();
      const service = createService(repository);
      const input = createValidInput();
      input.attributes.petPolicy = "No shitty behavior";
      input.availabilityBlocks[0]!.note = "javascript:alert('x')";

      await assert.rejects(
        service.createDraft(input),
        (error: unknown) => {
          const details = getValidationDetails(error);
          assert.deepEqual(
            details.map((detail) => detail.path).sort(),
            ["attributes.petPolicy", "availabilityBlocks.0.note"],
          );
          return true;
        },
      );

      assert.equal(repository.createCalls, 0);
    },
  },
  {
    name: "postings service rejects unsafe content before update persists",
    run: async () => {
      const repository = new FakePostingsRepository();
      const service = createService(repository);
      const input = createValidInput();
      input.tags = ["safe", "' OR 1=1 --"];

      await assert.rejects(
        service.update("posting-123", input),
        (error: unknown) => {
          const details = getValidationDetails(error);
          assert.equal(details[0]?.path, "tags.1");
          return true;
        },
      );

      assert.equal(repository.findByIdCalls, 1);
      assert.equal(repository.updateCalls, 0);
    },
  },
  {
    name: "postings service accepts clean content and persists normalized data",
    run: async () => {
      const repository = new FakePostingsRepository();
      const service = createService(repository);
      const input = createValidInput();
      input.tags = ["  Loft  ", "loft", "Transit"];

      const created = await service.createDraft(input);

      assert.equal(repository.createCalls, 1);
      assert.deepEqual(created.tags, ["loft", "transit"]);
    },
  },
];

export async function runPostingsServiceTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }

  console.log(`Completed ${tests.length} postings service tests.`);
}

void runPostingsServiceTests().catch((error: unknown) => {
  console.error("Postings service tests failed.", error);
  process.exit(1);
});
