import { config } from "dotenv";
import { fileURLToPath } from "node:url";

const envFilePath = fileURLToPath(new URL("../../../../.env", import.meta.url));

type NodeEnvironment = "development" | "test" | "production";
type RefreshTokenMode = "stateless" | "stateful";
type RateLimiterStrategy = "sliding-window" | "token-bucket";

type RawEnvironmentValues = {
  ACCESS_TOKEN_SECRET?: string;
  ACCESS_TOKEN_TTL_SECONDS?: string;
  APP_BASE_URL?: string;
  AZURE_STORAGE_CONNECTION_STRING?: string;
  AZURE_STORAGE_CONTAINER_NAME?: string;
  AZURE_STORAGE_UPLOAD_SAS_TTL_SECONDS?: string;
  BOOKING_REQUEST_EXPIRY_BATCH_SIZE?: string;
  BOOKING_REQUEST_EXPIRY_POLL_INTERVAL_MS?: string;
  CAPTCHA_ALLOWED_HOSTS?: string;
  CLOUDFLARE_TURNSTILE_SECRET_KEY?: string;
  CORS_ALLOWED_ORIGINS?: string;
  CSRF_ALLOWED_ORIGINS?: string;
  DATABASE_OPERATION_LOGGING_ENABLED?: string;
  DATABASE_QUERY_LOGGING_ENABLED?: string;
  DATABASE_AUTO_SEED_ENABLED?: string;
  DATABASE_AUTO_SEED_REFRESH?: string;
  DATABASE_SLOW_OPERATION_THRESHOLD_MS?: string;
  DATABASE_SLOW_QUERY_THRESHOLD_MS?: string;
  DATABASE_URL?: string;
  ELASTICSEARCH_ENABLED?: string;
  ELASTICSEARCH_CIRCUIT_BREAKER_COOLDOWN_MS?: string;
  ELASTICSEARCH_CIRCUIT_BREAKER_FAILURE_THRESHOLD?: string;
  ELASTICSEARCH_PASSWORD?: string;
  ELASTICSEARCH_POSTINGS_INDEX?: string;
  ELASTICSEARCH_TIMEOUT_MS?: string;
  ELASTICSEARCH_URL?: string;
  ELASTICSEARCH_USERNAME?: string;
  EMAIL_WORKER_PREFETCH?: string;
  EMAIL_MAX_ATTEMPTS?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  FRONTEND_URL?: string;
  GMAIL_APP_PASSWORD?: string;
  GMAIL_USER?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_IDS?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  MICROSOFT_OAUTH_CLIENT_ID?: string;
  MICROSOFT_OAUTH_CLIENT_IDS?: string;
  MICROSOFT_OAUTH_CLIENT_SECRET?: string;
  MICROSOFT_OAUTH_TENANT?: string;
  NODE_ENV?: string;
  PORT?: string;
  POSTINGS_ANALYTICS_OUTBOX_BATCH_SIZE?: string;
  POSTINGS_ANALYTICS_OUTBOX_POLL_INTERVAL_MS?: string;
  POSTINGS_THUMBNAIL_BATCH_SIZE?: string;
  POSTINGS_THUMBNAIL_MAX_ATTEMPTS?: string;
  POSTINGS_THUMBNAIL_POLL_INTERVAL_MS?: string;
  POSTINGS_SEARCH_OUTBOX_BATCH_SIZE?: string;
  POSTINGS_SEARCH_OUTBOX_POLL_INTERVAL_MS?: string;
  POSTINGS_SEARCH_INDEXER_PREFETCH?: string;
  POSTINGS_SEARCH_INDEXER_BATCH_SIZE?: string;
  POSTINGS_SEARCH_INDEXER_FLUSH_INTERVAL_MS?: string;
  POSTINGS_SEARCH_INDEXER_CONCURRENCY?: string;
  POSTINGS_SEARCH_INDEX_MAX_ATTEMPTS?: string;
  POSTINGS_SEARCH_RECONCILE_BATCH_SIZE?: string;
  POSTINGS_SEARCH_RECONCILE_POLL_INTERVAL_MS?: string;
  POSTINGS_SEARCH_REINDEX_BATCH_SIZE?: string;
  POSTINGS_SEARCH_REINDEX_POLL_INTERVAL_MS?: string;
  POSTINGS_SEARCH_RELAY_BATCH_SIZE?: string;
  POSTINGS_SEARCH_RELAY_MAX_ATTEMPTS?: string;
  POSTINGS_SEARCH_RELAY_POLL_INTERVAL_MS?: string;
  PAYMENTS_RETRY_BATCH_SIZE?: string;
  PAYMENTS_RETRY_POLL_INTERVAL_MS?: string;
  PAYMENTS_REPAIR_BATCH_SIZE?: string;
  PAYMENTS_REPAIR_POLL_INTERVAL_MS?: string;
  PAYOUT_RELEASE_BATCH_SIZE?: string;
  PAYOUT_RELEASE_POLL_INTERVAL_MS?: string;
  RABBITMQ_URL?: string;
  RATE_LIMITER_BUCKET_CAPACITY?: string;
  RATE_LIMITER_ENABLED?: string;
  RATE_LIMITER_LIMIT?: string;
  RATE_LIMITER_REFILL_TOKENS_PER_SECOND?: string;
  RATE_LIMITER_STRATEGY?: string;
  RATE_LIMITER_WINDOW_SECONDS?: string;
  REDIS_CONNECT_TIMEOUT_MS?: string;
  REDIS_DB?: string;
  REDIS_HOST?: string;
  REDIS_PASSWORD?: string;
  REDIS_PORT?: string;
  REDIS_URL?: string;
  REFRESH_TOKEN_CACHE_PREFIX?: string;
  REFRESH_TOKEN_MODE?: string;
  REFRESH_TOKEN_SECRET?: string;
  PERSONAL_ACCESS_TOKEN_SECRET?: string;
  REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS?: string;
  REFRESH_TOKEN_TTL_SECONDS?: string;
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_ENVIRONMENT?: string;
  SQUARE_LOCATION_ID?: string;
  SQUARE_WEBHOOK_NOTIFICATION_URL?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
  TOKEN_AUDIENCE?: string;
  TOKEN_ISSUER?: string;
  TRUST_PROXY_HEADERS?: string;
};

