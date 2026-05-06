import { PostingThumbnailService } from "@/features/postings/postings.thumbnail.service";
import type { PostingThumbnailOutboxRecord } from "@/features/postings/postings.model";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { BlobService } from "@/features/blob/blob.service";

class FakePostingsRepository {
  primaryPhoto = {
    id: "photo-1",
    blobUrl: "https://example.blob.core.windows.net/postings/photo-1.jpg",
    blobName: "postings/photo-1.jpg",
    position: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
  updatedThumbnail:
    | {
        photoId: string;
        thumbnailBlobName: string;
        thumbnailBlobUrl: string;
      }
    | null = null;
  enqueuedSearchPostingId: string | null = null;
  processedJobId: string | null = null;
  retryState: { id: string; attempts: number; errorMessage: string } | null = null;
  deadLetterState: { id: string; errorMessage: string } | null = null;

  async findPrimaryPhotoForThumbnailing() {
    return this.primaryPhoto;
  }

  async updatePostingPhotoThumbnail(
    photoId: string,
    input: { thumbnailBlobName: string; thumbnailBlobUrl: string },
  ) {
    this.updatedThumbnail = {
      photoId,
      thumbnailBlobName: input.thumbnailBlobName,
      thumbnailBlobUrl: input.thumbnailBlobUrl,
    };
  }

  async enqueueSearchSync(postingId: string) {
    this.enqueuedSearchPostingId = postingId;
  }

  async markThumbnailOutboxProcessed(id: string) {
    this.processedJobId = id;
  }

  async markThumbnailOutboxRetry(id: string, attempts: number, errorMessage: string) {
    this.retryState = {
      id,
      attempts,
      errorMessage,
    };
  }

  async markThumbnailOutboxDeadLettered(id: string, errorMessage: string) {
    this.deadLetterState = {
      id,
      errorMessage,
    };
  }
}

function createJob(overrides: Partial<PostingThumbnailOutboxRecord> = {}): PostingThumbnailOutboxRecord {
  return {
    id: "thumb-job-1",
    postingId: "posting-1",
    dedupeKey: "posting:posting-1:primary-thumbnail",
    attempts: 0,
    availableAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=",
  "base64",
);

describe("PostingThumbnailService", () => {
  it("generates a thumbnail, persists it, and enqueues search sync", async () => {
    const repository = new FakePostingsRepository();
    const downloadBlob = jest.fn(async () => ({
      body: onePixelPng,
      contentType: "image/png",
    }));
    const uploadBuffer = jest.fn(async () => ({
      blobName: "postings/thumbnails/photo-1.webp",
      blobUrl: "https://example.blob.core.windows.net/postings/thumbnails/photo-1.webp",
    }));
    const buildPostingPhotoThumbnailBlobName = jest.fn(
      () => "postings/thumbnails/photo-1.webp",
    );
    const service = new PostingThumbnailService(
      repository as unknown as PostingsRepository,
      {
        downloadBlob,
        uploadBuffer,
        buildPostingPhotoThumbnailBlobName,
      } as unknown as BlobService,
    );

    await service.processJob(createJob(), 3);

    expect(downloadBlob).toHaveBeenCalledWith("postings/photo-1.jpg");
    expect(buildPostingPhotoThumbnailBlobName).toHaveBeenCalledWith("postings/photo-1.jpg");
    expect(uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        blobName: "postings/thumbnails/photo-1.webp",
        contentType: "image/webp",
      }),
    );
    expect(repository.updatedThumbnail).toEqual({
      photoId: "photo-1",
      thumbnailBlobName: "postings/thumbnails/photo-1.webp",
      thumbnailBlobUrl: "https://example.blob.core.windows.net/postings/thumbnails/photo-1.webp",
    });
    expect(repository.enqueuedSearchPostingId).toBe("posting-1");
    expect(repository.processedJobId).toBe("thumb-job-1");
    expect(repository.retryState).toBeNull();
    expect(repository.deadLetterState).toBeNull();
  });

  it("dead-letters a job after the final failed attempt", async () => {
    const repository = new FakePostingsRepository();
    const service = new PostingThumbnailService(
      repository as unknown as PostingsRepository,
      {
        downloadBlob: jest.fn(async () => {
          throw new Error("Blob download failed.");
        }),
      } as unknown as BlobService,
    );

    await service.processJob(createJob({ attempts: 2 }), 3);

    expect(repository.deadLetterState).toEqual({
      id: "thumb-job-1",
      errorMessage: "Blob download failed.",
    });
    expect(repository.processedJobId).toBeNull();
  });
});
