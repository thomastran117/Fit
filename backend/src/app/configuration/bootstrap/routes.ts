import type { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import {
  getEnabledRouteModules,
  logRouteComposition,
  registerRouteModule,
} from "@/configuration/bootstrap/routes/registry";

export function mountRoutes(app: Hono<AppBindings>): Hono<AppBindings> {
  for (const routeModule of getEnabledRouteModules()) {
    registerRouteModule(routeModule, app);
  }

  logRouteComposition();

  return app;
}
