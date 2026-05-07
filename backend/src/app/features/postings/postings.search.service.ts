import {
  ElasticsearchCircuitOpenError,
  ElasticsearchUnavailableError,
  ElasticsearchRequestError,
  getElasticsearchClient,
  type ElasticsearchCircuitBreakerState,
  type ElasticsearchClient,
} from "@/configuration/resources/elasticsearch";
import type {
  SearchAttributeFilterInput,
  PostingAttributeValue,
  PostingSearchDocument,
  PostingSearchSource,
  SearchPostingsInput,
  SearchPostingsResult,
} from "@/features/postings/postings.model";
import type { PostingsPublicCacheService } from "@/features/postings/postings.public-cache.service";
import { postingVariantCatalog } from "@/features/postings/postings.variants";
import type { PostingsRepository } from "@/features/postings/postings.repository";
import type {
  SearchAliasStatus,
  SearchFallbackReason,
} from "@/features/search/search.model";
import {
  recordAliasAction,
  recordSearchFallback,
} from "@/features/search/search.telemetry";
import { loggerFactory, type Logger } from "@/configuration/logging";

interface SearchIdsResult {
  ids: string[];
  total: number;
  source: PostingSearchSource;
  fallbackReason?: SearchFallbackReason;
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
  delete?: {
    status: number;
    result?: string;
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

class ElasticsearchAliasStateError extends ElasticsearchUnavailableError {
  constructor(message: string) {
    super(message);
    this.name = "ElasticsearchAliasStateError";
  }
}

export class PostingsSearchService {
  private readonly logger: Logger;

  constructor(
    private readonly postingsRepository: PostingsRepository,
    private readonly postingsPublicCacheService: PostingsPublicCacheService,
    private readonly elasticsearch: ElasticsearchClient = getElasticsearchClient(),
  ) {
    this.logger = loggerFactory.forClass(PostingsSearchService, "service");
  }

  async searchPublic(input: SearchPostingsInput): Promise<SearchPostingsResult> {
    let searchIds = await this.searchIdsWithFallback(input);
    let batch = await this.postingsPublicCacheService.getPublicByIds(searchIds.ids);

    if (searchIds.source === "elasticsearch" && batch.missingIds.length > 0) {
      this.logger.warn("Postings search falling back to database because Elasticsearch returned stale ids.", {
        missingIds: batch.missingIds,
      });
      searchIds = await this.searchIdsFromDatabase(input, "index-drift");
      batch = await this.postingsPublicCacheService.getPublicByIds(searchIds.ids);
    }

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

    const aliasStatus = await this.getAliasStatus();

    switch (aliasStatus.state) {
      case "disabled":
      case "ready":
        return;
      case "missing": {
        const indexName = this.createVersionedIndexName();
        await this.createConcreteIndex(indexName);
        await this.setAliases(indexName, [], []);
        recordAliasAction("created_index");
        return;
      }
      case "missing_read_alias":
        await this.addAlias(aliasStatus.writeTargets[0]!, this.getReadAliasName());
        recordAliasAction("repaired_read_alias");
        return;
      case "missing_write_alias":
        await this.addAlias(aliasStatus.readTargets[0]!, this.getWriteAliasName(), true);
        recordAliasAction("repaired_write_alias");
        return;
      case "inconsistent":
      default:
        throw new ElasticsearchAliasStateError(
          aliasStatus.message ??
            "Elasticsearch aliases are inconsistent and cannot be repaired automatically.",
        );
    }
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

    this.throwOnBulkErrors(response, "index");
  }

  async bulkDeleteDocuments(ids: string[], targetIndexName: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const payload = ids
      .map((id) =>
        JSON.stringify({
          delete: {
            _index: targetIndexName,
            _id: id,
          },
        }),
      )
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

    this.throwOnBulkErrors(response, "delete");
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

  async getAliasStatus(): Promise<SearchAliasStatus> {
    const readAlias = this.getReadAliasName();
    const writeAlias = this.getWriteAliasName();

    if (!this.isElasticsearchEnabled()) {
      return {
        state: "disabled",
        readAlias,
        writeAlias,
        readTargets: [],
        writeTargets: [],
      };
    }

    const [readTargets, writeTargets] = await Promise.all([
      this.getAliasTargets(readAlias),
      this.getAliasTargets(writeAlias),
    ]);

    if (readTargets.length === 0 && writeTargets.length === 0) {
      return {
        state: "missing",
        readAlias,
        writeAlias,
        readTargets,
        writeTargets,
      };
    }

    if (
      readTargets.length === 1 &&
      writeTargets.length === 1 &&
      readTargets[0] === writeTargets[0]
    ) {
      return {
        state: "ready",
        readAlias,
        writeAlias,
        readTargets,
        writeTargets,
      };
    }

    if (readTargets.length === 0 && writeTargets.length === 1) {
      return {
        state: "missing_read_alias",
        readAlias,
        writeAlias,
        readTargets,
        writeTargets,
      };
    }

    if (readTargets.length === 1 && writeTargets.length === 0) {
      return {
        state: "missing_write_alias",
        readAlias,
        writeAlias,
        readTargets,
        writeTargets,
      };
    }

    return {
      state: "inconsistent",
      readAlias,
      writeAlias,
      readTargets,
      writeTargets,
      message:
        "Read and write aliases do not resolve to a single shared concrete index and require manual repair.",
    };
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

  getCircuitBreakerState(): ElasticsearchCircuitBreakerState {
    return this.elasticsearch.getCircuitBreakerState();
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
        if (error instanceof ElasticsearchCircuitOpenError) {
          this.logger.info("Postings search using database fallback because Elasticsearch circuit is open.");
          return this.searchIdsFromDatabase(input, "circuit-open");
        }

        this.logger.warn("Postings search falling back to database.", undefined, error);
        return this.searchIdsFromDatabase(input, "es-unavailable");
      }
    }

    return this.searchIdsFromDatabase(input, "es-unavailable");
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
              match_phrase: {
                name: {
                  query: input.query,
                  boost: 10,
                },
              },
            },
            {
              multi_match: {
                query: input.query,
                type: "best_fields",
                operator: "and",
                fields: [
                  "name^7",
                  "tags.text^5",
                  "location.city^4",
                  "location.region^3",
                  "location.country^2",
                  "description^2",
                ],
              },
            },
            {
              multi_match: {
                query: input.query,
                fields: [
                  "name^5",
                  "tags.text^3",
                  "location.city^3",
                  "location.region^2",
                  "location.country^2",
                  "description",
                ],
                fuzziness: "AUTO",
                prefix_length: 1,
                boost: 0.7,
              },
            },
            {
              multi_match: {
                query: input.query,
                type: "bool_prefix",
                fields: [
                  "name.prefix^4",
                  "location.city.prefix^3",
                  "location.region.prefix^2",
                  "location.country.prefix^2",
                ],
                boost: 0.8,
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
        bool: {
          filter: input.tags.map((tag) => ({
            term: {
              tags: tag,
            },
          })),
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

    for (const attributeFilter of input.attributeFilters ?? []) {
      filter.push(...this.buildAttributeFilters(attributeFilter));
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
          ...this.buildStableRecencySort("desc"),
        ];
      case "oldest":
        return this.buildStableRecencySort("asc");
      case "nameAsc":
        return [
          {
            "name.sort": {
              order: "asc",
            },
          },
          ...this.buildStableRecencySort("desc"),
        ];
      case "nameDesc":
        return [
          {
            "name.sort": {
              order: "desc",
            },
          },
          ...this.buildStableRecencySort("desc"),
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
            ...this.buildStableRecencySort("desc"),
          ];
        }

        return this.buildStableRecencySort("desc");
      case "newest":
        return this.buildStableRecencySort("desc");
      case "relevance":
      default:
        return input.query
          ? [
              {
                _score: {
                  order: "desc",
                },
              },
              ...this.buildStableRecencySort("desc"),
            ]
          : this.buildStableRecencySort("desc");
    }
  }

  private buildStableRecencySort(direction: "asc" | "desc"): Array<Record<string, unknown>> {
    return [
      {
        publishedAt: {
          order: direction,
        },
      },
      {
        createdAt: {
          order: direction,
        },
      },
      {
        id: {
          order: "asc",
        },
      },
    ];
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

  private async addAlias(indexName: string, aliasName: string, isWriteIndex = false): Promise<void> {
    await this.elasticsearch.requestJson("/_aliases", {
      method: "POST",
      body: JSON.stringify({
        actions: [
          {
            add: {
              index: indexName,
              alias: aliasName,
              ...(isWriteIndex ? { is_write_index: true } : {}),
            },
          },
        ],
      }),
    });
  }

  private buildIndexConfiguration(): Record<string, unknown> {
    return {
      settings: {
        analysis: {
          filter: {
            autocomplete_filter: {
              type: "edge_ngram",
              min_gram: 2,
              max_gram: 20,
            },
          },
          analyzer: {
            search_text: {
              tokenizer: "standard",
              filter: ["lowercase", "asciifolding"],
            },
            autocomplete_index: {
              tokenizer: "standard",
              filter: ["lowercase", "asciifolding", "autocomplete_filter"],
            },
            autocomplete_search: {
              tokenizer: "standard",
              filter: ["lowercase", "asciifolding"],
            },
          },
          normalizer: {
            lowercase_normalizer: {
              type: "custom",
              filter: ["lowercase", "asciifolding"],
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
          name: {
            type: "text",
            analyzer: "search_text",
            fields: {
              sort: {
                type: "keyword",
                normalizer: "lowercase_normalizer",
              },
              prefix: {
                type: "text",
                analyzer: "autocomplete_index",
                search_analyzer: "autocomplete_search",
              },
            },
          },
          description: {
            type: "text",
            analyzer: "search_text",
          },
          tags: {
            type: "keyword",
            normalizer: "lowercase_normalizer",
            fields: {
              text: {
                type: "text",
                analyzer: "search_text",
              },
            },
          },
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
              city: {
                type: "text",
                analyzer: "search_text",
                fields: {
                  prefix: {
                    type: "text",
                    analyzer: "autocomplete_index",
                    search_analyzer: "autocomplete_search",
                  },
                },
              },
              region: {
                type: "text",
                analyzer: "search_text",
                fields: {
                  prefix: {
                    type: "text",
                    analyzer: "autocomplete_index",
                    search_analyzer: "autocomplete_search",
                  },
                },
              },
              country: {
                type: "text",
                analyzer: "search_text",
                fields: {
                  prefix: {
                    type: "text",
                    analyzer: "autocomplete_index",
                    search_analyzer: "autocomplete_search",
                  },
                },
              },
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

  private async searchIdsFromDatabase(
    input: SearchPostingsInput,
    reason: SearchFallbackReason,
  ): Promise<SearchIdsResult> {
    recordSearchFallback(reason);
    const fallback = await this.postingsRepository.searchPublicFallback(input);

    return {
      ...fallback,
      source: "database",
      fallbackReason: reason,
    };
  }

  private buildAttributeFilters(filter: SearchAttributeFilterInput): Array<Record<string, unknown>> {
    const field = `searchableAttributes.${filter.key}`;
    const clauses: Array<Record<string, unknown>> = [];

    if (typeof filter.value === "string" || typeof filter.value === "number" || typeof filter.value === "boolean") {
      clauses.push({
        term: {
          [field]: filter.value,
        },
      });
    } else if (Array.isArray(filter.value)) {
      clauses.push({
        bool: {
          filter: filter.value.map((value) => ({
            term: {
              [field]: value,
            },
          })),
        },
      });
    }

    if (filter.min !== undefined || filter.max !== undefined) {
      clauses.push({
        range: {
          [field]: {
            ...(filter.min !== undefined ? { gte: filter.min } : {}),
            ...(filter.max !== undefined ? { lte: filter.max } : {}),
          },
        },
      });
    }

    return clauses;
  }

  private throwOnBulkErrors(
    response: ElasticsearchBulkResponse,
    operation: "index" | "delete",
  ): void {
    if (!response.errors) {
      return;
    }

    const firstFailure = response.items?.find((item) => {
      const result = operation === "index" ? item.index : item.delete;

      if (!result?.error) {
        return false;
      }

      return !(operation === "delete" && result.status === 404);
    });
    const firstError = operation === "index" ? firstFailure?.index : firstFailure?.delete;

    if (!firstError?.error) {
      return;
    }

    const message =
      `Bulk ${operation} failed with status ${firstError.status}: ${firstError.error.type ?? "unknown"} ${firstError.error.reason ?? ""}`.trim();

    if (firstError.status >= 500) {
      throw new ElasticsearchUnavailableError(message);
    }

    throw new ElasticsearchRequestError(firstError.status, message);
  }
}
