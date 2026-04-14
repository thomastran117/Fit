import {
  ElasticsearchUnavailableError,
  getElasticsearchClient,
  type ElasticsearchClient,
} from "@/configuration/resources/elasticsearch";
import type {
  SearchRentingsInput,
  SearchRentingsResult,
  RentingSearchDocument,
  RentingSearchSource,
} from "@/features/rentings/rentings.model";
import type { RentingsRepository } from "@/features/rentings/rentings.repository";

interface SearchIdsResult {
  ids: string[];
  total: number;
  source: RentingSearchSource;
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

export class RentingsSearchService {
  constructor(
    private readonly rentingsRepository: RentingsRepository,
    private readonly elasticsearch: ElasticsearchClient = getElasticsearchClient(),
  ) {}

  async searchPublic(input: SearchRentingsInput): Promise<SearchRentingsResult> {
    const searchIds = await this.searchIdsWithFallback(input);
    const batch = await this.rentingsRepository.batchFindPublic({
      ids: searchIds.ids,
    });

    return {
      rentings: batch.rentings,
      pagination: this.createPagination(input.page, input.pageSize, searchIds.total),
      source: searchIds.source,
      ...(input.query ? { query: input.query } : {}),
    };
  }

  async upsertDocument(document: RentingSearchDocument): Promise<void> {
    const indexName = this.elasticsearch.getRentingsIndexName();

    await this.elasticsearch.requestJson(
      `/${encodeURIComponent(indexName)}/_doc/${encodeURIComponent(document.id)}`,
      {
        method: "PUT",
        body: JSON.stringify(this.toElasticsearchDocument(document)),
      },
    );
  }

  async deleteDocument(id: string): Promise<void> {
    const indexName = this.elasticsearch.getRentingsIndexName();

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

  isElasticsearchEnabled(): boolean {
    return this.elasticsearch.isEnabled();
  }

  private async searchIdsWithFallback(input: SearchRentingsInput): Promise<SearchIdsResult> {
    if (this.isElasticsearchEnabled()) {
      try {
        return await this.searchIdsInElasticsearch(input);
      } catch (error) {
        console.warn("Rentings search falling back to database", error);
      }
    }

    const fallback = await this.rentingsRepository.searchPublicFallback(input);

    return {
      ...fallback,
      source: "database",
    };
  }

  private async searchIdsInElasticsearch(input: SearchRentingsInput): Promise<SearchIdsResult> {
    const indexName = this.elasticsearch.getRentingsIndexName();
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

  private buildSearchRequest(input: SearchRentingsInput, from: number): Record<string, unknown> {
    const must: Array<Record<string, unknown>> = [];
    const filter: Array<Record<string, unknown>> = [
      {
        term: {
          status: "published",
        },
      },
    ];

    if (input.query) {
      must.push({
        multi_match: {
          query: input.query,
          fields: ["name^3", "description^2", "tags^2", "location.city", "location.region", "location.country"],
          fuzziness: "AUTO",
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

    return {
      from,
      size: input.pageSize,
      query: {
        bool: {
          ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
          filter,
        },
      },
      sort: this.buildSort(input),
      track_total_hits: true,
    };
  }

  private buildSort(input: SearchRentingsInput): Array<Record<string, unknown>> {
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

  private toElasticsearchDocument(document: RentingSearchDocument): Record<string, unknown> {
    const primaryPhoto = document.photos.find((photo) => photo.position === 0) ?? document.photos[0];

    return {
      id: document.id,
      ownerId: document.ownerId,
      status: document.status,
      name: document.name,
      description: document.description,
      tags: document.tags,
      attributes: document.attributes,
      availabilityStatus: document.availabilityStatus,
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
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      publishedAt: document.publishedAt,
    };
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
