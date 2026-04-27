import {
  AuthNotConfiguredError,
  BackendApiError,
  BackendUnavailableError,
  RentifyApiClient,
  buildApiUrl,
} from "../../integrations/rentify-api/index.js";

function createFetchMock(): jest.MockedFunction<typeof fetch> {
  return jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
}

describe("buildApiUrl", () => {
  it("serializes repeated array query parameters and forces JSON output", () => {
    const url = buildApiUrl("http://127.0.0.1:8040", "/postings/batch", {
      ids: ["post_1", "post_2"],
      page: 2,
    });

    expect(url.origin + url.pathname).toBe("http://127.0.0.1:8040/postings/batch");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.getAll("ids")).toEqual(["post_1", "post_2"]);
  });
});

describe("RentifyApiClient", () => {
  it("calls the search endpoint with the expected public query shape", async () => {
    const fetchMock = createFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          postings: [],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          source: "database",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=UTF-8",
          },
        },
      ),
    );
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
    });

    await client.searchPostings({
      q: "bike",
      tags: ["outdoor", "sports"],
      page: 2,
      sort: "newest",
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain("/postings?");
    expect(String(requestUrl)).toContain("format=json");
    expect(String(requestUrl)).toContain("q=bike");
    expect(String(requestUrl)).toContain("page=2");
    expect(String(requestUrl)).toContain("sort=newest");
    expect(String(requestUrl)).toContain("tags=outdoor");
    expect(String(requestUrl)).toContain("tags=sports");
    expect(requestInit).toMatchObject({
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });
  });

  it("does not send auth or device headers on public requests by default", async () => {
    const fetchMock = createFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          postings: [],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          source: "database",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
      personalAccessToken:
        "rpat_1234567890abcdef123456_abcdef123456abcdef123456abcdef123456abcdef123456",
    });

    await client.searchPostings({});

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(requestInit?.headers).toMatchObject({
      accept: "application/json",
    });
    expect((requestInit?.headers as Record<string, string>).authorization).toBeUndefined();
    expect((requestInit?.headers as Record<string, string>)["x-device-id"]).toBeUndefined();
    expect((requestInit?.headers as Record<string, string>)["x-device-platform"]).toBeUndefined();
  });

  it("returns parsed JSON for each public marketplace endpoint", async () => {
    const fetchMock = createFetchMock()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "post_1", name: "Bike", status: "published" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ postings: [{ id: "post_1", name: "Bike" }], missingIds: ["x"] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
    });

    await expect(client.searchPostings({})).resolves.toMatchObject({
      source: "database",
      postings: [{ id: "post_1" }],
    });
    await expect(client.getPosting("post_1")).resolves.toMatchObject({
      id: "post_1",
      status: "published",
    });
    await expect(client.batchGetPostings(["post_1", "x"])).resolves.toMatchObject({
      postings: [{ id: "post_1" }],
      missingIds: ["x"],
    });
    await expect(client.listPostingReviews("post_1")).resolves.toMatchObject({
      reviews: [{ id: "review_1" }],
      summary: { reviewCount: 1 },
    });
  });

  it.each([
    [400, "BAD_REQUEST"],
    [404, "RESOURCE_NOT_FOUND"],
    [500, "INTERNAL_SERVER_ERROR"],
  ])("maps backend HTTP %i errors into BackendApiError", async (status, code) => {
    const fetchMock = createFetchMock().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: `HTTP ${status}`,
          code,
          details: {
            status,
          },
        }),
        {
          status,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
    });

    await expect(client.getPosting("missing")).rejects.toMatchObject<Partial<BackendApiError>>({
      name: "BackendApiError",
      status,
      code,
      details: {
        status,
      },
    });
  });

  it("maps aborts to a timeout error", async () => {
    const fetchMock = createFetchMock()
      .mockRejectedValue(new DOMException("This operation was aborted.", "AbortError"));
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
    });

    await expect(client.getPosting("post_1")).rejects.toMatchObject<
      Partial<BackendUnavailableError>
    >({
      name: "BackendUnavailableError",
      code: "BACKEND_TIMEOUT",
    });
  });

  it("maps network failures to a backend-unavailable error", async () => {
    const fetchMock = createFetchMock().mockRejectedValue(new Error("connect ECONNREFUSED"));
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
    });

    await expect(client.getPosting("post_1")).rejects.toMatchObject<
      Partial<BackendUnavailableError>
    >({
      name: "BackendUnavailableError",
      code: "BACKEND_UNAVAILABLE",
      details: "connect ECONNREFUSED",
    });
  });

  it("includes bearer auth on protected requests", async () => {
    const fetchMock = createFetchMock().mockResolvedValue(
      new Response(JSON.stringify({ id: "user_1", email: "hello@example.com" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
      personalAccessToken:
        "rpat_1234567890abcdef123456_abcdef123456abcdef123456abcdef123456abcdef123456",
    });

    await expect(client.getProtected("/profile/me")).resolves.toMatchObject({
      id: "user_1",
    });

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(requestInit?.headers).toMatchObject({
      accept: "application/json",
      authorization:
        "Bearer rpat_1234567890abcdef123456_abcdef123456abcdef123456abcdef123456abcdef123456",
    });
  });

  it("fails cleanly when a protected request is attempted without auth", async () => {
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: createFetchMock(),
    });

    await expect(client.getProtected("/profile/me")).rejects.toBeInstanceOf(
      AuthNotConfiguredError,
    );
  });

  it("maps 401s on protected requests into backend API errors when the PAT is rejected", async () => {
    const fetchMock = createFetchMock()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );
    const client = new RentifyApiClient({
      baseUrl: "http://127.0.0.1:8040",
      timeoutMs: 5_000,
      fetchImplementation: fetchMock,
      personalAccessToken:
        "rpat_1234567890abcdef123456_abcdef123456abcdef123456abcdef123456abcdef123456",
    });

    await expect(client.getProtected("/profile/me")).rejects.toMatchObject<Partial<BackendApiError>>({
      name: "BackendApiError",
      status: 401,
      code: "UNAUTHORIZED",
    });
  });
});
