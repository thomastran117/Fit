import { createMiddleware } from "hono/factory";
import type { AppBindings } from "@/configuration/http/bindings";
import { assertSafeRequestQuery } from "@/configuration/validation/input-sanitization";

export const requestSanitizationMiddleware = createMiddleware<AppBindings>(
  async (context, next) => {
    assertSafeRequestQuery(context);
    await next();
  },
);