type EnvironmentVariableName = keyof RawEnvironmentValues;

export interface AppEnvironment {
  raw: RawEnvironmentValues;
  server: {
    nodeEnv: NodeEnvironment;
    port: number;
    isProduction: boolean;
  };
  database: {
    url: string;
    autoSeedEnabled: boolean;
    autoSeedRefresh: boolean;
    operationLoggingEnabled: boolean;
    queryLoggingEnabled: boolean;
    slowOperationThresholdMs: number;
    slowQueryThresholdMs: number;
  };
  auth: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    rememberMeRefreshTokenTtlSeconds: number;
    issuer?: string;
    audience?: string;
    refreshTokenMode: RefreshTokenMode;
    refreshTokenCachePrefix: string;
    personalAccessTokenSecret: string;
  };
  email: {
    gmailUser: string;
    gmailAppPassword: string;
    fromEmail: string;
    fromName: string;
    appBaseUrl: string;
  };
  captcha: {
    secretKey?: string;
    allowedHosts: string[];
  };
  cors: {
    allowedOrigins: string[];
  };
  csrf: {
    allowedOrigins: string[];
  };
  oauth: {
    google: {
      audiences: string[];
      clientSecret?: string;
      frontendBaseUrl: string;
    };
    microsoft: {
      audiences: string[];
      clientSecret?: string;
      tenant: string;
      frontendBaseUrl: string;
    };
  };
  redis: {
    url: string;
    host: string;
    port: number;
    password?: string;
    db: number;
    connectTimeoutMs: number;
  };
  rateLimiter: {
    enabled: boolean;
    strategy: RateLimiterStrategy;
    limit: number;
    windowSeconds: number;
    bucketCapacity: number;
    refillTokensPerSecond: number;
  };
  workers: {
    search: {
      pollIntervalMs: number;
      batchSize: number;
    };
    searchRelay: {
      pollIntervalMs: number;
      batchSize: number;
      maxAttempts: number;
    };
    searchIndexer: {
      prefetch: number;
      batchSize: number;
      flushIntervalMs: number;
      concurrency: number;
      maxAttempts: number;
    };
    searchReconcile: {
      pollIntervalMs: number;
      batchSize: number;
    };
    searchReindex: {
      pollIntervalMs: number;
      batchSize: number;
    };
    email: {
      prefetch: number;
      maxAttempts: number;
    };
    analytics: {
      pollIntervalMs: number;
      batchSize: number;
    };
    postingsThumbnail: {
      pollIntervalMs: number;
      batchSize: number;
      maxAttempts: number;
    };
    bookingExpiry: {
      pollIntervalMs: number;
      batchSize: number;
    };
    paymentsRetry: {
      pollIntervalMs: number;
      batchSize: number;
    };
    paymentsRepair: {
      pollIntervalMs: number;
      batchSize: number;
    };
    payoutRelease: {
      pollIntervalMs: number;
      batchSize: number;
    };
  };
  blobStorage: {
    connectionString?: string;
    containerName?: string;
    uploadSasTtlSeconds: number;
  };
  rabbitmq: {
    url?: string;
  };
  elasticsearch: {
    enabled: boolean;
    url?: string;
    username?: string;
    password?: string;
    postingsIndexName: string;
    timeoutMs: number;
    circuitBreakerFailureThreshold: number;
    circuitBreakerCooldownMs: number;
  };
  square: {
    accessToken: string;
    environment: "sandbox" | "production";
    locationId: string;
    webhookSignatureKey: string;
    webhookNotificationUrl: string;
    apiBaseUrl: string;
  };
}

type EnvironmentState = {
  raw: RawEnvironmentValues;
  config: AppEnvironment;
};

