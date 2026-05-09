import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { requireMinimumRole } from "@/features/auth/authorization";
import {
  getOptionalJwtAuth,
  requireJwtAuth,
} from "@/configuration/middlewares/jwt-middleware";
import {
  RequestValidationError,
  parseRequestBody,
} from "@/configuration/validation/request";
import { requireSafeRouteParam } from "@/configuration/validation/input-sanitization";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import {
  listPostingAnalyticsQuerySchema,
  postingAnalyticsDetailQuerySchema,
  postingAnalyticsSummaryQuerySchema,
  type ListPostingAnalyticsInput,
  type ListPostingAnalyticsQuery,
  type PostingAnalyticsDetailInput,
  type PostingAnalyticsDetailQuery,
  type PostingAnalyticsSummaryQuery,
} from "@/features/postings/analytics/analytics.model";
import { PostingsAnalyticsService } from "@/features/postings/analytics/analytics.service";
import {
  createPostingReviewRequestSchema,
  listPostingReviewsQuerySchema,
  type CreatePostingReviewRequestBody,
  type ListPostingReviewsQuery,
} from "@/features/postings/reviews/reviews.model";
import { PostingsReviewsService } from "@/features/postings/reviews/reviews.service";
import {
  listOwnerPostingsQuerySchema,
  ownerAvailabilityBlockRequestSchema,
  publicSearchPostingsQuerySchema,
  type ListOwnerPostingsInput,
  type ListOwnerPostingsQuery,
  type OwnerAvailabilityBlockRequestBody,
  type PublicSearchPostingsQuery,
  type SearchAttributeFilterInput,
  type SearchPostingsInput,
  type UpdatePostingRequestBody,
  type UpsertPostingInput,
  type UpsertPostingRequestBody,
  updatePostingRequestSchema,
  upsertPostingRequestSchema,
} from "@/features/postings/postings.model";
import { PostingsService } from "@/features/postings/postings.service";
import {
  searchClickActivityRequestSchema,
  type SearchClickActivityRequestBody,
} from "@/features/recommendations/recommendation-activity.model";
import type { RecommendationActivityPublisher } from "@/features/recommendations/recommendation-activity.publisher";
import type { AuthPrincipal } from "@/features/auth/auth.principal";

export class PostingsController {
  constructor(
    private readonly postingsService: PostingsService,
    private readonly postingsAnalyticsService: PostingsAnalyticsService,
    private readonly postingsReviewsService: PostingsReviewsService,
    private readonly recommendationActivityPublisher: RecommendationActivityPublisher,
  ) {}

