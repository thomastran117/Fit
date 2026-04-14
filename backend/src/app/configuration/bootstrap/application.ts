import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { mountRoutes } from "@/configuration/bootstrap/routes";
import { clientContextMiddleware } from "../middlewares/client-context.middleware";
import { handleApplicationError } from "../middlewares/error-handler.middleware";

export function createApplication(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.use("*", clientContextMiddleware);
  app.onError(handleApplicationError);
  return mountRoutes(app);
}
