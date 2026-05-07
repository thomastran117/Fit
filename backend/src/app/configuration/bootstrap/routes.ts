import type { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { getApiRoutePrefix } from "@/configuration/http/api-path";
import {
  getEnabledRouteModules,
  logRouteComposition,
  registerRouteModule,
} from "@/configuration/bootstrap/routes/registry";

export function mountRoutes(app: Hono<AppBindings>): Hono<AppBindings> {
  const api = app.basePath(getApiRoutePrefix());

  for (const routeModule of getEnabledRouteModules()) {
    registerRouteModule(routeModule, api);
  }

  logRouteComposition();

  return app;
}