const RAW_ENVIRONMENT_VARIABLE_NAMES: EnvironmentVariableName[] = [
  "ACCESS_TOKEN_SECRET",
  "ACCESS_TOKEN_TTL_SECONDS",
  "APP_BASE_URL",
  "AZURE_STORAGE_CONNECTION_STRING",
  "AZURE_STORAGE_CONTAINER_NAME",
  "AZURE_STORAGE_UPLOAD_SAS_TTL_SECONDS",
  "BOOKING_REQUEST_EXPIRY_BATCH_SIZE",
  "BOOKING_REQUEST_EXPIRY_POLL_INTERVAL_MS",
  "CAPTCHA_ALLOWED_HOSTS",
  "CLOUDFLARE_TURNSTILE_SECRET_KEY",
  "CORS_ALLOWED_ORIGINS",
  "CSRF_ALLOWED_ORIGINS",
  "DATABASE_OPERATION_LOGGING_ENABLED",
  "DATABASE_QUERY_LOGGING_ENABLED",
  "DATABASE_AUTO_SEED_ENABLED",
  "DATABASE_AUTO_SEED_REFRESH",
  "DATABASE_SLOW_OPERATION_THRESHOLD_MS",
  "DATABASE_SLOW_QUERY_THRESHOLD_MS",
  "DATABASE_URL",
  "ELASTICSEARCH_ENABLED",
  "ELASTICSEARCH_CIRCUIT_BREAKER_COOLDOWN_MS",
  "ELASTICSEARCH_CIRCUIT_BREAKER_FAILURE_THRESHOLD",
  "ELASTICSEARCH_PASSWORD",
  "ELASTICSEARCH_POSTINGS_INDEX",
  "ELASTICSEARCH_TIMEOUT_MS",
  "ELASTICSEARCH_URL",
  "ELASTICSEARCH_USERNAME",
  "EMAIL_WORKER_PREFETCH",
  "EMAIL_MAX_ATTEMPTS",
  "EMAIL_FROM",
  "EMAIL_FROM_NAME",
  "FRONTEND_URL",
  "GMAIL_APP_PASSWORD",
  "GMAIL_USER",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_IDS",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "MICROSOFT_OAUTH_CLIENT_ID",
  "MICROSOFT_OAUTH_CLIENT_IDS",
  "MICROSOFT_OAUTH_CLIENT_SECRET",
  "MICROSOFT_OAUTH_TENANT",
  "NODE_ENV",
  "PORT",
  "POSTINGS_ANALYTICS_OUTBOX_BATCH_SIZE",
  "POSTINGS_ANALYTICS_OUTBOX_POLL_INTERVAL_MS",
  "POSTINGS_THUMBNAIL_BATCH_SIZE",
  "POSTINGS_THUMBNAIL_MAX_ATTEMPTS",
  "POSTINGS_THUMBNAIL_POLL_INTERVAL_MS",
  "POSTINGS_SEARCH_INDEXER_PREFETCH",
  "POSTINGS_SEARCH_INDEXER_BATCH_SIZE",
  "POSTINGS_SEARCH_INDEXER_FLUSH_INTERVAL_MS",
  "POSTINGS_SEARCH_INDEXER_CONCURRENCY",
  "POSTINGS_SEARCH_INDEX_MAX_ATTEMPTS",
  "POSTINGS_SEARCH_RECONCILE_BATCH_SIZE",
  "POSTINGS_SEARCH_RECONCILE_POLL_INTERVAL_MS",
  "POSTINGS_SEARCH_REINDEX_BATCH_SIZE",
  "POSTINGS_SEARCH_REINDEX_POLL_INTERVAL_MS",
  "POSTINGS_SEARCH_RELAY_BATCH_SIZE",
  "POSTINGS_SEARCH_RELAY_MAX_ATTEMPTS",
  "POSTINGS_SEARCH_RELAY_POLL_INTERVAL_MS",
  "POSTINGS_SEARCH_OUTBOX_BATCH_SIZE",
  "POSTINGS_SEARCH_OUTBOX_POLL_INTERVAL_MS",
  "PAYMENTS_REPAIR_BATCH_SIZE",
  "PAYMENTS_REPAIR_POLL_INTERVAL_MS",
  "PAYMENTS_RETRY_BATCH_SIZE",
  "PAYMENTS_RETRY_POLL_INTERVAL_MS",
  "PAYOUT_RELEASE_BATCH_SIZE",
  "PAYOUT_RELEASE_POLL_INTERVAL_MS",
  "RABBITMQ_URL",
  "RATE_LIMITER_BUCKET_CAPACITY",
  "RATE_LIMITER_ENABLED",
  "RATE_LIMITER_LIMIT",
  "RATE_LIMITER_REFILL_TOKENS_PER_SECOND",
  "RATE_LIMITER_STRATEGY",
  "RATE_LIMITER_WINDOW_SECONDS",
  "REDIS_CONNECT_TIMEOUT_MS",
  "REDIS_DB",
  "REDIS_HOST",
  "REDIS_PASSWORD",
  "REDIS_PORT",
  "REDIS_URL",
  "REFRESH_TOKEN_CACHE_PREFIX",
  "REFRESH_TOKEN_MODE",
  "REFRESH_TOKEN_SECRET",
  "PERSONAL_ACCESS_TOKEN_SECRET",
  "REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS",
  "REFRESH_TOKEN_TTL_SECONDS",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_ENVIRONMENT",
  "SQUARE_LOCATION_ID",
  "SQUARE_WEBHOOK_NOTIFICATION_URL",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "TOKEN_AUDIENCE",
  "TOKEN_ISSUER",
  "TRUST_PROXY_HEADERS",
];

const DEFAULT_FRONTEND_URL = "http://localhost:3040";
const DEFAULT_EMAIL_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_CAPTCHA_ALLOWED_HOST = "challenges.cloudflare.com";
const DEFAULT_REDIS_HOST = "127.0.0.1";
const DEFAULT_REFRESH_TOKEN_CACHE_PREFIX = "auth:refresh";
const DEFAULT_ELASTICSEARCH_POSTINGS_INDEX = "postings";

