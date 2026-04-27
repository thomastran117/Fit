import {
  BackendApiError,
  BackendUnavailableError,
} from "../../integrations/rentify-api/index.js";
import { createMarketplaceToolHandlers } from "../../domains/marketplace/index.js";

function readFirstText(result: { content: Array<{ type: string } & Record<string, unknown>> }): string {
  const textBlock = result.content.find(
    (entry): entry is { type: "text"; text: string } => entry.type === "text",
  );

  return textBlock?.text ?? "";
}

describe("createMarketplaceToolHandlers", () => {
  it("maps search_postings to the public postings search API", async () => {
    const apiClient = {
      searchPostings: jest.fn().mockResolvedValue({
        postings: [{ id: "post_1", name: "Bike" }],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        source: "database",
      }),
    } as never;
    const handlers = createMarketplaceToolHandlers(apiClient);

    const result = await handlers.searchPostings({
      q: "bike",
      tags: ["outdoor"],
      page: 2,
    });

    expect((apiClient as { searchPostings: jest.Mock }).searchPostings).toHaveBeenCalledWith({
      q: "bike",
      tags: ["outdoor"],
      page: 2,
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      postings: [{ id: "post_1" }],
    });
    expect(readFirstText(result)).toContain("Returned 1 posting(s)");
  });

  it("maps get_posting to the posting lookup API", async () => {
    const apiClient = {
      getPosting: jest.fn().mockResolvedValue({
        id: "post_1",
        name: "Bike",
      }),
    } as never;
    const handlers = createMarketplaceToolHandlers(apiClient);

    const result = await handlers.getPosting({
      id: "post_1",
    });

    expect((apiClient as { getPosting: jest.Mock }).getPosting).toHaveBeenCalledWith("post_1");
    expect(result.structuredContent).toMatchObject({
      id: "post_1",
    });
    expect(readFirstText(result)).toContain("Fetched posting post_1");
  });

  it("maps batch_get_postings to the batch lookup API", async () => {
    const apiClient = {
      batchGetPostings: jest.fn().mockResolvedValue({
        postings: [{ id: "post_1", name: "Bike" }],
        missingIds: ["missing"],
      }),
    } as never;
    const handlers = createMarketplaceToolHandlers(apiClient);

    const result = await handlers.batchGetPostings({
      ids: ["post_1", "missing"],
    });

    expect((apiClient as { batchGetPostings: jest.Mock }).batchGetPostings).toHaveBeenCalledWith([
      "post_1",
      "missing",
    ]);
    expect(readFirstText(result)).toContain("1 id(s) were not found");
  });

  it("maps list_posting_reviews to the reviews API", async () => {
    const apiClient = {
      listPostingReviews: jest.fn().mockResolvedValue({
        reviews: [{ id: "review_1", rating: 5 }],
        summary: {
          averageRating: 5,
          reviewCount: 1,
        },
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    } as never;
    const handlers = createMarketplaceToolHandlers(apiClient);

    const result = await handlers.listPostingReviews({
      id: "post_1",
      page: 2,
      pageSize: 10,
    });

    expect((apiClient as { listPostingReviews: jest.Mock }).listPostingReviews).toHaveBeenCalledWith(
      "post_1",
      {
        page: 2,
        pageSize: 10,
      },
    );
    expect(readFirstText(result)).toContain("average rating is 5");
  });

  it("returns isError results for backend HTTP failures", async () => {
    const apiClient = {
      getPosting: jest
        .fn()
        .mockRejectedValue(new BackendApiError(404, "RESOURCE_NOT_FOUND", { id: "missing" }, "Posting could not be found.")),
    } as never;
    const handlers = createMarketplaceToolHandlers(apiClient);

    const result = await handlers.getPosting({
      id: "missing",
    });

    expect(result.isError).toBe(true);
    expect(readFirstText(result)).toContain("\"status\": 404");
    expect(readFirstText(result)).toContain("\"code\": \"RESOURCE_NOT_FOUND\"");
  });

  it("returns isError results for backend connectivity failures", async () => {
    const apiClient = {
      searchPostings: jest
        .fn()
        .mockRejectedValue(new BackendUnavailableError("BACKEND_UNAVAILABLE", "Could not reach backend.")),
    } as never;
    const handlers = createMarketplaceToolHandlers(apiClient);

    const result = await handlers.searchPostings({});

    expect(result.isError).toBe(true);
    expect(readFirstText(result)).toContain("\"code\": \"BACKEND_UNAVAILABLE\"");
  });
});
