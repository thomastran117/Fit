import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import {
  RequestValidationError,
  parseRequestBody,
} from "@/configuration/validation/request";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { getContainer } from "@/configuration/bootstrap/container";
import {
  listRentingAnalyticsQuerySchema,
  rentingAnalyticsDetailQuerySchema,
  rentingAnalyticsSummaryQuerySchema,
  type ListRentingAnalyticsInput,
  type ListRentingAnalyticsQuery,
  type RentingAnalyticsDetailInput,
  type RentingAnalyticsDetailQuery,
  type RentingAnalyticsSummaryQuery,
} from "@/features/rentings/rentings.analytics.model";
import { RentingsAnalyticsService } from "@/features/rentings/rentings.analytics.service";
import {
  createRentingReviewRequestSchema,
  listRentingReviewsQuerySchema,
  type CreateRentingReviewRequestBody,
  type ListRentingReviewsQuery,
} from "@/features/rentings/rentings.reviews.model";
import { RentingsReviewsService } from "@/features/rentings/rentings.reviews.service";
import {
  listOwnerRentingsQuerySchema,
  publicSearchRentingsQuerySchema,
  type ListOwnerRentingsInput,
  type ListOwnerRentingsQuery,
  type PublicSearchRentingsQuery,
  type SearchRentingsInput,
  type UpsertRentingInput,
  type UpsertRentingRequestBody,
  upsertRentingRequestSchema,
} from "@/features/rentings/rentings.model";
import { RentingsService } from "@/features/rentings/rentings.service";

export class RentingsController {
  constructor(
    private readonly rentingsService: RentingsService,
    private readonly rentingsAnalyticsService: RentingsAnalyticsService,
    private readonly rentingsReviewsService: RentingsReviewsService,
  ) {}

