import { PostingsSearchService } from "@/features/postings/postings.search.service";
import type { PostingsPublicCacheService } from "@/features/postings/postings.public-cache.service";
import { PostingsRepository } from "@/features/postings/postings.repository";
import type { PostingSearchDocument } from "@/features/postings/postings.model";
import { ElasticsearchUnavailableError } from "@/configuration/resources/elasticsearch";
import { resetSearchTelemetry } from "@/features/search/search.telemetry";

interface CapturedSql {
  sql: string;
  values: unknown[];
}

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

function createElasticsearchSearchService() {
  const getPublicByIds = jest.fn(async () => ({
    postings: [],
    missingIds: [],
  }));
  const repository = {
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
  const postingsPublicCacheService = {
    getPublicByIds,
  } as unknown as PostingsPublicCacheService;
  const service = new PostingsSearchService(repository, postingsPublicCacheService, {
    getPostingsIndexName: () => "postings-test",
    requestJson,
    isEnabled: () => true,
  } as never);

  return {
    getPublicByIds,
    requestJson,
    service,
  };
}

function readSearchRequest(requestJson: jest.Mock): {
  query: {
    bool: {
      filter: unknown[];
      must_not?: unknown[];
    };
  };
  sort: unknown[];
} {
  return JSON.parse(requestJson.mock.calls[0]?.[1]?.body as string);
}

function createFallbackRepository() {
  const queries: CapturedSql[] = [];
  let callCount = 0;
  const $queryRaw = jest.fn(async (query: { sql: string; values: unknown[] }) => {
    queries.push({
      sql: query.sql,
      values: query.values,
    });
    callCount += 1;
    return callCount === 1 ? [{ total: 0 }] : [];
  });
  const repository = new PostingsRepository({
    $queryRaw,
  } as never);

  return {
    queries,
    repository,
  };
}

describe("PostingsSearchService", () => {
  beforeEach(() => {
    resetSearchTelemetry();
  });

  it("indexes family, subtype, and searchable attributes into Elasticsearch documents", async () => {
    const repository = {} as PostingsRepository;
    const requestJson = jest.fn(async () => undefined);
    const service = new PostingsSearchService(repository, {
      getPublicByIds: jest.fn(async () => ({
        postings: [],
        missingIds: [],
      })),
    } as unknown as PostingsPublicCacheService, {
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
    const { getPublicByIds, requestJson, service } = createElasticsearchSearchService();

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      query: "loft",
      family: "vehicle",
      subtype: "car",
      sort: "relevance",
    });

    const body = readSearchRequest(requestJson);

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
    expect(getPublicByIds).toHaveBeenCalledWith([]);
  });

  it("requires every requested tag in Elasticsearch search requests", async () => {
    const { requestJson, service } = createElasticsearchSearchService();

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      tags: ["loft", "workspace"],
      sort: "relevance",
    });

    const body = readSearchRequest(requestJson);

    expect(body.query.bool.filter).toEqual(
      expect.arrayContaining([
        {
          bool: {
            filter: [
              {
                term: {
                  tags: "loft",
                },
              },
              {
                term: {
                  tags: "workspace",
                },
              },
            ],
          },
        },
      ]),
    );
  });

  it("adds price, geo radius, and nearest sort clauses to Elasticsearch search requests", async () => {
    const { requestJson, service } = createElasticsearchSearchService();

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      minDailyPrice: 100,
      maxDailyPrice: 200,
      geo: {
        latitude: 43.6532,
        longitude: -79.3832,
        radiusKm: 12,
      },
      sort: "nearest",
    });

    const body = readSearchRequest(requestJson);

    expect(body.query.bool.filter).toEqual(
      expect.arrayContaining([
        {
          range: {
            dailyPriceAmount: {
              gte: 100,
              lte: 200,
            },
          },
        },
        {
          geo_distance: {
            distance: "12km",
            geoPoint: {
              lat: 43.6532,
              lon: -79.3832,
            },
          },
        },
      ]),
    );
    expect(body.sort).toEqual([
      {
        _geo_distance: {
          geoPoint: {
            lat: 43.6532,
            lon: -79.3832,
          },
          order: "asc",
          unit: "km",
        },
      },
      {
        publishedAt: {
          order: "desc",
        },
      },
      {
        createdAt: {
          order: "desc",
        },
      },
      {
        id: {
          order: "asc",
        },
      },
    ]);
  });

  it("adds oldest and alphabetical sort clauses to Elasticsearch search requests", async () => {
    const { requestJson, service } = createElasticsearchSearchService();

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      sort: "oldest",
    });

    let body = readSearchRequest(requestJson);

    expect(body.sort).toEqual([
      {
        publishedAt: {
          order: "asc",
        },
      },
      {
        createdAt: {
          order: "asc",
        },
      },
      {
        id: {
          order: "asc",
        },
      },
    ]);

    requestJson.mockClear();

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      sort: "nameAsc",
    });

    body = readSearchRequest(requestJson);

    expect(body.sort).toEqual([
      {
        "name.sort": {
          order: "asc",
        },
      },
      {
        publishedAt: {
          order: "desc",
        },
      },
      {
        createdAt: {
          order: "desc",
        },
      },
      {
        id: {
          order: "asc",
        },
      },
    ]);

    requestJson.mockClear();

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      sort: "nameDesc",
    });

    body = readSearchRequest(requestJson);

    expect(body.sort).toEqual([
      {
        "name.sort": {
          order: "desc",
        },
      },
      {
        publishedAt: {
          order: "desc",
        },
      },
      {
        createdAt: {
          order: "desc",
        },
      },
      {
        id: {
          order: "asc",
        },
      },
    ]);
  });

  it("excludes overlapping blocked ranges when availability search is provided", async () => {
    const { requestJson, service } = createElasticsearchSearchService();

    await service.searchPublic({
      page: 1,
      pageSize: 10,
      sort: "relevance",
      availabilityWindow: {
        startAt: "2026-04-21T00:00:00.000Z",
        endAt: "2026-04-24T00:00:00.000Z",
      },
    });

    const body = readSearchRequest(requestJson);

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

  it("adds structured attribute filters to Elasticsearch search requests", async () => {
    const { requestJson, service } = createElasticsearchSearchService();

    await service.searchPublic({
      page: 1,
      pageSize: 20,
      family: "place",
      subtype: "entire_place",
      attributeFilters: [
        {
          key: "bedrooms",
          min: 2,
          max: 4,
        },
        {
          key: "amenities",
          value: ["wifi", "desk"],
        },
      ],
      sort: "relevance",
    });

    const body = readSearchRequest(requestJson);

    expect(body.query.bool.filter).toEqual(
      expect.arrayContaining([
        {
          range: {
            "searchableAttributes.bedrooms": {
              gte: 2,
              lte: 4,
            },
          },
        },
        {
          bool: {
            filter: [
              {
                term: {
                  "searchableAttributes.amenities": "wifi",
                },
              },
              {
                term: {
                  "searchableAttributes.amenities": "desk",
                },
              },
            ],
          },
        },
      ]),
    );
  });

  it("falls back to database search when Elasticsearch is unavailable", async () => {
    const batchFindPublic = jest.fn(async () => ({
      postings: [],
      missingIds: ["posting-1"],
    }));
    const searchPublicFallback = jest.fn(async () => ({
      ids: ["posting-1"],
      total: 1,
    }));
    const repository = {
      searchPublicFallback,
    } as unknown as PostingsRepository;
    const requestJson = jest.fn(async () => {
      throw new ElasticsearchUnavailableError("Elasticsearch is unavailable.");
    });
    const service = new PostingsSearchService(repository, {
      getPublicByIds: batchFindPublic,
    } as unknown as PostingsPublicCacheService, {
      getPostingsIndexName: () => "postings-test",
      requestJson,
      isEnabled: () => true,
    } as never);

    const result = await service.searchPublic({
      page: 1,
      pageSize: 10,
      query: "loft",
      sort: "relevance",
    });

    expect(result.source).toBe("database");
    expect(searchPublicFallback).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      query: "loft",
      sort: "relevance",
    });
    expect(batchFindPublic).toHaveBeenCalledWith(["posting-1"]);
  });

  it("falls back to database search when Elasticsearch returns stale ids", async () => {
    const batchFindPublic = jest
      .fn()
      .mockResolvedValueOnce({
        postings: [],
        missingIds: ["posting-1"],
      })
      .mockResolvedValueOnce({
        postings: [],
        missingIds: [],
      });
    const searchPublicFallback = jest.fn(async () => ({
      ids: ["posting-2"],
      total: 1,
    }));
    const repository = {
      searchPublicFallback,
    } as unknown as PostingsRepository;
    const requestJson = jest.fn(async () => ({
      hits: {
        total: {
          value: 1,
        },
        hits: [
          {
            _id: "posting-1",
          },
        ],
      },
    }));
    const service = new PostingsSearchService(repository, {
      getPublicByIds: batchFindPublic,
    } as unknown as PostingsPublicCacheService, {
      getPostingsIndexName: () => "postings-test",
      requestJson,
      isEnabled: () => true,
    } as never);

    const result = await service.searchPublic({
      page: 1,
      pageSize: 10,
      query: "loft",
      sort: "relevance",
    });

    expect(result.source).toBe("database");
    expect(searchPublicFallback).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      query: "loft",
      sort: "relevance",
    });
    expect(batchFindPublic).toHaveBeenNthCalledWith(1, ["posting-1"]);
    expect(batchFindPublic).toHaveBeenNthCalledWith(2, ["posting-2"]);
  });

  it("repairs a missing read alias from the write alias target", async () => {
    const repository = {} as PostingsRepository;
    const requestJson = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        postings_test_v1: {},
      })
      .mockResolvedValueOnce({});
    const service = new PostingsSearchService(repository, {
      getPublicByIds: jest.fn(async () => ({
        postings: [],
        missingIds: [],
      })),
    } as unknown as PostingsPublicCacheService, {
      getPostingsIndexName: () => "postings-test",
      requestJson,
      isEnabled: () => true,
    } as never);

    await service.ensureLiveIndex();

    expect(requestJson).toHaveBeenNthCalledWith(
      3,
      "/_aliases",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(JSON.parse(requestJson.mock.calls[2]?.[1]?.body as string)).toEqual({
      actions: [
        {
          add: {
            index: "postings_test_v1",
            alias: "postings-test-read",
          },
        },
      ],
    });
  });

  it("fails closed when read and write aliases target different indices", async () => {
    const repository = {} as PostingsRepository;
    const requestJson = jest
      .fn()
      .mockResolvedValueOnce({
        postings_test_read: {},
      })
      .mockResolvedValueOnce({
        postings_test_write: {},
      });
    const service = new PostingsSearchService(repository, {
      getPublicByIds: jest.fn(async () => ({
        postings: [],
        missingIds: [],
      })),
    } as unknown as PostingsPublicCacheService, {
      getPostingsIndexName: () => "postings-test",
      requestJson,
      isEnabled: () => true,
    } as never);

    await expect(service.ensureLiveIndex()).rejects.toBeInstanceOf(ElasticsearchUnavailableError);
  });
});

