import type {
  BatchGetPostingsResponse,
  GetPostingResponse,
  ListPostingReviewsResponse,
  SearchPostingsResponse,
} from "./types.js";

type QueryScalar = string | number | boolean;
type QueryValue = QueryScalar | QueryScalar[] | null | undefined;
type QueryParams = Record<string, QueryValue>;
type JsonObject = Record<string, unknown>;

interface RequestOptions {
  requiresAuth?: boolean;
}

interface ErrorPayload {
  error?: string;
  code?: string;
  details?: unknown;
}

export interface RentifyApiClientOptions {
  baseUrl: string;
  timeoutMs: number;
  fetchImplementation?: typeof fetch;
  personalAccessToken?: string;
}

export interface SearchPostingsQuery extends QueryParams {
  page?: number;
  pageSize?: number;
  q?: string;
  family?: string;
  subtype?: string;
  tags?: string[];
  availabilityStatus?: "available" | "limited" | "unavailable";
  minDailyPrice?: number;
  maxDailyPrice?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  startAt?: string;
  endAt?: string;
  sort?: "relevance" | "newest" | "oldest" | "dailyPrice" | "nearest" | "nameAsc" | "nameDesc";
}

export class BackendApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: unknown,
    message: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export class BackendUnavailableError extends Error {
  constructor(
    readonly code: "BACKEND_TIMEOUT" | "BACKEND_UNAVAILABLE",
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

export class AuthNotConfiguredError extends Error {
  readonly code = "AUTH_NOT_CONFIGURED";

  constructor(message = "Protected Rentify MCP requests require RENTIFY_PAT.") {
    super(message);
    this.name = "AuthNotConfiguredError";
  }
}

function appendQueryValue(searchParams: URLSearchParams, key: string, value: QueryValue): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      searchParams.append(key, String(entry));
    }
    return;
  }

  searchParams.set(key, String(value));
}

export function buildApiUrl(baseUrl: string, path: string, query: QueryParams = {}): URL {
  const url = new URL(path, baseUrl);
  url.searchParams.set("format", "json");

  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(url.searchParams, key, value);
  }

  return url;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class RentifyApiClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly personalAccessToken?: string;

  constructor(private readonly options: RentifyApiClientOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.personalAccessToken = options.personalAccessToken;
  }

  async searchPostings(query: SearchPostingsQuery): Promise<SearchPostingsResponse> {
    return this.get<SearchPostingsResponse>("/postings", query);
  }

  async getPosting(id: string): Promise<GetPostingResponse> {
    return this.get<GetPostingResponse>(`/postings/${encodeURIComponent(id)}`);
  }

  async batchGetPostings(ids: string[]): Promise<BatchGetPostingsResponse> {
    return this.get<BatchGetPostingsResponse>("/postings/batch", {
      ids,
    });
  }

  async listPostingReviews(
    postingId: string,
    query: { page?: number; pageSize?: number } = {},
  ): Promise<ListPostingReviewsResponse> {
    return this.get<ListPostingReviewsResponse>(
      `/postings/${encodeURIComponent(postingId)}/reviews`,
      query,
    );
  }

  async getProtected<TResponse>(path: string, query?: QueryParams): Promise<TResponse> {
    return this.get<TResponse>(path, query, {
      requiresAuth: true,
    });
  }

  private async get<TResponse>(
    path: string,
    query?: QueryParams,
    requestOptions: RequestOptions = {},
  ): Promise<TResponse> {
    return this.request<TResponse>({
      method: "GET",
      path,
      query,
      requestOptions,
    });
  }

  private async request<TResponse>({
    method,
    path,
    query,
    body: requestBody,
    requestOptions = {},
  }: {
    method: "GET" | "POST";
    path: string;
    query?: QueryParams;
    body?: JsonObject;
    requestOptions?: RequestOptions;
  }): Promise<TResponse> {
    return this.executeRequest<TResponse>({
      method,
      path,
      query,
      body: requestBody,
      requestOptions,
    });
  }

  private async executeRequest<TResponse>({
    method,
    path,
    query,
    body,
    requestOptions,
  }: {
    method: "GET" | "POST";
    path: string;
    query?: QueryParams;
    body?: JsonObject;
    requestOptions: RequestOptions;
  }): Promise<TResponse> {
    const url = buildApiUrl(this.options.baseUrl, path, query);
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, this.options.timeoutMs);

    try {
      const headers = this.createHeaders(requestOptions.requiresAuth ?? false, body);
      const response = await this.fetchImplementation(url, {
        method,
        headers,
        signal: abortController.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const parsedBody = await parseResponseBody(response);

      if (!response.ok) {
        const payload = (parsedBody ?? {}) as ErrorPayload;

        throw new BackendApiError(
          response.status,
          payload.code ?? "BACKEND_ERROR",
          payload.details,
          payload.error ?? `Rentify backend returned HTTP ${response.status}.`,
        );
      }

      return parsedBody as TResponse;
    } catch (error) {
      if (error instanceof AuthNotConfiguredError) {
        throw error;
      }

      if (error instanceof BackendApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new BackendUnavailableError(
          "BACKEND_TIMEOUT",
          `Timed out after ${this.options.timeoutMs}ms while calling the Rentify backend.`,
        );
      }

      throw new BackendUnavailableError(
        "BACKEND_UNAVAILABLE",
        "Could not reach the Rentify backend API.",
        error instanceof Error ? error.message : error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private createHeaders(
    requiresAuth: boolean,
    body?: JsonObject,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    if (body) {
      headers["content-type"] = "application/json";
    }

    if (!requiresAuth) {
      return headers;
    }

    const accessToken = this.personalAccessToken;

    if (!accessToken) {
      throw new AuthNotConfiguredError();
    }

    headers.authorization = `Bearer ${accessToken}`;
    return headers;
  }
}
