import { PostingsSearchService } from "@/features/postings/postings.search.service";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type { PostingSearchDocument } from "@/features/postings/postings.model";

function createDocument(
  overrides: Partial<PostingSearchDocument> = {},
): PostingSearchDocument {
  return {
    id: "posting-1",
    ownerId: "owner-1",
    status: "published",
    variant: {
      family: "place",
      subtype: "entire_place",
    },
    name: "Sunny loft",
    description: "Bright loft with workspace",
    tags: ["loft", "workspace"],
    availabilityStatus: "available",
    searchableAttributes: {
      bedrooms: 2,
      amenities: ["wifi", "desk"],
    },
    pricing: {
      currency: "CAD",
      daily: {
        amount: 150,
      },
    },
    pricingCurrency: "CAD",
    location: {
      latitude: 43.6532,
      longitude: -79.3832,
      city: "Toronto",
      region: "Ontario",
      country: "Canada",
    },
    photos: [
      {
        blobUrl: "https://example.blob.core.windows.net/postings/photo-1.jpg",
        position: 0,
      },
    ],
    blockedRanges: [],
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    publishedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("PostingsSearchService", () => {
  it("indexes family, subtype, and searchable attributes into Elasticsearch documents", async () => {
    const repository = {} as PostingsRepository;
    const requestJson = jest.fn(async () => undefined);
    const service = new PostingsSearchService(repository, {
      getPostingsIndexName: () => "postings-test",
      requestJson,
      isEnabled: () => true,
    } as never);

    await service.upsertDocument(createDocument(), "postings-test_v1");

    expect(requestJson).toHaveBeenCalledTimes(1);
    expect(requestJson.mock.calls[0]?.[0]).toBe("/postings-test_v1/_doc/posting-1");

    const body = JSON.parse(requestJson.mock.calls[0]?.[1]?.body as string) as Record<
      string,
      unknown
    >;

    expect(body).toMatchObject({
      family: "place",
      subtype: "entire_place",
      searchableAttributes: {
        bedrooms: 2,
        amenities: ["wifi", "desk"],
      },
    });
    expect(body).not.toHaveProperty("attributes");
  });

  it("adds family and subtype filters to Elasticsearch search requests", async () => {
    const batchFindPublic = jest.fn(async () => ({
      postings: [],
      missingIds: [],
    }));
    const repository = {
      batchFindPublic,
      searchPublicFallback: jest.fn(),
    } as unknown as PostingsRepository;
    const requestJson = jest.fn(async () => ({
      hits: {
        total: {
          value: 0,
        },
        hits: [],
      },
    }));
    const service = new PostingsSearchService(repository, {
      getPostingsIndexName: () => "postings-test",
      requestJson,
      isEnabled: () => true,
    } as never);

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      query: "loft",
      family: "vehicle",
      subtype: "car",
      sort: "relevance",
    });

    const body = JSON.parse(requestJson.mock.calls[0]?.[1]?.body as string) as {
      query: {
        bool: {
          filter: unknown[];
        };
      };
    };

    expect(body.query.bool.filter).toEqual(
      expect.arrayContaining([
        {
          term: {
            family: "vehicle",
          },
        },
        {
          term: {
            subtype: "car",
          },
        },
      ]),
    );
    expect(batchFindPublic).toHaveBeenCalledWith({
      ids: [],
    });
  });

  it("excludes overlapping blocked ranges when availability search is provided", async () => {
    const repository = {
      batchFindPublic: jest.fn(async () => ({
        postings: [],
        missingIds: [],
      })),
      searchPublicFallback: jest.fn(),
    } as unknown as PostingsRepository;
    const requestJson = jest.fn(async () => ({
      hits: {
        total: {
          value: 0,
        },
        hits: [],
      },
    }));
    const service = new PostingsSearchService(repository, {
      getPostingsIndexName: () => "postings-test",
      requestJson,
      isEnabled: () => true,
    } as never);

    await service.searchPublic({
      page: 1,
      pageSize: 10,
      sort: "relevance",
      availabilityWindow: {
        startAt: "2026-04-21T00:00:00.000Z",
        endAt: "2026-04-24T00:00:00.000Z",
      },
    });

    const body = JSON.parse(requestJson.mock.calls[0]?.[1]?.body as string) as {
      query: {
        bool: {
          must_not: unknown[];
        };
      };
    };

    expect(body.query.bool.must_not).toEqual(
      expect.arrayContaining([
        {
          nested: {
            path: "blockedRanges",
            query: {
              bool: {
                filter: [
                  {
                    range: {
                      "blockedRanges.startAt": {
                        lt: "2026-04-24T00:00:00.000Z",
                      },
                    },
                  },
                  {
                    range: {
                      "blockedRanges.endAt": {
                        gt: "2026-04-21T00:00:00.000Z",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ]),
    );
  });
});