  create = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const body = await parseRequestBody(context, upsertPostingRequestSchema);
    const result = await this.postingsService.createDraft(this.toUpsertInput(auth.sub, body));
    return context.json(result, 201);
  };

  update = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const body = await parseRequestBody(context, updatePostingRequestSchema);
    const result = await this.postingsService.update(
      this.requireRouteId(context),
      this.toUpsertInput(auth.sub, body),
    );
    return context.json(result);
  };

  duplicate = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.duplicate(this.requireRouteId(context), auth.sub);
    return context.json(result, 201);
  };

  listAvailabilityBlocks = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.listOwnerAvailabilityBlocks(
      this.requireRouteId(context),
      auth.sub,
    );
    return context.json(result);
  };

  createAvailabilityBlock = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const body = await parseRequestBody(context, ownerAvailabilityBlockRequestSchema);
    const result = await this.postingsService.createOwnerAvailabilityBlock(
      this.requireRouteId(context),
      auth.sub,
      this.toAvailabilityBlockInput(body),
    );
    return context.json(result, 201);
  };

  updateAvailabilityBlock = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const body = await parseRequestBody(context, ownerAvailabilityBlockRequestSchema);
    const result = await this.postingsService.updateOwnerAvailabilityBlock(
      this.requireRouteId(context),
      auth.sub,
      this.requireRouteParam(context, "blockId"),
      this.toAvailabilityBlockInput(body),
    );
    return context.json(result);
  };

  deleteAvailabilityBlock = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    await this.postingsService.deleteOwnerAvailabilityBlock(
      this.requireRouteId(context),
      auth.sub,
      this.requireRouteParam(context, "blockId"),
    );
    return new Response(null, { status: 204 });
  };

  publish = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.publish(this.requireRouteId(context), auth.sub);
    await this.recommendationActivityPublisher.publishPostingLifecycle({
      posting: result,
      eventType: "posting_published",
      client: context.get("client"),
      requestId: this.readRequestId(context),
      actorUserId: auth.sub,
    });
    return context.json(result);
  };

  archive = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.archive(this.requireRouteId(context), auth.sub);
    await this.recommendationActivityPublisher.publishPostingLifecycle({
      posting: result,
      eventType: "posting_archived",
      client: context.get("client"),
      requestId: this.readRequestId(context),
      actorUserId: auth.sub,
    });
    return context.json(result);
  };

  pause = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.pause(this.requireRouteId(context), auth.sub);
    await this.recommendationActivityPublisher.publishPostingLifecycle({
      posting: result,
      eventType: "posting_paused",
      client: context.get("client"),
      requestId: this.readRequestId(context),
      actorUserId: auth.sub,
    });
    return context.json(result);
  };

  unpause = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.unpause(this.requireRouteId(context), auth.sub);
    await this.recommendationActivityPublisher.publishPostingLifecycle({
      posting: result,
      eventType: "posting_unpaused",
      client: context.get("client"),
      requestId: this.readRequestId(context),
      actorUserId: auth.sub,
    });
    return context.json(result);
  };

  getById = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.getOptionalAuth(context);
    const result = await this.postingsService.getById(this.requireRouteId(context), auth?.sub);

    if (!auth || auth.sub !== result.ownerId) {
      await this.postingsAnalyticsService.trackPublicView(
        result,
        context.get("client"),
        auth?.sub,
      );
      await this.recommendationActivityPublisher.publishPostingView({
        posting: result,
        client: context.get("client"),
        requestId: this.readRequestId(context),
        actorUserId: auth?.sub,
      });
    }

    return context.json(result);
  };

  trackSearchClick = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.getOptionalAuth(context);
    const body = await parseRequestBody(context, searchClickActivityRequestSchema);

    await this.postingsAnalyticsService.trackSearchClick(this.requireRouteId(context));
    await this.recommendationActivityPublisher.publishSearchClick({
      postingId: this.requireRouteId(context),
      client: context.get("client"),
      body: this.toSearchClickActivityRequest(body),
      requestId: this.readRequestId(context),
      actorUserId: auth?.sub,
    });

    return new Response(null, { status: 202 });
  };

  listMine = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.listByOwner(
      this.parseListOwnerPostingsInput(context, auth.sub),
    );
    return context.json(result);
  };

  batchMine = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.batchByOwner(
      auth.sub,
      this.parseBatchIds(context),
    );
    return context.json(result);
  };

  batchPublic = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.postingsService.batchPublic(this.parseBatchIds(context));
    return context.json(result);
  };

  search = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.postingsService.searchPublic(
      this.parseSearchPostingsInput(context),
    );
    await this.postingsAnalyticsService.trackSearchImpressions(result.postings);
    return context.json(result);
  };

  analyticsSummary = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const query = this.parseAnalyticsSummaryQuery(context);
    const result = await this.postingsAnalyticsService.getOwnerSummary(auth.sub, query.window);
    return context.json(result);
  };

  analyticsPostings = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const input = this.parseListPostingAnalyticsInput(context, auth.sub);
    const result = await this.postingsAnalyticsService.listOwnerPostingsAnalytics(input);
    return context.json(result);
  };

  analyticsById = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const input = this.parsePostingAnalyticsDetailInput(
      context,
      auth.sub,
      this.requireRouteId(context),
    );
    const result = await this.postingsAnalyticsService.getPostingAnalyticsDetail(input);
    return context.json(result);
  };

  listReviews = async (context: Context<AppBindings>): Promise<Response> => {
    const { page, pageSize } = this.parseListPostingReviewsQuery(context);
    const result = await this.postingsReviewsService.list(
      this.requireRouteId(context),
      page,
      pageSize,
    );
    return context.json(result);
  };

  createReview = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const body = await parseRequestBody(context, createPostingReviewRequestSchema);
    const result = await this.postingsReviewsService.create(
      this.requireRouteId(context),
      auth.sub,
      body,
    );
    return context.json(result, 201);
  };

  updateOwnReview = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const body = await parseRequestBody(context, createPostingReviewRequestSchema);
    const result = await this.postingsReviewsService.updateOwn(
      this.requireRouteId(context),
      auth.sub,
      body,
    );
    return context.json(result);
  };

  private toUpsertInput(
    userId: string,
    body: UpsertPostingRequestBody | UpdatePostingRequestBody,
  ): UpsertPostingInput {
    const availabilityBlocks =
      "availabilityBlocks" in body ? body.availabilityBlocks : [];

    return {
      ownerId: userId,
      variant: body.variant,
      name: body.name,
      description: body.description,
      pricing: body.pricing,
      photos: body.photos,
      tags: body.tags,
      attributes: body.attributes,
      availabilityStatus: body.availabilityStatus,
      availabilityNotes: body.availabilityNotes ?? null,
      maxBookingDurationDays: body.maxBookingDurationDays ?? null,
      availabilityBlocks,
      location: {
        latitude: body.location.latitude,
        longitude: body.location.longitude,
        city: body.location.city,
        region: body.location.region,
        country: body.location.country,
        postalCode: body.location.postalCode ?? undefined,
      },
    };
  }

  private toAvailabilityBlockInput(body: OwnerAvailabilityBlockRequestBody) {
    return {
      startAt: body.startAt,
      endAt: body.endAt,
      note: body.note ?? undefined,
    };
  }

  private toSearchClickActivityRequest(
    body: SearchClickActivityRequestBody,
  ): SearchClickActivityRequestBody {
    return body;
  }

  private parseListOwnerPostingsInput(
    context: Context<AppBindings>,
    ownerId: string,
  ): ListOwnerPostingsInput {
    const url = new URL(context.req.url);

    try {
      const query = listOwnerPostingsQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      });

      return this.toListOwnerPostingsInput(ownerId, query);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseSearchPostingsInput(context: Context<AppBindings>): SearchPostingsInput {
    const url = new URL(context.req.url);

    try {
      const query = publicSearchPostingsQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        family: url.searchParams.get("family") ?? undefined,
        subtype: url.searchParams.get("subtype") ?? undefined,
        tags: this.readArrayQuery(url.searchParams, "tags"),
        availabilityStatus: url.searchParams.get("availabilityStatus") ?? undefined,
        minDailyPrice: url.searchParams.get("minDailyPrice") ?? undefined,
        maxDailyPrice: url.searchParams.get("maxDailyPrice") ?? undefined,
        latitude: url.searchParams.get("latitude") ?? undefined,
        longitude: url.searchParams.get("longitude") ?? undefined,
        radiusKm: url.searchParams.get("radiusKm") ?? undefined,
        startAt: url.searchParams.get("startAt") ?? undefined,
        endAt: url.searchParams.get("endAt") ?? undefined,
        sort: url.searchParams.get("sort") ?? undefined,
      });
      const attributeFilters = this.readAttributeFilters(url.searchParams);

      return this.toSearchPostingsInput(query, attributeFilters);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseListPostingReviewsQuery(
    context: Context<AppBindings>,
  ): ListPostingReviewsQuery {
    const url = new URL(context.req.url);

    try {
      return listPostingReviewsQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      });
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseAnalyticsSummaryQuery(context: Context<AppBindings>): PostingAnalyticsSummaryQuery {
    const url = new URL(context.req.url);

    try {
      return postingAnalyticsSummaryQuerySchema.parse({
        window: url.searchParams.get("window") ?? undefined,
      });
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseListPostingAnalyticsInput(
    context: Context<AppBindings>,
    ownerId: string,
  ): ListPostingAnalyticsInput {
    const url = new URL(context.req.url);

    try {
      const query = listPostingAnalyticsQuerySchema.parse({
        window: url.searchParams.get("window") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      });

      return this.toListPostingAnalyticsInput(ownerId, query);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parsePostingAnalyticsDetailInput(
    context: Context<AppBindings>,
    ownerId: string,
    postingId: string,
  ): PostingAnalyticsDetailInput {
    const url = new URL(context.req.url);

    try {
      const query = postingAnalyticsDetailQuerySchema.parse({
        window: url.searchParams.get("window") ?? undefined,
        granularity: url.searchParams.get("granularity") ?? undefined,
      });

      return this.toPostingAnalyticsDetailInput(ownerId, postingId, query);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private toListOwnerPostingsInput(
    ownerId: string,
    query: ListOwnerPostingsQuery,
  ): ListOwnerPostingsInput {
    return {
      ownerId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    };
  }

  private toSearchPostingsInput(
    query: PublicSearchPostingsQuery,
    attributeFilters?: SearchAttributeFilterInput[],
  ): SearchPostingsInput {
    if ((query.startAt === undefined) !== (query.endAt === undefined)) {
      throw new RequestValidationError("Request query validation failed.", [
        {
          path: "startAt",
          message: "startAt and endAt must be provided together.",
        },
      ]);
    }

    const geoValidationIssues: Array<{ path: string; message: string }> = [];
    const hasLatitude = query.latitude !== undefined;
    const hasLongitude = query.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      geoValidationIssues.push(
        {
          path: "latitude",
          message: "latitude and longitude must be provided together.",
        },
        {
          path: "longitude",
          message: "latitude and longitude must be provided together.",
        },
      );
    }

    if (query.radiusKm !== undefined && (!hasLatitude || !hasLongitude)) {
      geoValidationIssues.push({
        path: "radiusKm",
        message: "radiusKm requires both latitude and longitude.",
      });
    }

    if (geoValidationIssues.length > 0) {
      throw new RequestValidationError("Request query validation failed.", geoValidationIssues);
    }

    return {
      page: query.page,
      pageSize: query.pageSize,
      query: query.q,
      family: query.family,
      subtype: query.subtype,
      tags: query.tags,
      availabilityStatus: query.availabilityStatus,
      minDailyPrice: query.minDailyPrice,
      maxDailyPrice: query.maxDailyPrice,
      geo:
        query.latitude !== undefined && query.longitude !== undefined
          ? {
              latitude: query.latitude,
              longitude: query.longitude,
              radiusKm: query.radiusKm,
            }
          : undefined,
      availabilityWindow:
        query.startAt !== undefined && query.endAt !== undefined
          ? {
              startAt: query.startAt,
              endAt: query.endAt,
            }
          : undefined,
      attributeFilters,
      sort: query.sort,
    };
  }

  private readAttributeFilters(searchParams: URLSearchParams): SearchAttributeFilterInput[] | undefined {
    const filters = new Map<
      string,
      {
        values: string[];
        min?: number;
        max?: number;
      }
    >();

    for (const [key, rawValue] of searchParams.entries()) {
      if (!key.startsWith("attr.")) {
        continue;
      }

      const attributeKey = key.slice("attr.".length);
      let targetKey = attributeKey;
      let bound: "min" | "max" | null = null;

      if (attributeKey.endsWith(".min")) {
        targetKey = attributeKey.slice(0, -4);
        bound = "min";
      } else if (attributeKey.endsWith(".max")) {
        targetKey = attributeKey.slice(0, -4);
        bound = "max";
      }

      if (!/^[a-z][a-z0-9_]*$/i.test(targetKey)) {
        throw new RequestValidationError("Request query validation failed.", [
          {
            path: key,
            message: "Attribute keys must start with a letter and contain only letters, numbers, and underscores.",
          },
        ]);
      }

      const filter = filters.get(targetKey) ?? { values: [] };

      if (bound) {
        const parsed = Number(rawValue);

        if (!Number.isFinite(parsed)) {
          throw new RequestValidationError("Request query validation failed.", [
            {
              path: key,
              message: "Attribute range values must be valid numbers.",
            },
          ]);
        }

        filter[bound] = parsed;
      } else {
        filter.values.push(rawValue);
      }

      filters.set(targetKey, filter);
    }

    if (filters.size === 0) {
      return undefined;
    }

    return Array.from(filters.entries()).map(([key, filter]) => ({
      key,
      ...(filter.values.length === 0
        ? {}
        : {
            value: filter.values.length === 1 ? filter.values[0] : filter.values,
          }),
      ...(filter.min !== undefined ? { min: filter.min } : {}),
      ...(filter.max !== undefined ? { max: filter.max } : {}),
    }));
  }

  private toListPostingAnalyticsInput(
    ownerId: string,
    query: ListPostingAnalyticsQuery,
  ): ListPostingAnalyticsInput {
    return {
      ownerId,
      window: query.window,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private toPostingAnalyticsDetailInput(
    ownerId: string,
    postingId: string,
    query: PostingAnalyticsDetailQuery,
  ): PostingAnalyticsDetailInput {
    return {
      ownerId,
      postingId,
      window: query.window,
      granularity: query.granularity,
    };
  }

  private parseBatchIds(context: Context<AppBindings>): string[] {
    const url = new URL(context.req.url);
    const ids = this.readArrayQuery(url.searchParams, "ids");

    if (ids.length === 0) {
      throw new RequestValidationError("At least one id must be provided.", [
        {
          path: "ids",
          message: "At least one id must be provided.",
        },
      ]);
    }

    return ids;
  }

  private readArrayQuery(searchParams: URLSearchParams, key: string): string[] {
    return searchParams
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private requireRouteId(context: Context<AppBindings>): string {
    return this.requireRouteParam(context, "id");
  }

  private requireRouteParam(context: Context<AppBindings>, name: string): string {
    return requireSafeRouteParam(context, name);
  }

  private async requireAuth(context: Context<AppBindings>): Promise<AuthPrincipal> {
    return requireJwtAuth(context);
  }

  private async getOptionalAuth(context: Context<AppBindings>): Promise<AuthPrincipal | null> {
    return getOptionalJwtAuth(context);
  }

  private readRequestId(context: Context<AppBindings>): string | undefined {
    return context.get("requestId");
  }

  private toValidationError(error: unknown, message: string): RequestValidationError {
    if ("issues" in (error as object)) {
      const issues = (error as { issues?: Array<{ path: PropertyKey[]; message: string }> }).issues;

      return new RequestValidationError(
        message,
        (issues ?? []).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    throw error;
  }
}
