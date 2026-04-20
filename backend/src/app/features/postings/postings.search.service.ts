import {
  ElasticsearchUnavailableError,
  getElasticsearchClient,
  type ElasticsearchClient,
} from "@/configuration/resources/elasticsearch";
import type {
  PostingAttributeValue,
  PostingSearchDocument,
  PostingSearchSource,
  SearchPostingsInput,
  SearchPostingsResult,
} from "@/features/postings/postings.model";
import { postingVariantCatalog } from "@/features/postings/postings.variants";
import type { PostingsRepository } from "@/features/postings/postings.repository";

interface SearchIdsResult {
  ids: string[];
  total: number;
  source: PostingSearchSource;
}

interface ElasticsearchSearchResponse {
  hits?: {
    total?: {
      value?: number;
    };
    hits?: Array<{
      _id: string;
    }>;
  };
}

interface ElasticsearchBulkResponseItem {
  index?: {
    status: number;
    error?: {
      reason?: string;
      type?: string;
    };
  };
}

interface ElasticsearchBulkResponse {
  errors?: boolean;
  items?: ElasticsearchBulkResponseItem[];
}

type ElasticsearchAliasResponse = Record<string, unknown>;

export class PostingsSearchService {
  constructor(
    private readonly postingsRepository: PostingsRepository,
    private readonly elasticsearch: ElasticsearchClient = getElasticsearchClient(),
  ) {}

  async searchPublic(input: SearchPostingsInput): Promise<SearchPostingsResult> {
    const searchIds = await this.searchIdsWithFallback(input);
    const batch = await this.postingsRepository.batchFindPublic({
      ids: searchIds.ids,
    });

    return {
      postings: batch.postings,
      pagination: this.createPagination(input.page, input.pageSize, searchIds.total),
      source: searchIds.source,
      ...(input.query ? { query: input.query } : {}),
    };
  }

  async ensureLiveIndex(): Promise<void> {
    if (!this.isElasticsearchEnabled()) {
      return;
    }

    const [readTargets, writeTargets] = await Promise.all([
      this.getAliasTargets(this.getReadAliasName()),
      this.getAliasTargets(this.getWriteAliasName()),
    ]);

    if (readTargets.length > 0 && writeTargets.length > 0) {
      return;
    }

    const indexName = this.createVersionedIndexName();
    await this.createConcreteIndex(indexName);
    await this.setAliases(indexName, readTargets, writeTargets);
  }

  async createVersionedIndex(): Promise<string> {
    const indexName = this.createVersionedIndexName();
    await this.createConcreteIndex(indexName);
    return indexName;
  }

  async upsertDocument(document: PostingSearchDocument, targetIndexName?: string): Promise<void> {
    const indexName = await this.resolveWriteTarget(targetIndexName);

    await this.elasticsearch.requestJson(
      `/${encodeURIComponent(indexName)}/_doc/${encodeURIComponent(document.id)}`,
      {
        method: "PUT",
        body: JSON.stringify(this.toElasticsearchDocument(document)),
      },
    );
  }

  async bulkUpsertDocuments(
    documents: PostingSearchDocument[],
    targetIndexName: string,
  ): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    const payload = documents
      .flatMap((document) => [
        JSON.stringify({
          index: {
            _index: targetIndexName,
            _id: document.id,
          },
        }),
        JSON.stringify(this.toElasticsearchDocument(document)),
      ])
      .join("\n")
      .concat("\n");

    const response = await this.elasticsearch.requestJson<ElasticsearchBulkResponse>(
      "/_bulk",
      {
        method: "POST",
        body: payload,
      },
      {
        contentType: "application/x-ndjson",
      },
    );

