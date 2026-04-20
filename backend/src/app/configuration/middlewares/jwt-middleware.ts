import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { containerTokens, getRequestContainer } from "@/configuration/bootstrap/container";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import type { JwtClaims } from "@/features/auth/token/token.service";

function readBearerToken(headerValue?: string): string {
  if (!headerValue) {
    throw new UnauthorizedError("Authorization header is required.");
  }

  const [scheme, token] = headerValue.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Authorization header must use the Bearer scheme.");
  }

  return token;
}

export const jwtMiddleware = createMiddleware<AppBindings>(async (context, next) => {
  await requireJwtAuth(context);
  await next();
});

export async function requireJwtAuth(context: Context<AppBindings>): Promise<JwtClaims> {
  const token = readBearerToken(context.req.header("authorization"));
  const claims = await getRequestContainer(context)
    .resolve(containerTokens.tokenService)
    .verifyAccessToken(token);

  context.set("auth", claims);
  return claims;
}

export async function getOptionalJwtAuth(
  context: Context<AppBindings>,
): Promise<JwtClaims | null> {
  if (!context.req.header("authorization")) {
    return null;
  }

  return requireJwtAuth(context);
}
