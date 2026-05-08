import type { RouteModule } from "@/configuration/bootstrap/routes/types";
import { getApiRoutePrefix, getApiVersion } from "@/configuration/http/api-path";
import { pingDatabase } from "@/configuration/resources/database";

export const systemRouteModule: RouteModule = {
  id: "system",
  register(app) {
    app.get("/", (context) => {
      return context.json({
        apiVersion: getApiVersion(),
        apiBasePath: getApiRoutePrefix(),
        message: "TypeScript Hono server is running",
      });
    });

    app.get("/health", async (context) => {
      try {
        const database = await pingDatabase();

        return context.json({
          ok: true,
          uptime: process.uptime(),
          checks: {
            database,
          },
        });
      } catch (error) {
        return context.json(
          {
            ok: false,
            uptime: process.uptime(),
            checks: {
              database: {
                ok: false,
                message: error instanceof Error ? error.message : "Database health check failed.",
              },
            },
          },
          503,
        );
      }
    });
  },
};
