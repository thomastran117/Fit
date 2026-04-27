import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { requireSessionAuth } from "@/configuration/middlewares/jwt-middleware";
import { requireSafeRouteParam } from "@/configuration/validation/input-sanitization";
import { parseRequestBody } from "@/configuration/validation/request";
import {
  createPersonalAccessTokenRequestSchema,
  type CreatePersonalAccessTokenRequestBody,
  type CreatePersonalAccessTokenInput,
} from "./personal-access-token.model";
import { PersonalAccessTokenService } from "./personal-access-token.service";

export class PersonalAccessTokenController {
  constructor(
    private readonly personalAccessTokenService: PersonalAccessTokenService,
  ) {}

  list = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await requireSessionAuth(context);
    const result = await this.personalAccessTokenService.listForUser(auth.sub);
    return context.json(result);
  };

  create = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await requireSessionAuth(context);
    const input = await parseRequestBody(context, createPersonalAccessTokenRequestSchema);
    const result = await this.personalAccessTokenService.create(
      this.toCreateInput(auth.sub, input),
    );
    return context.json(result, 201);
  };

  revoke = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await requireSessionAuth(context);
    const result = await this.personalAccessTokenService.revoke({
      userId: auth.sub,
      tokenId: requireSafeRouteParam(context, "id"),
    });
    return context.json(result);
  };

  private toCreateInput(
    userId: string,
    input: CreatePersonalAccessTokenRequestBody,
  ): CreatePersonalAccessTokenInput {
    return {
      userId,
      name: input.name,
      scopes: input.scopes as CreatePersonalAccessTokenInput["scopes"],
      expiresAt: input.expiresAt,
      expiresInDays: input.expiresInDays,
    };
  }
}
