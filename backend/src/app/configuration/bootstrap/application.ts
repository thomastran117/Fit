import { Hono } from "hono";
import { mountRoutes } from "@/configuration/bootstrap/routes";

export function createApplication(): Hono {
  const app = new Hono();
  return mountRoutes(app);
}
