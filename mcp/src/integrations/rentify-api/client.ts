import type {
  BatchGetPostingsResponse,
  GetPostingResponse,
  ListPostingReviewsResponse,
  SearchPostingsResponse,
} from "./types.js";

type QueryScalar = string | number | boolean;
type QueryValue = QueryScalar | QueryScalar[] | null | undefined;
type QueryParams = Record<string, QueryValue>;

interface ErrorPayload {
  error?: string;
  code?: string;
  details?: unknown;
}

export interface RentifyApiClientOptions {
  baseUrl: string;
  timeoutMs: number;
  fetchImplementation?: typeof fetch;
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

  constructor(private readonly options: RentifyApiClientOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
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

  private async get<TResponse>(path: string, query?: QueryParams): Promise<TResponse> {
    const url = buildApiUrl(this.options.baseUrl, path, query);
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, this.options.timeoutMs);

    try {
      const response = await this.fetchImplementation(url, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        signal: abortController.signal,
      });
      const body = await parseResponseBody(response);

      if (!response.ok) {
        const payload = (body ?? {}) as ErrorPayload;
        throw new BackendApiError(
          response.status,
          payload.code ?? "BACKEND_ERROR",
          payload.details,
          payload.error ?? `Rentify backend returned HTTP ${response.status}.`,
        );
      }

      return body as TResponse;
    } catch (error) {
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
}