    if (response.errors) {
      const firstError = response.items?.find((item) => item.index?.error)?.index?.error;

      throw new ElasticsearchUnavailableError(
        `Bulk indexing failed: ${firstError?.type ?? "unknown"} ${firstError?.reason ?? ""}`.trim(),
      );
    }
  }

  async deleteDocument(id: string, targetIndexName?: string): Promise<void> {
    const indexName = await this.resolveWriteTarget(targetIndexName);

    await this.elasticsearch.requestJson(
      `/${encodeURIComponent(indexName)}/_doc/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
      {
        allowNotFound: true,
      },
    );
  }

  async getAliasTargets(aliasName: string): Promise<string[]> {
    const response = await this.elasticsearch.requestJson<ElasticsearchAliasResponse>(
      `/_alias/${encodeURIComponent(aliasName)}`,
      {
        method: "GET",
      },
      {
        allowNotFound: true,
      },
    );

    return Object.keys(response);
  }

  async swapAliases(newIndexName: string): Promise<{ previousReadTargets: string[]; previousWriteTargets: string[] }> {
    const [previousReadTargets, previousWriteTargets] = await Promise.all([
      this.getAliasTargets(this.getReadAliasName()),
      this.getAliasTargets(this.getWriteAliasName()),
    ]);

    await this.setAliases(newIndexName, previousReadTargets, previousWriteTargets);

    return {
      previousReadTargets,
      previousWriteTargets,
    };
  }

  isElasticsearchEnabled(): boolean {
    return this.elasticsearch.isEnabled();
  }

  getBaseIndexName(): string {
    return this.elasticsearch.getPostingsIndexName();
  }

  getReadAliasName(): string {
    return `${this.getBaseIndexName()}-read`;
  }

  getWriteAliasName(): string {
    return `${this.getBaseIndexName()}-write`;
  }

  private async searchIdsWithFallback(input: SearchPostingsInput): Promise<SearchIdsResult> {
    if (this.isElasticsearchEnabled()) {
      try {
        return await this.searchIdsInElasticsearch(input);
      } catch (error) {
        console.warn("Postings search falling back to database", error);
      }
    }

    const fallback = await this.postingsRepository.searchPublicFallback(input);

    return {
      ...fallback,
      source: "database",
    };
  }

  private async searchIdsInElasticsearch(input: SearchPostingsInput): Promise<SearchIdsResult> {
    const indexName = this.getReadAliasName();
    const from = (input.page - 1) * input.pageSize;
    const response = await this.elasticsearch.requestJson<ElasticsearchSearchResponse>(
      `/${encodeURIComponent(indexName)}/_search`,
      {
        method: "POST",
        body: JSON.stringify(this.buildSearchRequest(input, from)),
      },
    );
    const hits = response.hits?.hits ?? [];

    return {
      ids: hits.map((hit) => hit._id),
      total: response.hits?.total?.value ?? 0,
      source: "elasticsearch",
    };
  }

  private buildSearchRequest(input: SearchPostingsInput, from: number): Record<string, unknown> {
    const must: Array<Record<string, unknown>> = [];
    const filter: Array<Record<string, unknown>> = [
      {
        term: {
          status: "published",
        },
      },
    ];
    const mustNot: Array<Record<string, unknown>> = [];

    if (input.query) {
      must.push({
        bool: {
          should: [
            {
              multi_match: {
                query: input.query,
                fields: [
                  "name^5",
                  "description^2",
                  "tags^3",
                  "location.city^2",
                  "location.region",
                  "location.country",
                ],
                fuzziness: "AUTO",
              },
            },
            {
              match_phrase: {
                name: {
                  query: input.query,
                  boost: 6,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (input.family) {
      filter.push({
        term: {
          family: input.family,
        },
      });
    }

    if (input.subtype) {
      filter.push({
        term: {
          subtype: input.subtype,
        },
      });
    }

    if (input.tags && input.tags.length > 0) {
      filter.push({
        terms: {
          tags: input.tags,
        },
      });
    }

    if (input.availabilityStatus) {
      filter.push({
        term: {
          availabilityStatus: input.availabilityStatus,
        },
      });
    }

    if (input.minDailyPrice !== undefined || input.maxDailyPrice !== undefined) {
      filter.push({
        range: {
          dailyPriceAmount: {
            ...(input.minDailyPrice !== undefined ? { gte: input.minDailyPrice } : {}),
            ...(input.maxDailyPrice !== undefined ? { lte: input.maxDailyPrice } : {}),
          },
        },
      });
    }

    if (input.geo?.radiusKm !== undefined) {
      filter.push({
        geo_distance: {
          distance: `${input.geo.radiusKm}km`,
          geoPoint: {
            lat: input.geo.latitude,
            lon: input.geo.longitude,
          },
        },
      });
    }

    if (input.availabilityWindow) {
      mustNot.push({
        nested: {
          path: "blockedRanges",
          query: {
            bool: {
              filter: [
                {
                  range: {
                    "blockedRanges.startAt": {
                      lt: input.availabilityWindow.endAt,
                    },
                  },
                },
                {
                  range: {
                    "blockedRanges.endAt": {
                      gt: input.availabilityWindow.startAt,
                    },
                  },
                },
              ],
            },
          },
        },
      });
    }

    return {
      from,
      size: input.pageSize,
      query: {
        bool: {
          ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
          filter,
          ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
        },
      },
      sort: this.buildSort(input),
      track_total_hits: true,
    };
  }

  private buildSort(input: SearchPostingsInput): Array<Record<string, unknown>> {
    switch (input.sort) {
      case "dailyPrice":
        return [
          {
            dailyPriceAmount: {
              order: "asc",
            },
          },
          {
            publishedAt: {
              order: "desc",
            },
          },
        ];
      case "nearest":
        if (input.geo) {
          return [
            {
              _geo_distance: {
                geoPoint: {
                  lat: input.geo.latitude,
                  lon: input.geo.longitude,
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
          ];
        }

        return [
          {
            publishedAt: {
              order: "desc",
            },
          },
        ];
      case "newest":
        return [
          {
            publishedAt: {
              order: "desc",
            },
          },
        ];
      case "relevance":
      default:
        return input.query
          ? [
              {
                _score: {
                  order: "desc",
                },
              },
              {
                publishedAt: {
                  order: "desc",
                },
              },
            ]
          : [
              {
                publishedAt: {
                  order: "desc",
                },
              },
            ];
    }
  }

  private toElasticsearchDocument(document: PostingSearchDocument): Record<string, unknown> {
    const primaryPhoto = document.photos.find((photo) => photo.position === 0) ?? document.photos[0];

    return {
      id: document.id,
      ownerId: document.ownerId,
      status: document.status,
      family: document.variant.family,
      subtype: document.variant.subtype,
      name: document.name,
      description: document.description,
      tags: document.tags,
      availabilityStatus: document.availabilityStatus,
      searchableAttributes: document.searchableAttributes,
      pricing: document.pricing,
      pricingCurrency: document.pricingCurrency,
      dailyPriceAmount: document.pricing.daily.amount,
      geoPoint: {
        lat: document.location.latitude,
        lon: document.location.longitude,
      },
      location: {
        city: document.location.city,
        region: document.location.region,
        country: document.location.country,
        postalCode: document.location.postalCode,
      },
      primaryPhotoUrl: primaryPhoto?.blobUrl,
      photoUrls: document.photos.map((photo) => photo.blobUrl),
      blockedRanges: document.blockedRanges,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      publishedAt: document.publishedAt,
    };
  }

  private async resolveWriteTarget(targetIndexName?: string): Promise<string> {
    if (targetIndexName) {
      return targetIndexName;
    }

    await this.ensureLiveIndex();
    return this.getWriteAliasName();
  }

  private createVersionedIndexName(): string {
    return `${this.getBaseIndexName()}_v${Date.now()}`;
  }

  private async createConcreteIndex(indexName: string): Promise<void> {
    await this.elasticsearch.requestJson(
      `/${encodeURIComponent(indexName)}`,
      {
        method: "PUT",
        body: JSON.stringify(this.buildIndexConfiguration()),
      },
    );
  }

  private async setAliases(
    newIndexName: string,
    previousReadTargets: string[],
    previousWriteTargets: string[],
  ): Promise<void> {
    const actions: Array<Record<string, unknown>> = [
      ...previousReadTargets.map((index) => ({
        remove: {
          index,
          alias: this.getReadAliasName(),
        },
      })),
      ...previousWriteTargets.map((index) => ({
        remove: {
          index,
          alias: this.getWriteAliasName(),
        },
      })),
      {
        add: {
          index: newIndexName,
          alias: this.getReadAliasName(),
        },
      },
      {
        add: {
          index: newIndexName,
          alias: this.getWriteAliasName(),
          is_write_index: true,
        },
      },
    ];

    await this.elasticsearch.requestJson("/_aliases", {
      method: "POST",
      body: JSON.stringify({
        actions,
      }),
    });
  }

  private buildIndexConfiguration(): Record<string, unknown> {
    return {
      settings: {
        analysis: {
          normalizer: {
            lowercase_normalizer: {
              type: "custom",
              filter: ["lowercase"],
            },
          },
        },
      },
      mappings: {
        dynamic: false,
        properties: {
          id: { type: "keyword" },
          ownerId: { type: "keyword" },
          status: { type: "keyword" },
          family: { type: "keyword" },
          subtype: { type: "keyword" },
          name: { type: "text" },
          description: { type: "text" },
          tags: { type: "keyword", normalizer: "lowercase_normalizer" },
          availabilityStatus: { type: "keyword" },
          pricingCurrency: { type: "keyword" },
          dailyPriceAmount: { type: "double" },
          geoPoint: { type: "geo_point" },
          primaryPhotoUrl: { type: "keyword", index: false },
          photoUrls: { type: "keyword", index: false },
          createdAt: { type: "date" },
          updatedAt: { type: "date" },
          publishedAt: { type: "date" },
          location: {
            properties: {
              city: { type: "text" },
              region: { type: "text" },
              country: { type: "text" },
              postalCode: { type: "keyword" },
            },
          },
          blockedRanges: {
            type: "nested",
            properties: {
              startAt: { type: "date" },
              endAt: { type: "date" },
              source: { type: "keyword" },
            },
          },
          searchableAttributes: {
            properties: this.buildSearchableAttributeMappings(),
          },
        },
      },
    };
  }

  private buildSearchableAttributeMappings(): Record<string, unknown> {
    const mappings: Record<string, unknown> = {};

    for (const family of Object.values(postingVariantCatalog)) {
      for (const [attributeKey, definition] of Object.entries(family.searchableAttributes)) {
        if (mappings[attributeKey]) {
          continue;
        }

        mappings[attributeKey] = this.toSearchableAttributeMapping(definition.kind);
      }
    }

    return mappings;
  }

  private toSearchableAttributeMapping(kind: "string" | "number" | "integer" | "boolean" | "stringArray") {
    switch (kind) {
      case "boolean":
        return { type: "boolean" };
      case "integer":
        return { type: "integer" };
      case "number":
        return { type: "double" };
      case "stringArray":
      case "string":
      default:
        return { type: "keyword", normalizer: "lowercase_normalizer" };
    }
  }

  private createPagination(page: number, pageSize: number, total: number) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
