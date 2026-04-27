import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RentifyMcpConfig } from "../config/index.js";
import { RentifyApiClient } from "../integrations/rentify-api/index.js";
import {
  createMarketplaceToolHandlers,
  registerMarketplaceTools,
} from "../domains/marketplace/index.js";
import {
  createPostingsToolHandlers,
  registerPostingsTools,
} from "../domains/postings/index.js";

export function createServer(config: RentifyMcpConfig, apiClient: RentifyApiClient): McpServer {
  const server = new McpServer(
    {
      name: config.serverName,
      version: config.serverVersion,
    },
    {
      instructions:
        "These tools wrap the live Rentify postings API. Use the marketplace tools to discover public listings, then use the authenticated postings tools for owner posting management, analytics, availability blocks, and posting lifecycle actions. Protected tools require RENTIFY_PAT, and mutation tools require a PAT with mcp:write scope. Calls may fail if the backend API is unavailable.",
    },
  );

  registerMarketplaceTools(server, createMarketplaceToolHandlers(apiClient));
  registerPostingsTools(server, createPostingsToolHandlers(apiClient));

  return server;
}