function normalizeRawEnvironment(source: NodeJS.ProcessEnv): RawEnvironmentValues {
  const raw: RawEnvironmentValues = {};

  for (const name of RAW_ENVIRONMENT_VARIABLE_NAMES) {
    const value = normalizeOptionalString(source[name]);

    if (value !== undefined) {
      raw[name] = value;
    }
  }

  return raw;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeDelimitedList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseNodeEnvironment(
  raw: RawEnvironmentValues,
  errors: string[],
): NodeEnvironment {
  const value = raw.NODE_ENV ?? "development";

  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  errors.push("NODE_ENV must be one of: development, test, production.");
  return "development";
}

function parseRefreshTokenMode(
  raw: RawEnvironmentValues,
  errors: string[],
): RefreshTokenMode {
  const value = raw.REFRESH_TOKEN_MODE ?? "stateful";

  if (value === "stateless" || value === "stateful") {
    return value;
  }

  errors.push("REFRESH_TOKEN_MODE must be either 'stateless' or 'stateful'.");
  return "stateful";
}

function parseRateLimiterStrategy(
  raw: RawEnvironmentValues,
  errors: string[],
): RateLimiterStrategy {
  const value = raw.RATE_LIMITER_STRATEGY?.toLowerCase() ?? "sliding-window";

  if (value === "sliding-window" || value === "token-bucket") {
    return value;
  }

  errors.push("RATE_LIMITER_STRATEGY must be either 'sliding-window' or 'token-bucket'.");
  return "sliding-window";
}

type NumberOptions = {
  integer?: boolean;
  max?: number;
  min?: number;
};

const MINIMUM_TOKEN_SECRET_LENGTH = 32;

function parseNumber(
  raw: RawEnvironmentValues,
  name: EnvironmentVariableName,
  fallback: number,
  errors: string[],
  options: NumberOptions = {},
): number {
  const value = raw[name];

  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    errors.push(`${name} must be a valid number.`);
    return fallback;
  }

  if (options.integer && !Number.isInteger(parsedValue)) {
    errors.push(`${name} must be an integer.`);
    return fallback;
  }

  if (options.min !== undefined && parsedValue < options.min) {
    errors.push(`${name} must be greater than or equal to ${options.min}.`);
    return fallback;
  }

  if (options.max !== undefined && parsedValue > options.max) {
    errors.push(`${name} must be less than or equal to ${options.max}.`);
    return fallback;
  }

  return parsedValue;
}

function readRequiredString(
  raw: RawEnvironmentValues,
  name: EnvironmentVariableName,
  errors: string[],
): string {
  const value = raw[name];

  if (!value) {
    errors.push(`${name} is required.`);
    return "";
  }

  return value;
}

function readRequiredSecret(
  raw: RawEnvironmentValues,
  name: EnvironmentVariableName,
  errors: string[],
): string {
  const value = readRequiredString(raw, name, errors);

  if (value && value.length < MINIMUM_TOKEN_SECRET_LENGTH) {
    errors.push(
      `${name} must be at least ${MINIMUM_TOKEN_SECRET_LENGTH} characters long.`,
    );
  }

  return value;
}

