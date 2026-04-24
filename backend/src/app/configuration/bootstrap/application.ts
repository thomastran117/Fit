import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { mountRoutes } from "@/configuration/bootstrap/routes";
import { clientContextMiddleware } from "../middlewares/client-context.middleware";
import { containerScopeMiddleware } from "../middlewares/container-scope.middleware";
import { corsMiddleware } from "../middlewares/cors.middleware";
import { csrfMiddleware } from "../middlewares/csrf.middleware";
import { handleApplicationError } from "../middlewares/error-handler.middleware";
import { httpLoggingMiddleware } from "../middlewares/http-logging.middleware";
import { outputFormatMiddleware } from "../middlewares/output-format.middleware";
import { rateLimiterMiddleware } from "../middlewares/rate-limiter.middleware";
import { requestSanitizationMiddleware } from "../middlewares/request-sanitization.middleware";

export function createApplication(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.use("*", corsMiddleware);
  app.use("*", clientContextMiddleware);
  app.use("*", containerScopeMiddleware);
  app.use("*", requestSanitizationMiddleware);
  app.use("/auth/*", csrfMiddleware);
  app.use("*", rateLimiterMiddleware);
  app.use("*", outputFormatMiddleware);
  app.use("*", httpLoggingMiddleware);
  app.onError(handleApplicationError);
  return mountRoutes(app);
}
