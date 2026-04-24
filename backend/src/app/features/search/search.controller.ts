import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { requireJwtAuth } from "@/configuration/middlewares/jwt-middleware";
import { requireMinimumRole } from "@/features/auth/authorization";
import { requireSafeRouteParam } from "@/configuration/validation/input-sanitization";
import type { SearchService } from "@/features/search/search.service";

export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  startReindex = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAdmin(context);
    void auth;
    const result = await this.searchService.startReindex();
    return context.json(result, 202);
  };

  getReindexRun = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAdmin(context);
    void auth;
    const result = await this.searchService.getReindexRun(this.requireRouteId(context));
    return context.json(result ?? { run: null });
  };

  getStatus = async (context: Context<AppBindings>): Promise<Response> => {
    const auth = await this.requireAdmin(context);
    void auth;
    const result = await this.searchService.getStatus();
    return context.json(result);
  };

  private requireRouteId(context: Context<AppBindings>): string {
    return requireSafeRouteParam(context, "id");
  }

  private async requireAdmin(context: Context<AppBindings>) {
    const auth = await requireJwtAuth(context);
    requireMinimumRole(auth, "admin");
    return auth;
  }
}