describe("PostingsRepository.searchPublicFallback", () => {
  it("applies equivalent filters for tags, price, geo radius, availability, and nearest sorting", async () => {
    const { queries, repository } = createFallbackRepository();

    await repository.searchPublicFallback({
      page: 1,
      pageSize: 10,
      family: "place",
      subtype: "entire_place",
      tags: ["loft", "workspace"],
      availabilityStatus: "available",
      attributeFilters: [
        {
          key: "bedrooms",
          min: 2,
          max: 4,
        },
        {
          key: "amenities",
          value: ["wifi", "desk"],
        },
      ],
      minDailyPrice: 100,
      maxDailyPrice: 200,
      geo: {
        latitude: 43.6532,
        longitude: -79.3832,
        radiusKm: 12,
      },
      availabilityWindow: {
        startAt: "2026-04-21T00:00:00.000Z",
        endAt: "2026-04-24T00:00:00.000Z",
      },
      sort: "nearest",
    });

    const idQuery = queries[1]!;

    expect((idQuery.sql.match(/JSON_SEARCH\(tags, 'one', \?\) IS NOT NULL/g) ?? []).length).toBe(2);
    expect(idQuery.sql).toContain("family = ?");
    expect(idQuery.sql).toContain("subtype = ?");
    expect(idQuery.sql).toContain("availability_status = ?");
    expect(idQuery.sql).toContain("JSON_EXTRACT(attributes, ?)"); 
    expect(idQuery.sql).toContain("JSON_EXTRACT(pricing, '$.daily.amount')) AS DECIMAL(18, 2)) >= ?");
    expect(idQuery.sql).toContain("JSON_EXTRACT(pricing, '$.daily.amount')) AS DECIMAL(18, 2)) <= ?");
    expect(idQuery.sql).toContain("pab.start_at < ?");
    expect(idQuery.sql).toContain("br.start_at < ?");
    expect(idQuery.sql).toContain("r.start_at < ?");
    expect(idQuery.sql).toContain("6371 * ACOS");
    expect(idQuery.sql).toContain("<= ?");
    expect(idQuery.sql).toContain("ORDER BY (");
    expect(idQuery.sql).toContain("ASC, published_at DESC, created_at DESC, id ASC");
    expect(idQuery.values).toEqual(
      expect.arrayContaining([
        "place",
        "entire_place",
        "loft",
        "workspace",
        "available",
        "$.bedrooms",
        2,
        4,
        "$.amenities",
        "wifi",
        "desk",
        100,
        200,
        12,
      ]),
    );
  });

  it("uses field-priority relevance ordering for keyword fallback searches", async () => {
    const { queries, repository } = createFallbackRepository();

    await repository.searchPublicFallback({
      page: 1,
      pageSize: 10,
      query: "loft",
      sort: "relevance",
    });

    const idQuery = queries[1]!;

    expect(idQuery.sql).toContain("ORDER BY (");
    expect(idQuery.sql).toContain("CASE WHEN name LIKE ?");
    expect(idQuery.sql).toContain("CASE WHEN CAST(tags AS CHAR) LIKE ?");
    expect(idQuery.sql).toContain("CASE WHEN description LIKE ?");
    expect(idQuery.sql).toContain("CASE WHEN city LIKE ?");
    expect(idQuery.sql).toContain("CASE WHEN region LIKE ?");
    expect(idQuery.sql).toContain("CASE WHEN country LIKE ?");
    expect(idQuery.sql).toContain(") DESC, published_at DESC, created_at DESC, id ASC");
    expect(idQuery.values.filter((value) => value === "%loft%")).toHaveLength(12);
  });

  it("supports oldest and alphabetical fallback ordering with stable tie-breakers", async () => {
    const { queries, repository } = createFallbackRepository();

    await repository.searchPublicFallback({
      page: 1,
      pageSize: 10,
      sort: "oldest",
    });

    let idQuery = queries[1]!;
    expect(idQuery.sql).toContain("ORDER BY published_at ASC, created_at ASC, id ASC");

    queries.length = 0;

    await repository.searchPublicFallback({
      page: 1,
      pageSize: 10,
      sort: "nameAsc",
    });

    idQuery = queries[1]!;
    expect(idQuery.sql).toContain("ORDER BY LOWER(name) ASC, published_at DESC, created_at DESC, id ASC");

    queries.length = 0;

    await repository.searchPublicFallback({
      page: 1,
      pageSize: 10,
      sort: "nameDesc",
    });

    idQuery = queries[1]!;
    expect(idQuery.sql).toContain("ORDER BY LOWER(name) DESC, published_at DESC, created_at DESC, id ASC");
  });
});
