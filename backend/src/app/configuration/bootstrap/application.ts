import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { mountRoutes } from "@/configuration/bootstrap/routes";
import { getApiRoutePrefix } from "@/configuration/http/api-path";
import { clientContextMiddleware } from "../middlewares/client-context.middleware";
import { containerScopeMiddleware } from "../middlewares/container-scope.middleware";
import { corsMiddleware } from "../middlewares/cors.middleware";
import { csrfMiddleware } from "../middlewares/csrf.middleware";
import { handleApplicationError } from "../middlewares/error-handler.middleware";
import { httpLoggingMiddleware } from "../middlewares/http-logging.middleware";
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware";
import { outputFormatMiddleware } from "../middlewares/output-format.middleware";
import { rateLimiterMiddleware } from "../middlewares/rate-limiter.middleware";
import { requestBodyPolicyMiddleware } from "../middlewares/request-body-policy.middleware";
import { requestIdMiddleware } from "../middlewares/request-id.middleware";
import { requestLoggerMiddleware } from "../middlewares/request-logger.middleware";
import { requestSanitizationMiddleware } from "../middlewares/request-sanitization.middleware";
import { requestTimeoutMiddleware } from "../middlewares/request-timeout.middleware";
import { securityHeadersMiddleware } from "../middlewares/security-headers.middleware";

export function createApplication(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  const api = app.basePath(getApiRoutePrefix());

  api.use("*", corsMiddleware);
  api.use("*", requestIdMiddleware);
  api.use("*", clientContextMiddleware);
  api.use("*", containerScopeMiddleware);
  api.use("*", requestLoggerMiddleware);
  api.use("*", requestTimeoutMiddleware);
  api.use("*", requestBodyPolicyMiddleware);
  api.use("*", requestSanitizationMiddleware);
  api.use("/auth/*", csrfMiddleware);
  api.use("/auth/*", idempotencyMiddleware);
  api.use("/payments/*", idempotencyMiddleware);
  api.use("/booking-requests/:id/payment-session", idempotencyMiddleware);
  api.use("*", rateLimiterMiddleware);
  api.use("*", outputFormatMiddleware);
  api.use("*", securityHeadersMiddleware);
  api.use("*", httpLoggingMiddleware);
  app.onError(handleApplicationError);
  return mountRoutes(app);
}
