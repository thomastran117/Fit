import {
  getOptionalEnvironmentVariable,
} from "@/configuration/environment/index";

export interface ElasticsearchConfig {
  enabled: boolean;
  url?: string;
  username?: string;
  password?: string;
  rentingsIndexName: string;
  timeoutMs: number;
}

export class ElasticsearchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElasticsearchUnavailableError";
  }
}

export class ElasticsearchClient {
  constructor(private readonly config: ElasticsearchConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.url);
  }

  getRentingsIndexName(): string {
    return this.config.rentingsIndexName;
  }

  async requestJson<TResponse>(
    path: string,
    init: RequestInit,
    options: {
      allowNotFound?: boolean;
    } = {},
  ): Promise<TResponse> {
    const config = this.requireConfig();
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");

    if (config.username && config.password) {
      headers.set(
        "authorization",
        `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
      );
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, config.timeoutMs);

    try {
      const response = await fetch(`${config.url}${path}`, {
        ...init,
        headers,
        signal: abortController.signal,
      });

      if (options.allowNotFound && response.status === 404) {
        return {} as TResponse;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new ElasticsearchUnavailableError(
          `Elasticsearch request failed with status ${response.status}: ${text.slice(0, 500)}`,
        );
      }

      if (response.status === 204) {
        return {} as TResponse;
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      if (error instanceof ElasticsearchUnavailableError) {
        throw error;
      }

      throw new ElasticsearchUnavailableError(
        error instanceof Error ? error.message : "Elasticsearch request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private requireConfig(): ElasticsearchConfig & { url: string } {
    if (!this.config.enabled || !this.config.url) {
      throw new ElasticsearchUnavailableError("Elasticsearch is not configured.");
    }

    return {
      ...this.config,
      url: this.config.url,
    };
  }
}

function readBoolean(name: string, fallback: boolean): boolean {
  const rawValue = getOptionalEnvironmentVariable(name);

  if (!rawValue) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(rawValue.trim().toLowerCase());
}

function readNumber(name: string, fallback: number): number {
  const rawValue = getOptionalEnvironmentVariable(name);

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsedValue;
}

function createElasticsearchClient(): ElasticsearchClient {
  return new ElasticsearchClient({
    enabled: readBoolean("ELASTICSEARCH_ENABLED", false),
    url: getOptionalEnvironmentVariable("ELASTICSEARCH_URL")?.replace(/\/+$/, ""),
    username: getOptionalEnvironmentVariable("ELASTICSEARCH_USERNAME"),
    password: getOptionalEnvironmentVariable("ELASTICSEARCH_PASSWORD"),
    rentingsIndexName: getOptionalEnvironmentVariable("ELASTICSEARCH_RENTINGS_INDEX") ?? "rentings",
    timeoutMs: readNumber("ELASTICSEARCH_TIMEOUT_MS", 2_000),
  });
}

let elasticsearch: ElasticsearchClient | null = null;

export let elasticsearchClient: ElasticsearchClient | null = null;

export async function connectElasticsearch(): Promise<ElasticsearchClient> {
  if (!elasticsearch) {
    elasticsearch = createElasticsearchClient();
    elasticsearchClient = elasticsearch;
  }

  return elasticsearch;
}

export function getElasticsearchClient(): ElasticsearchClient {
  if (!elasticsearch) {
    throw new Error("Elasticsearch has not been initialized. Call connectElasticsearch() first.");
  }

  return elasticsearch;
}

export async function disconnectElasticsearch(): Promise<void> {
  elasticsearch = null;
  elasticsearchClient = null;
}
