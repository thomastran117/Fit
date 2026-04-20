import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { requireMinimumRole } from "@/features/auth/authorization";
import { requireJwtAuth } from "@/configuration/middlewares/jwt-middleware";
import {
  RequestValidationError,
  parseRequestBody,
} from "@/configuration/validation/request";
import type {
  CreateBookingRequestInput,
  DecideBookingRequestInput,
  ListBookingRequestsQuery,
  ListOwnerBookingRequestsInput,
  ListRenterBookingRequestsInput,
  UpdateBookingRequestInput,
} from "@/features/bookings/bookings.model";
import {
  createBookingRequestSchema,
  decideBookingRequestSchema,
  listBookingRequestsQuerySchema,
  updateBookingRequestSchema,
} from "@/features/bookings/bookings.model";
import type { BookingsService } from "@/features/bookings/bookings.service";

export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  createForPosting = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const body = await parseRequestBody(context, createBookingRequestSchema);
    const result = await this.bookingsService.create(
      this.toCreateInput(this.requirePostingId(context), auth.sub, body),
    );
    return context.json(result, 201);
  };

  listMine = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const result = await this.bookingsService.listMine(
      this.toListMineInput(auth.sub, this.parseListQuery(context)),
    );
    return context.json(result);
  };

  listForOwnerPosting = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const result = await this.bookingsService.listForOwnerPosting(
      this.toListOwnerPostingInput(auth.sub, this.requirePostingId(context), this.parseListQuery(context)),
    );
    return context.json(result);
  };

  getById = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const result = await this.bookingsService.getById(
      this.requireBookingRequestId(context),
      auth.sub,
    );
    return context.json(result);
  };

  updateOwn = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    const body = await parseRequestBody(context, updateBookingRequestSchema);
    const result = await this.bookingsService.updateOwnPending(
      this.toUpdateInput(this.requireBookingRequestId(context), auth.sub, body),
    );
    return context.json(result);
  };

  approve = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const body = await parseRequestBody(context, decideBookingRequestSchema);
    const result = await this.bookingsService.approve(
      this.toDecisionInput(this.requireBookingRequestId(context), auth.sub, body),
    );
    return context.json(result);
  };

  decline = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAuth(context);
    requireMinimumRole(auth, "owner");
    const body = await parseRequestBody(context, decideBookingRequestSchema);
    const result = await this.bookingsService.decline(
      this.toDecisionInput(this.requireBookingRequestId(context), auth.sub, body),
    );
    return context.json(result);
  };

  private parseListQuery(context: Context<AppBindings>): ListBookingRequestsQuery {
    const url = new URL(context.req.url);

    try {
      return listBookingRequestsQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      });
    } catch (error) {
      throw this.toValidationError(error, "Request query validation failed.");
    }
  }

  private toCreateInput(
    postingId: string,
    renterId: string,
    body: {
      startAt: string;
      endAt: string;
      guestCount: number;
      note?: string | null;
      contactName: string;
      contactEmail: string;
      contactPhoneNumber?: string | null;
    },
  ): CreateBookingRequestInput {
    return {
      postingId,
      renterId,
      startAt: body.startAt,
      endAt: body.endAt,
      guestCount: body.guestCount,
      note: body.note ?? null,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhoneNumber: body.contactPhoneNumber ?? null,
    };
  }

  private toDecisionInput(
    bookingRequestId: string,
    ownerId: string,
    body: {
      note?: string | null;
    },
  ): DecideBookingRequestInput {
    return {
      bookingRequestId,
      ownerId,
      note: body.note ?? null,
    };
  }

  private toUpdateInput(
    bookingRequestId: string,
    renterId: string,
    body: {
      startAt: string;
      endAt: string;
      guestCount: number;
      note?: string | null;
      contactName: string;
      contactEmail: string;
      contactPhoneNumber?: string | null;
    },
  ): UpdateBookingRequestInput {
    return {
      bookingRequestId,
      renterId,
      startAt: body.startAt,
      endAt: body.endAt,
      guestCount: body.guestCount,
      note: body.note ?? null,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhoneNumber: body.contactPhoneNumber ?? null,
    };
  }

  private toListMineInput(
    renterId: string,
    query: ListBookingRequestsQuery,
  ): ListRenterBookingRequestsInput {
    return {
      renterId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    };
  }

  private toListOwnerPostingInput(
    ownerId: string,
    postingId: string,
    query: ListBookingRequestsQuery,
  ): ListOwnerBookingRequestsInput {
    return {
      ownerId,
      postingId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    };
  }

  private requirePostingId(context: Context<AppBindings>): string {
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

  private async requireAuth(context: Context<AppBindings>) {
    return requireJwtAuth(context);
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
