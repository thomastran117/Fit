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
import {
  createBookingsToolHandlers,
  registerBookingsTools,
} from "../domains/bookings/index.js";
import {
  createRentingsToolHandlers,
  registerRentingsTools,
} from "../domains/rentings/index.js";

export function createServer(config: RentifyMcpConfig, apiClient: RentifyApiClient): McpServer {
  const server = new McpServer(
    {
      name: config.serverName,
      version: config.serverVersion,
    },
    {
      instructions:
        "These tools wrap the live Rentify marketplace, postings, bookings, and rentings APIs. Use the marketplace tools to discover public listings, then use the authenticated owner tools for postings, booking requests, booking quotes, and rentings. Protected tools require RENTIFY_PAT, and mutation tools require a PAT with mcp:write scope. This MCP intentionally does not expose payment-session or direct payment-creation tools. Calls may fail if the backend API is unavailable.",
    },
  );

  registerMarketplaceTools(server, createMarketplaceToolHandlers(apiClient));
  registerPostingsTools(server, createPostingsToolHandlers(apiClient));
  registerBookingsTools(server, createBookingsToolHandlers(apiClient));
  registerRentingsTools(server, createRentingsToolHandlers(apiClient));

  return server;
}
