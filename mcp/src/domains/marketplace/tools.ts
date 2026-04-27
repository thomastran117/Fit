import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RentifyApiClient, type SearchPostingsQuery } from "../../integrations/rentify-api/client.js";
import { executeTool } from "../shared/tool-results.js";

export interface SearchPostingsToolArgs extends SearchPostingsQuery {}

export interface GetPostingToolArgs {
  id: string;
}

export interface BatchGetPostingsToolArgs {
  ids: string[];
}

export interface ListPostingReviewsToolArgs {
  id: string;
  page?: number;
  pageSize?: number;
}

export function createMarketplaceToolHandlers(apiClient: RentifyApiClient) {
  return {
    searchPostings: (args: SearchPostingsToolArgs) =>
      executeTool(
        () => apiClient.searchPostings(args),
        (result) =>
          `Returned ${result.postings.length} posting(s) from the public marketplace search using ${result.source}.`,
      ),
    getPosting: (args: GetPostingToolArgs) =>
      executeTool(
        () => apiClient.getPosting(args.id),
        (result) => `Fetched posting ${result.id}${result.name ? ` (${result.name})` : ""}.`,
      ),
    batchGetPostings: (args: BatchGetPostingsToolArgs) =>
      executeTool(
        () => apiClient.batchGetPostings(args.ids),
        (result) =>
          `Fetched ${result.postings.length} posting(s); ${result.missingIds.length} id(s) were not found.`,
      ),
    listPostingReviews: (args: ListPostingReviewsToolArgs) =>
      executeTool(
        () =>
          apiClient.listPostingReviews(args.id, {
            page: args.page,
            pageSize: args.pageSize,
          }),
        (result) =>
          `Fetched ${result.reviews.length} review(s); average rating is ${result.summary.averageRating} across ${result.summary.reviewCount} review(s).`,
      ),
  };
}

export function registerMarketplaceTools(
  server: McpServer,
  handlers: ReturnType<typeof createMarketplaceToolHandlers>,
): void {
  server.registerTool(
    "search_postings",
    {
      title: "Search Postings",
      description: "Search the public Rentify marketplace for published postings.",
      inputSchema: {
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
        q: z.string().trim().min(1).max(120).optional(),
        family: z.string().trim().min(1).optional(),
        subtype: z.string().trim().min(1).optional(),
        tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
        availabilityStatus: z.enum(["available", "limited", "unavailable"]).optional(),
        minDailyPrice: z.number().nonnegative().optional(),
        maxDailyPrice: z.number().nonnegative().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        radiusKm: z.number().positive().max(20_000).optional(),
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
        sort: z
          .enum(["relevance", "newest", "oldest", "dailyPrice", "nearest", "nameAsc", "nameDesc"])
          .optional(),
      },
    },
    handlers.searchPostings,
  );

  server.registerTool(
    "get_posting",
    {
      title: "Get Posting",
      description: "Fetch a single public Rentify posting by id.",
      inputSchema: {
        id: z.string().trim().min(1),
      },
    },
    handlers.getPosting,
  );

  server.registerTool(
    "batch_get_postings",
    {
      title: "Batch Get Postings",
      description: "Fetch multiple public Rentify postings by id in one request.",
      inputSchema: {
        ids: z.array(z.string().trim().min(1)).min(1).max(50),
      },
    },
    handlers.batchGetPostings,
  );

  server.registerTool(
    "list_posting_reviews",
    {
      title: "List Posting Reviews",
      description: "List public reviews for a Rentify posting.",
      inputSchema: {
        id: z.string().trim().min(1),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
      },
    },
    handlers.listPostingReviews,
  );
}
