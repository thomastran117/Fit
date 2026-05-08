import { SEED_POSTINGS } from "@/seeds/fixtures/postings";

describe("seeded posting photo fixtures", () => {
  it("pre-populates thumbnail metadata for every seeded posting photo", () => {
    for (const posting of SEED_POSTINGS) {
      expect(posting.photos.length).toBeGreaterThan(0);

      for (const photo of posting.photos) {
        expect(photo.thumbnailBlobName).toBeDefined();
        expect(photo.thumbnailBlobUrl).toBeDefined();
      }
    }
  });
});