function parseEnvironmentState(source: NodeJS.ProcessEnv): EnvironmentState {
  const raw = normalizeRawEnvironment(source);
  const errors: string[] = [];
  const nodeEnv = parseNodeEnvironment(raw, errors);
  const refreshTokenMode = parseRefreshTokenMode(raw, errors);
  const rateLimiterStrategy = parseRateLimiterStrategy(raw, errors);

  const databaseUrl = readRequiredString(raw, "DATABASE_URL", errors);
  const accessTokenSecret = readRequiredSecret(raw, "ACCESS_TOKEN_SECRET", errors);
  const refreshTokenSecret = readRequiredSecret(raw, "REFRESH_TOKEN_SECRET", errors);
  const personalAccessTokenSecret = readRequiredSecret(
    raw,
    "PERSONAL_ACCESS_TOKEN_SECRET",
    errors,
  );
  const gmailUser = readRequiredString(raw, "GMAIL_USER", errors);
  const gmailAppPassword = readRequiredString(raw, "GMAIL_APP_PASSWORD", errors);
  const squareAccessToken = readRequiredString(raw, "SQUARE_ACCESS_TOKEN", errors);
  const squareLocationId = readRequiredString(raw, "SQUARE_LOCATION_ID", errors);
  const squareWebhookSignatureKey = readRequiredString(raw, "SQUARE_WEBHOOK_SIGNATURE_KEY", errors);
  const squareWebhookNotificationUrl = readRequiredString(
    raw,
    "SQUARE_WEBHOOK_NOTIFICATION_URL",
    errors,
  );
  const squareEnvironment = raw.SQUARE_ENVIRONMENT?.toLowerCase() ?? "sandbox";

  if (squareEnvironment !== "sandbox" && squareEnvironment !== "production") {
    errors.push("SQUARE_ENVIRONMENT must be either sandbox or production.");
  }

  const frontendBaseUrl = normalizeBaseUrl(
    raw.FRONTEND_URL ?? raw.APP_BASE_URL ?? DEFAULT_FRONTEND_URL,
  );
  const emailAppBaseUrl = normalizeBaseUrl(
    raw.APP_BASE_URL ?? raw.FRONTEND_URL ?? DEFAULT_EMAIL_APP_BASE_URL,
  );
  const corsAllowedOrigins =
    normalizeDelimitedList(raw.CORS_ALLOWED_ORIGINS ?? raw.FRONTEND_URL) || [];
  const csrfAllowedOrigins =
    normalizeDelimitedList(
      raw.CSRF_ALLOWED_ORIGINS ?? raw.CORS_ALLOWED_ORIGINS ?? raw.FRONTEND_URL,
    ) || [];
  const googleAudiences = normalizeDelimitedList(
    raw.GOOGLE_OAUTH_CLIENT_IDS ?? raw.GOOGLE_OAUTH_CLIENT_ID,
  );
  const microsoftAudiences = normalizeDelimitedList(
    raw.MICROSOFT_OAUTH_CLIENT_IDS ?? raw.MICROSOFT_OAUTH_CLIENT_ID,
  );

  if (raw.GOOGLE_OAUTH_CLIENT_SECRET && googleAudiences.length === 0) {
    errors.push(
      "GOOGLE_OAUTH_CLIENT_SECRET requires GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_IDS.",
    );
  }

  if (raw.MICROSOFT_OAUTH_CLIENT_SECRET && microsoftAudiences.length === 0) {
    errors.push(
      "MICROSOFT_OAUTH_CLIENT_SECRET requires MICROSOFT_OAUTH_CLIENT_ID or MICROSOFT_OAUTH_CLIENT_IDS.",
    );
  }

  const elasticsearchEnabled = parseBoolean(raw.ELASTICSEARCH_ENABLED, false);
  if (elasticsearchEnabled && !raw.ELASTICSEARCH_URL) {
    errors.push("ELASTICSEARCH_URL is required when ELASTICSEARCH_ENABLED is true.");
  }

  const hasBlobConnectionString = Boolean(raw.AZURE_STORAGE_CONNECTION_STRING);
  const hasBlobContainerName = Boolean(raw.AZURE_STORAGE_CONTAINER_NAME);

  if (hasBlobConnectionString !== hasBlobContainerName) {
    errors.push(
      "AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER_NAME must be configured together.",
    );
  }

  const rateLimiterLimit = parseNumber(raw, "RATE_LIMITER_LIMIT", 60, errors, {
    integer: true,
    min: 1,
  });
  const databaseAutoSeedEnabled = parseBoolean(
    raw.DATABASE_AUTO_SEED_ENABLED,
    nodeEnv !== "production",
  );
  const databaseAutoSeedRefresh = parseBoolean(raw.DATABASE_AUTO_SEED_REFRESH, false);
  const rateLimiterWindowSeconds = parseNumber(
    raw,
    "RATE_LIMITER_WINDOW_SECONDS",
    60,
    errors,
    {
      integer: true,
      min: 1,
    },
  );
  const rateLimiterBucketCapacity = parseNumber(
    raw,
    "RATE_LIMITER_BUCKET_CAPACITY",
    rateLimiterLimit,
    errors,
    {
      integer: true,
      min: 1,
    },
  );
  const configuredRefillRate =
    raw.RATE_LIMITER_REFILL_TOKENS_PER_SECOND === undefined
      ? undefined
      : parseNumber(raw, "RATE_LIMITER_REFILL_TOKENS_PER_SECOND", 1, errors, {
          min: 0.000_001,
        });

  const config: AppEnvironment = {
    raw,
    server: {
      nodeEnv,
      port: parseNumber(raw, "PORT", 8040, errors, {
        integer: true,
        min: 1,
      }),
      isProduction: nodeEnv === "production",
    },
    database: {
      url: databaseUrl,
      autoSeedEnabled: databaseAutoSeedEnabled,
      autoSeedRefresh: databaseAutoSeedRefresh,
      operationLoggingEnabled: parseBoolean(raw.DATABASE_OPERATION_LOGGING_ENABLED, false),
      queryLoggingEnabled: parseBoolean(raw.DATABASE_QUERY_LOGGING_ENABLED, false),
      slowOperationThresholdMs: parseNumber(
        raw,
        "DATABASE_SLOW_OPERATION_THRESHOLD_MS",
        nodeEnv === "production" ? 1_000 : 500,
        errors,
        {
          integer: true,
          min: 0,
        },
      ),
      slowQueryThresholdMs: parseNumber(
        raw,
        "DATABASE_SLOW_QUERY_THRESHOLD_MS",
        nodeEnv === "production" ? 750 : 250,
        errors,
        {
          integer: true,
          min: 0,
        },
      ),
    },
    auth: {
      accessTokenSecret,
      refreshTokenSecret,
      accessTokenTtlSeconds: parseNumber(raw, "ACCESS_TOKEN_TTL_SECONDS", 15 * 60, errors, {
        integer: true,
        min: 1,
      }),
      refreshTokenTtlSeconds: parseNumber(
        raw,
        "REFRESH_TOKEN_TTL_SECONDS",
        30 * 24 * 60 * 60,
        errors,
        {
          integer: true,
          min: 1,
        },
      ),
      rememberMeRefreshTokenTtlSeconds: parseNumber(
        raw,
        "REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS",
        90 * 24 * 60 * 60,
        errors,
        {
          integer: true,
          min: 1,
        },
      ),
      issuer: raw.TOKEN_ISSUER,
      audience: raw.TOKEN_AUDIENCE,
      refreshTokenMode,
      refreshTokenCachePrefix:
        raw.REFRESH_TOKEN_CACHE_PREFIX ?? DEFAULT_REFRESH_TOKEN_CACHE_PREFIX,
      personalAccessTokenSecret,
    },
    email: {
      gmailUser,
      gmailAppPassword,
      fromEmail: raw.EMAIL_FROM ?? gmailUser,
      fromName: raw.EMAIL_FROM_NAME ?? "Rent",
      appBaseUrl: emailAppBaseUrl,
    },
    captcha: {
      secretKey: raw.CLOUDFLARE_TURNSTILE_SECRET_KEY,
      allowedHosts: normalizeDelimitedList(raw.CAPTCHA_ALLOWED_HOSTS).length
        ? normalizeDelimitedList(raw.CAPTCHA_ALLOWED_HOSTS)
        : [DEFAULT_CAPTCHA_ALLOWED_HOST],
    },
    cors: {
      allowedOrigins: corsAllowedOrigins.length ? corsAllowedOrigins : [DEFAULT_FRONTEND_URL],
    },
    csrf: {
      allowedOrigins: csrfAllowedOrigins.length ? csrfAllowedOrigins : [DEFAULT_FRONTEND_URL],
    },
    oauth: {
      google: {
        audiences: googleAudiences,
        clientSecret: raw.GOOGLE_OAUTH_CLIENT_SECRET,
        frontendBaseUrl,
      },
      microsoft: {
        audiences: microsoftAudiences,
        clientSecret: raw.MICROSOFT_OAUTH_CLIENT_SECRET,
        tenant: raw.MICROSOFT_OAUTH_TENANT ?? "consumers",
        frontendBaseUrl,
      },
    },
    redis: {
      url: raw.REDIS_URL ?? "",
      host: raw.REDIS_HOST ?? DEFAULT_REDIS_HOST,
      port: parseNumber(raw, "REDIS_PORT", 6379, errors, {
        integer: true,
        min: 1,
      }),
      password: raw.REDIS_PASSWORD,
      db: parseNumber(raw, "REDIS_DB", 0, errors, {
        integer: true,
        min: 0,
      }),
      connectTimeoutMs: parseNumber(raw, "REDIS_CONNECT_TIMEOUT_MS", 10_000, errors, {
        integer: true,
        min: 1,
      }),
    },
    rateLimiter: {
      enabled: parseBoolean(raw.RATE_LIMITER_ENABLED, true),
      strategy: rateLimiterStrategy,
      limit: rateLimiterLimit,
      windowSeconds: rateLimiterWindowSeconds,
      bucketCapacity: rateLimiterBucketCapacity,
      refillTokensPerSecond:
        configuredRefillRate ?? rateLimiterBucketCapacity / rateLimiterWindowSeconds,
    },
    workers: {
      search: {
        pollIntervalMs: parseNumber(
          raw,
          "POSTINGS_SEARCH_OUTBOX_POLL_INTERVAL_MS",
          2_000,
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        batchSize: parseNumber(raw, "POSTINGS_SEARCH_OUTBOX_BATCH_SIZE", 25, errors, {
          integer: true,
          min: 1,
        }),
      },
      searchRelay: {
        pollIntervalMs: parseNumber(
          raw,
          "POSTINGS_SEARCH_RELAY_POLL_INTERVAL_MS",
          parseNumber(raw, "POSTINGS_SEARCH_OUTBOX_POLL_INTERVAL_MS", 2_000, errors, {
            integer: true,
            min: 1,
          }),
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        batchSize: parseNumber(
          raw,
          "POSTINGS_SEARCH_RELAY_BATCH_SIZE",
          parseNumber(raw, "POSTINGS_SEARCH_OUTBOX_BATCH_SIZE", 25, errors, {
            integer: true,
            min: 1,
          }),
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        maxAttempts: parseNumber(raw, "POSTINGS_SEARCH_RELAY_MAX_ATTEMPTS", 8, errors, {
          integer: true,
          min: 1,
        }),
      },
      searchIndexer: {
        prefetch: parseNumber(raw, "POSTINGS_SEARCH_INDEXER_PREFETCH", 25, errors, {
          integer: true,
          min: 1,
        }),
        batchSize: parseNumber(raw, "POSTINGS_SEARCH_INDEXER_BATCH_SIZE", 25, errors, {
          integer: true,
          min: 1,
        }),
        flushIntervalMs: parseNumber(
          raw,
          "POSTINGS_SEARCH_INDEXER_FLUSH_INTERVAL_MS",
          250,
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        concurrency: parseNumber(raw, "POSTINGS_SEARCH_INDEXER_CONCURRENCY", 2, errors, {
          integer: true,
          min: 1,
        }),
        maxAttempts: parseNumber(raw, "POSTINGS_SEARCH_INDEX_MAX_ATTEMPTS", 8, errors, {
          integer: true,
          min: 1,
        }),
      },
      searchReconcile: {
        pollIntervalMs: parseNumber(
          raw,
          "POSTINGS_SEARCH_RECONCILE_POLL_INTERVAL_MS",
          60_000,
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        batchSize: parseNumber(raw, "POSTINGS_SEARCH_RECONCILE_BATCH_SIZE", 50, errors, {
          integer: true,
          min: 1,
        }),
      },
      searchReindex: {
        pollIntervalMs: parseNumber(
          raw,
          "POSTINGS_SEARCH_REINDEX_POLL_INTERVAL_MS",
          5_000,
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        batchSize: parseNumber(raw, "POSTINGS_SEARCH_REINDEX_BATCH_SIZE", 250, errors, {
          integer: true,
          min: 1,
        }),
      },
      email: {
        prefetch: parseNumber(raw, "EMAIL_WORKER_PREFETCH", 10, errors, {
          integer: true,
          min: 1,
        }),
        maxAttempts: parseNumber(raw, "EMAIL_MAX_ATTEMPTS", 8, errors, {
          integer: true,
          min: 1,
        }),
      },
      analytics: {
        pollIntervalMs: parseNumber(
          raw,
          "POSTINGS_ANALYTICS_OUTBOX_POLL_INTERVAL_MS",
          2_000,
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        batchSize: parseNumber(raw, "POSTINGS_ANALYTICS_OUTBOX_BATCH_SIZE", 50, errors, {
          integer: true,
          min: 1,
        }),
      },
      postingsThumbnail: {
        pollIntervalMs: parseNumber(raw, "POSTINGS_THUMBNAIL_POLL_INTERVAL_MS", 5_000, errors, {
          integer: true,
          min: 1,
        }),
        batchSize: parseNumber(raw, "POSTINGS_THUMBNAIL_BATCH_SIZE", 25, errors, {
          integer: true,
          min: 1,
        }),
        maxAttempts: parseNumber(raw, "POSTINGS_THUMBNAIL_MAX_ATTEMPTS", 5, errors, {
          integer: true,
          min: 1,
        }),
      },
      bookingExpiry: {
        pollIntervalMs: parseNumber(
          raw,
          "BOOKING_REQUEST_EXPIRY_POLL_INTERVAL_MS",
          5_000,
          errors,
          {
            integer: true,
            min: 1,
          },
        ),
        batchSize: parseNumber(raw, "BOOKING_REQUEST_EXPIRY_BATCH_SIZE", 50, errors, {
          integer: true,
          min: 1,
        }),
      },
      paymentsRetry: {
        pollIntervalMs: parseNumber(raw, "PAYMENTS_RETRY_POLL_INTERVAL_MS", 5_000, errors, {
          integer: true,
          min: 1,
        }),
        batchSize: parseNumber(raw, "PAYMENTS_RETRY_BATCH_SIZE", 25, errors, {
          integer: true,
          min: 1,
        }),
      },
      paymentsRepair: {
        pollIntervalMs: parseNumber(raw, "PAYMENTS_REPAIR_POLL_INTERVAL_MS", 10_000, errors, {
          integer: true,
          min: 1,
        }),
        batchSize: parseNumber(raw, "PAYMENTS_REPAIR_BATCH_SIZE", 25, errors, {
          integer: true,
          min: 1,
        }),
      },
      payoutRelease: {
        pollIntervalMs: parseNumber(raw, "PAYOUT_RELEASE_POLL_INTERVAL_MS", 15_000, errors, {
          integer: true,
          min: 1,
        }),
        batchSize: parseNumber(raw, "PAYOUT_RELEASE_BATCH_SIZE", 50, errors, {
          integer: true,
          min: 1,
        }),
      },
    },
    blobStorage: {
      connectionString: raw.AZURE_STORAGE_CONNECTION_STRING,
      containerName: raw.AZURE_STORAGE_CONTAINER_NAME,
      uploadSasTtlSeconds: parseNumber(
        raw,
        "AZURE_STORAGE_UPLOAD_SAS_TTL_SECONDS",
        15 * 60,
        errors,
        {
          integer: true,
          min: 60,
          max: 60 * 60,
        },
      ),
    },
    rabbitmq: {
      url: raw.RABBITMQ_URL,
    },
    elasticsearch: {
      enabled: elasticsearchEnabled,
      url: raw.ELASTICSEARCH_URL?.replace(/\/+$/, ""),
      username: raw.ELASTICSEARCH_USERNAME,
      password: raw.ELASTICSEARCH_PASSWORD,
      postingsIndexName: raw.ELASTICSEARCH_POSTINGS_INDEX ?? DEFAULT_ELASTICSEARCH_POSTINGS_INDEX,
      timeoutMs: parseNumber(raw, "ELASTICSEARCH_TIMEOUT_MS", 2_000, errors, {
        integer: true,
        min: 1,
      }),
      circuitBreakerFailureThreshold: parseNumber(
        raw,
        "ELASTICSEARCH_CIRCUIT_BREAKER_FAILURE_THRESHOLD",
        3,
        errors,
        {
          integer: true,
          min: 1,
        },
      ),
      circuitBreakerCooldownMs: parseNumber(
        raw,
        "ELASTICSEARCH_CIRCUIT_BREAKER_COOLDOWN_MS",
        30_000,
        errors,
        {
          integer: true,
          min: 1,
        },
      ),
    },
    square: {
      accessToken: squareAccessToken,
      environment: squareEnvironment === "production" ? "production" : "sandbox",
      locationId: squareLocationId,
      webhookSignatureKey: squareWebhookSignatureKey,
      webhookNotificationUrl: squareWebhookNotificationUrl,
      apiBaseUrl:
        squareEnvironment === "production"
          ? "https://connect.squareup.com"
          : "https://connect.squareupsandbox.com",
    },
  };

  if (errors.length > 0) {
    throw new Error(
      ["Environment validation failed.", ...errors.map((error) => `- ${error}`)].join("\n"),
    );
  }

  return {
    raw,
    config,
  };
}

export function parseEnvironment(source: NodeJS.ProcessEnv): AppEnvironment {
  return parseEnvironmentState(source).config;
}

class EnvironmentManager {
  private isLoaded = false;
  private state: EnvironmentState | null = null;

  load(): AppEnvironment {
    if (this.state) {
      return this.state.config;
    }

    if (!this.isLoaded) {
      config({
        path: envFilePath,
      });
      this.isLoaded = true;
    }

    this.state = parseEnvironmentState(process.env);
    return this.state.config;
  }

  get(): AppEnvironment {
    if (!this.state) {
      throw new Error(
        "Environment has not been loaded. Call loadEnvironment() during application startup first.",
      );
    }

    return this.state.config;
  }

  getNodeEnvironment(): NodeEnvironment {
    return this.get().server.nodeEnv;
  }

  isProduction(): boolean {
    return this.get().server.isProduction;
  }

  isDevelopment(): boolean {
    return this.get().server.nodeEnv === "development";
  }

  isTest(): boolean {
    return this.get().server.nodeEnv === "test";
  }

  getServerPort(): number {
    return this.get().server.port;
  }

  getTokenConfig(): AppEnvironment["auth"] {
    return this.get().auth;
  }

  getDatabaseConfig(): AppEnvironment["database"] {
    return this.get().database;
  }

  getEmailConfig(): AppEnvironment["email"] {
    return this.get().email;
  }

  getCaptchaConfig(): AppEnvironment["captcha"] {
    return this.get().captcha;
  }

  getCorsAllowedOrigins(): string[] {
    return [...this.get().cors.allowedOrigins];
  }

  getCsrfAllowedOrigins(): string[] {
    return [...this.get().csrf.allowedOrigins];
  }

  getGoogleOAuthConfig(): AppEnvironment["oauth"]["google"] {
    return this.get().oauth.google;
  }

  getMicrosoftOAuthConfig(): AppEnvironment["oauth"]["microsoft"] {
    return this.get().oauth.microsoft;
  }

  getRedisConfig(): AppEnvironment["redis"] {
    return this.get().redis;
  }

  getRateLimiterConfig(): AppEnvironment["rateLimiter"] {
    return this.get().rateLimiter;
  }

  getSearchWorkerConfig(): AppEnvironment["workers"]["search"] {
    return this.get().workers.search;
  }

  getSearchRelayWorkerConfig(): AppEnvironment["workers"]["searchRelay"] {
    return this.get().workers.searchRelay;
  }

  getSearchIndexerWorkerConfig(): AppEnvironment["workers"]["searchIndexer"] {
    return this.get().workers.searchIndexer;
  }

  getSearchReconcileWorkerConfig(): AppEnvironment["workers"]["searchReconcile"] {
    return this.get().workers.searchReconcile;
  }

  getSearchReindexWorkerConfig(): AppEnvironment["workers"]["searchReindex"] {
    return this.get().workers.searchReindex;
  }

  getEmailWorkerConfig(): AppEnvironment["workers"]["email"] {
    return this.get().workers.email;
  }

  getAnalyticsWorkerConfig(): AppEnvironment["workers"]["analytics"] {
    return this.get().workers.analytics;
  }

  getPostingsThumbnailWorkerConfig(): AppEnvironment["workers"]["postingsThumbnail"] {
    return this.get().workers.postingsThumbnail;
  }

  getBookingExpiryWorkerConfig(): AppEnvironment["workers"]["bookingExpiry"] {
    return this.get().workers.bookingExpiry;
  }

  getPaymentsRetryWorkerConfig(): AppEnvironment["workers"]["paymentsRetry"] {
    return this.get().workers.paymentsRetry;
  }

  getPaymentsRepairWorkerConfig(): AppEnvironment["workers"]["paymentsRepair"] {
    return this.get().workers.paymentsRepair;
  }

  getPayoutReleaseWorkerConfig(): AppEnvironment["workers"]["payoutRelease"] {
    return this.get().workers.payoutRelease;
  }

  getBlobStorageConfig(): AppEnvironment["blobStorage"] {
    return this.get().blobStorage;
  }

  getRabbitMqConfig(): AppEnvironment["rabbitmq"] {
    return this.get().rabbitmq;
  }

  getElasticsearchConfig(): AppEnvironment["elasticsearch"] {
    return this.get().elasticsearch;
  }

  getSquareConfig(): AppEnvironment["square"] {
    return this.get().square;
  }

  getEnvironmentVariable(name: string): string {
    const value = (this.state?.raw as Record<string, string | undefined> | undefined)?.[name];

    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }

  getOptionalEnvironmentVariable(name: string): string | undefined {
    return (this.state?.raw as Record<string, string | undefined> | undefined)?.[name];
  }
}

export const environment = new EnvironmentManager();

export function loadEnvironment(): AppEnvironment {
  return environment.load();
}

export function getEnvironment(): AppEnvironment {
  return environment.get();
}

export function getEnvironmentVariable(name: string): string {
  return environment.getEnvironmentVariable(name);
}

export function getOptionalEnvironmentVariable(
  name: string,
): string | undefined {
  return environment.getOptionalEnvironmentVariable(name);
}
