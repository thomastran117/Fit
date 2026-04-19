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
} from "@/features/postings/postings.analytics.model";
import { PostingsAnalyticsService } from "@/features/postings/postings.analytics.service";
import {
  createPostingReviewRequestSchema,
  listPostingReviewsQuerySchema,
  type CreatePostingReviewRequestBody,
  type ListPostingReviewsQuery,
} from "@/features/postings/postings.reviews.model";
import { PostingsReviewsService } from "@/features/postings/postings.reviews.service";
import {
  listOwnerPostingsQuerySchema,
  publicSearchPostingsQuerySchema,
  type ListOwnerPostingsInput,
  type ListOwnerPostingsQuery,
  type PublicSearchPostingsQuery,
  type SearchPostingsInput,
  type UpsertPostingInput,
  type UpsertPostingRequestBody,
  upsertPostingRequestSchema,
} from "@/features/postings/postings.model";
import { PostingsService } from "@/features/postings/postings.service";
import type { JwtClaims } from "@/features/auth/token/token.service";

export class PostingsController {
  constructor(
    private readonly postingsService: PostingsService,
    private readonly postingsAnalyticsService: PostingsAnalyticsService,
    private readonly postingsReviewsService: PostingsReviewsService,
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
    const body = await parseRequestBody(context, upsertPostingRequestSchema);
    const result = await this.postingsService.update(
      this.requireRouteId(context),
      this.toUpsertInput(auth.sub, body),
    );
    return context.json(result);
  };

  publish = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.publish(this.requireRouteId(context), auth.sub);
    return context.json(result);
  };

  archive = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.postingsService.archive(this.requireRouteId(context), auth.sub);
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
    }

    return context.json(result);
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

  private toUpsertInput(userId: string, body: UpsertPostingRequestBody): UpsertPostingInput {
    return {
      ownerId: userId,
      name: body.name,
      description: body.description,
      pricing: body.pricing,
      photos: body.photos,
      tags: body.tags,
      attributes: body.attributes,
      availabilityStatus: body.availabilityStatus,
      availabilityNotes: body.availabilityNotes ?? null,
      maxBookingDurationDays: body.maxBookingDurationDays ?? null,
      availabilityBlocks: body.availabilityBlocks,
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

      return this.toSearchPostingsInput(query);
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

  private toSearchPostingsInput(query: PublicSearchPostingsQuery): SearchPostingsInput {
    if ((query.startAt === undefined) !== (query.endAt === undefined)) {
      throw new RequestValidationError("Request query validation failed.", [
        {
          path: "startAt",
          message: "startAt and endAt must be provided together.",
        },
      ]);
    }

    return {
      page: query.page,
      pageSize: query.pageSize,
      query: query.q,
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
      sort: query.sort,
    };
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
    const id = context.req.param("id");

    if (!id) {
      throw new RequestValidationError("Route parameter validation failed.", [
        {
          path: "id",
          message: "Route parameter id is required.",
        },
      ]);
    }

    return id;
  }

  private async requireAuth(context: Context<AppBindings>): Promise<JwtClaims> {
    return requireJwtAuth(context);
  }

  private async getOptionalAuth(context: Context<AppBindings>): Promise<JwtClaims | null> {
    return getOptionalJwtAuth(context);
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

