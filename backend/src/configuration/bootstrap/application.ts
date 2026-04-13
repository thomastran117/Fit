import { Hono } from "hono";
import { mountRoutes } from "@/configuration/bootstrap/routes.js";

export function createApplication(): Hono {
  const app = new Hono();
  return mountRoutes(app);
}
