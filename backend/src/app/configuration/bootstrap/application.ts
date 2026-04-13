import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { mountRoutes } from "@/configuration/bootstrap/routes";
import { handleApplicationError } from "@/configuration/http/middleware/error-handler";
import { clientContextMiddleware } from "@/configuration/http/middleware/client-context";

export function createApplication(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.use("*", clientContextMiddleware);
  app.onError(handleApplicationError);
  return mountRoutes(app);
}
