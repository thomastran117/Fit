import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { mountRoutes } from "@/configuration/bootstrap/routes";
import { clientContextMiddleware } from "../middlewares/client-context.middleware";
import { handleApplicationError } from "../middlewares/error-handler.middleware";
import { httpLoggingMiddleware } from "../middlewares/http-logging.middleware";
import { outputFormatMiddleware } from "../middlewares/output-format.middleware";
import { rateLimiterMiddleware } from "../middlewares/rate-limiter.middleware";

export function createApplication(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.use("*", clientContextMiddleware);
  app.use("*", rateLimiterMiddleware);
  app.use("*", outputFormatMiddleware);
  app.use("*", httpLoggingMiddleware);
  app.onError(handleApplicationError);
  return mountRoutes(app);
}
