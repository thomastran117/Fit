import { createMiddleware } from "hono/factory";
import type { AppBindings } from "@/configuration/http/bindings";
import { containerTokens, getRequestContainer } from "@/configuration/bootstrap/container";
import UnauthorizedError from "@/errors/http/unauthorized.error";

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
  const token = readBearerToken(context.req.header("authorization"));
  const claims = getRequestContainer(context).resolve(containerTokens.tokenService).verifyAccessToken(token);

  context.set("auth", claims);
  await next();
});