  create = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const body = await parseRequestBody(context, upsertRentingRequestSchema);
    const result = await this.rentingsService.createDraft(this.toUpsertInput(auth.sub, body));
    return context.json(result, 201);
  };

  update = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const body = await parseRequestBody(context, upsertRentingRequestSchema);
    const result = await this.rentingsService.update(
      this.requireRouteId(context),
      this.toUpsertInput(auth.sub, body),
    );
    return context.json(result);
  };

  publish = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const result = await this.rentingsService.publish(this.requireRouteId(context), auth.sub);
    return context.json(result);
  };

  archive = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const result = await this.rentingsService.archive(this.requireRouteId(context), auth.sub);
    return context.json(result);
  };

  getById = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.getOptionalAuth(context);
    const result = await this.rentingsService.getById(this.requireRouteId(context), auth?.sub);

    if (!auth || auth.sub !== result.ownerId) {
      await this.rentingsAnalyticsService.trackPublicView(
        result,
        context.get("client"),
        auth?.sub,
      );
    }

    return context.json(result);
  };

  listMine = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const result = await this.rentingsService.listByOwner(
      this.parseListOwnerRentingsInput(context, auth.sub),
    );
    return context.json(result);
  };

  batchMine = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const result = await this.rentingsService.batchByOwner(
      auth.sub,
      this.parseBatchIds(context),
    );
    return context.json(result);
  };

  batchPublic = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.rentingsService.batchPublic(this.parseBatchIds(context));
    return context.json(result);
  };

  search = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.rentingsService.searchPublic(
      this.parseSearchRentingsInput(context),
    );
    return context.json(result);
  };

  analyticsSummary = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const query = this.parseAnalyticsSummaryQuery(context);
    const result = await this.rentingsAnalyticsService.getOwnerSummary(auth.sub, query.window);
    return context.json(result);
  };

  analyticsRentings = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const input = this.parseListRentingAnalyticsInput(context, auth.sub);
    const result = await this.rentingsAnalyticsService.listOwnerRentingsAnalytics(input);
    return context.json(result);
  };

  analyticsById = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const input = this.parseRentingAnalyticsDetailInput(
      context,
      auth.sub,
      this.requireRouteId(context),
    );
    const result = await this.rentingsAnalyticsService.getRentingAnalyticsDetail(input);
    return context.json(result);
  };

  listReviews = async (context: Context<AppBindings>): Promise<Response> => {
    const { page, pageSize } = this.parseListRentingReviewsQuery(context);
    const result = await this.rentingsReviewsService.list(
      this.requireRouteId(context),
      page,
      pageSize,
    );
    return context.json(result);
  };

  createReview = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const body = await parseRequestBody(context, createRentingReviewRequestSchema);
    const result = await this.rentingsReviewsService.create(
      this.requireRouteId(context),
      auth.sub,
      body,
    );
    return context.json(result, 201);
  };

  updateOwnReview = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = this.requireAuth(context);
    const body = await parseRequestBody(context, createRentingReviewRequestSchema);
    const result = await this.rentingsReviewsService.updateOwn(
      this.requireRouteId(context),
      auth.sub,
      body,
    );
    return context.json(result);
  };

  private toUpsertInput(userId: string, body: UpsertRentingRequestBody): UpsertRentingInput {
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

  private parseListOwnerRentingsInput(
    context: Context<AppBindings>,
    ownerId: string,
  ): ListOwnerRentingsInput {
    const url = new URL(context.req.url);

    try {
      const query = listOwnerRentingsQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      });

      return this.toListOwnerRentingsInput(ownerId, query);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseSearchRentingsInput(context: Context<AppBindings>): SearchRentingsInput {
    const url = new URL(context.req.url);

    try {
      const query = publicSearchRentingsQuerySchema.parse({
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
        sort: url.searchParams.get("sort") ?? undefined,
      });

      return this.toSearchRentingsInput(query);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseListRentingReviewsQuery(
    context: Context<AppBindings>,
  ): ListRentingReviewsQuery {
    const url = new URL(context.req.url);

    try {
      return listRentingReviewsQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      });
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseAnalyticsSummaryQuery(context: Context<AppBindings>): RentingAnalyticsSummaryQuery {
    const url = new URL(context.req.url);

    try {
      return rentingAnalyticsSummaryQuerySchema.parse({
        window: url.searchParams.get("window") ?? undefined,
      });
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseListRentingAnalyticsInput(
    context: Context<AppBindings>,
    ownerId: string,
  ): ListRentingAnalyticsInput {
    const url = new URL(context.req.url);

    try {
      const query = listRentingAnalyticsQuerySchema.parse({
        window: url.searchParams.get("window") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
      });

      return this.toListRentingAnalyticsInput(ownerId, query);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private parseRentingAnalyticsDetailInput(
    context: Context<AppBindings>,
    ownerId: string,
    rentingId: string,
  ): RentingAnalyticsDetailInput {
    const url = new URL(context.req.url);

    try {
      const query = rentingAnalyticsDetailQuerySchema.parse({
        window: url.searchParams.get("window") ?? undefined,
        granularity: url.searchParams.get("granularity") ?? undefined,
      });

      return this.toRentingAnalyticsDetailInput(ownerId, rentingId, query);
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private toListOwnerRentingsInput(
    ownerId: string,
    query: ListOwnerRentingsQuery,
  ): ListOwnerRentingsInput {
    return {
      ownerId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    };
  }

  private toSearchRentingsInput(query: PublicSearchRentingsQuery): SearchRentingsInput {
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
      sort: query.sort,
    };
  }

  private toListRentingAnalyticsInput(
    ownerId: string,
    query: ListRentingAnalyticsQuery,
  ): ListRentingAnalyticsInput {
    return {
      ownerId,
      window: query.window,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private toRentingAnalyticsDetailInput(
    ownerId: string,
    rentingId: string,
    query: RentingAnalyticsDetailQuery,
  ): RentingAnalyticsDetailInput {
    return {
      ownerId,
      rentingId,
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

  private requireAuth(context: Context<AppBindings>) {
    const auth = this.getOptionalAuth(context);

    if (!auth) {
      throw new UnauthorizedError("Authorization header is required.");
    }

    return auth;
  }

  private getOptionalAuth(context: Context<AppBindings>) {
    const authorization = context.req.header("authorization");

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedError("Authorization header must use the Bearer scheme.");
    }

    return getContainer().tokenService.verifyAccessToken(token);
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
