import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RentifyMcpConfig } from "./config.js";
import { RentifyApiClient } from "./backend-api-client.js";
import {
  createMarketplaceToolHandlers,
  registerMarketplaceTools,
} from "./marketplace-tools.js";

export function createServer(config: RentifyMcpConfig, apiClient: RentifyApiClient): McpServer {
  const server = new McpServer(
    {
      name: config.serverName,
      version: config.serverVersion,
    },
    {
      instructions:
        "These tools are read-only wrappers around the live Rentify backend API. Use search_postings to discover public listings, then use get_posting for full detail on a specific result. These tools do not perform writes or authenticated actions, and calls may fail if the backend API is unavailable.",
    },
  );

  registerMarketplaceTools(server, createMarketplaceToolHandlers(apiClient));

  return server;
}
