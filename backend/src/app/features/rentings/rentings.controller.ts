import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { RequestValidationError } from "@/configuration/validation/request";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import type { ListMyRentingsInput, ListRentingsQuery } from "@/features/rentings/rentings.model";
import { listRentingsQuerySchema } from "@/features/rentings/rentings.model";
import type { RentingsService } from "@/features/rentings/rentings.service";
import type { TokenService } from "@/features/auth/token/token.service";

export class RentingsController {
  constructor(
    private readonly rentingsService: RentingsService,
    private readonly tokenService: TokenService,
  ) {}

  convertBookingRequest = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const result = await this.rentingsService.convertApprovedBookingRequest({
      bookingRequestId: this.requireBookingRequestId(context),
      ownerId: auth.sub,
    });
    return context.json(result, 201);
  };

  getById = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const result = await this.rentingsService.getById(this.requireRentingId(context), auth.sub);
    return context.json(result);
  };

  listMine = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const query = this.parseListQuery(context);
    const result = await this.rentingsService.listMine(this.toListMineInput(auth.sub, query));
    return context.json(result);
  };

  private parseListQuery(context: Context<AppBindings>): ListRentingsQuery {
    const url = new URL(context.req.url);

    try {
      return listRentingsQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      });
    } catch (error) {
      if ("issues" in (error as object)) {
        const issues = (error as { issues?: Array<{ path: PropertyKey[]; message: string }> }).issues;

        throw new RequestValidationError(
          "Request query validation failed.",
          (issues ?? []).map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      throw error;
    }
  }

  private toListMineInput(userId: string, query: ListRentingsQuery): ListMyRentingsInput {
    return {
      userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    };
  }

  private requireBookingRequestId(context: Context<AppBindings>): string {
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

  private requireRentingId(context: Context<AppBindings>): string {
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

  private async requireAuth(context: Context<AppBindings>) {
    const authorization = context.req.header("authorization");

    if (!authorization) {
      throw new UnauthorizedError("Authorization header is required.");
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedError("Authorization header must use the Bearer scheme.");
    }

    return this.tokenService.verifyAccessToken(token);
  }
}
