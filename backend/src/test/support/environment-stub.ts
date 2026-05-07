const tokenConfig = {
  accessTokenSecret: "test-access-secret-value-with-32chars",
  refreshTokenSecret: "test-refresh-secret-value-with-32c",
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  rememberMeRefreshTokenTtlSeconds: 90 * 24 * 60 * 60,
  issuer: undefined,
  audience: undefined,
  refreshTokenMode: "stateful" as const,
  refreshTokenCachePrefix: "auth:refresh",
  personalAccessTokenSecret: "test-personal-access-token-secret-32",
};

const captchaConfig = {
  secretKey: "test-turnstile-secret",
  allowedHosts: ["challenges.cloudflare.com"],
};

const databaseConfig = {
  autoSeedEnabled: true,
  autoSeedRefresh: false,
  operationLoggingEnabled: false,
  queryLoggingEnabled: false,
  slowOperationThresholdMs: 500,
  slowQueryThresholdMs: 250,
  url: "mysql://user:password@localhost:3306/rent_test",
};

const rateLimiterConfig = {
  enabled: true,
  strategy: "sliding-window" as const,
  limit: 60,
  windowSeconds: 60,
  bucketCapacity: 60,
  refillTokensPerSecond: 1,
};

function readNodeEnvironment() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv === "production" || nodeEnv === "test" || nodeEnv === "development"
    ? nodeEnv
    : "development";
}

function readLoggingConfig() {
  const nodeEnv = readNodeEnvironment();

  return {
    fallbackDirectory: process.env.LOG_FALLBACK_DIRECTORY ?? "C:/tmp/rent-test-logs",
    level: (process.env.LOG_LEVEL as
      | "debug"
      | "info"
      | "warn"
      | "error"
      | "critical"
      | undefined) ?? "debug",
    mode: nodeEnv === "production" ? ("rabbitmq" as const) : ("console" as const),
    serviceName: process.env.LOG_SERVICE_NAME ?? "backend-test",
  };
}

function readRabbitMqConfig() {
  return {
    url: process.env.RABBITMQ_URL ?? "amqp://localhost:5672",
  };
}

function readRouteModulesConfig() {
  const configuredIds = (process.env.DISABLED_ROUTE_MODULES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    disabledIds: Array.from(new Set(configuredIds)),
  };
}

export const environment = {
  isProduction(): boolean {
    return readNodeEnvironment() === "production";
  },
  isDevelopment(): boolean {
    return readNodeEnvironment() === "development";
  },
  isTest(): boolean {
    return readNodeEnvironment() === "test";
  },
  getNodeEnvironment() {
    return readNodeEnvironment();
  },
  getServerPort() {
    return 8040;
  },
  getDatabaseConfig() {
    return databaseConfig;
  },
  getTokenConfig() {
    return tokenConfig;
  },
  getCaptchaConfig() {
    return captchaConfig;
  },
  getRateLimiterConfig() {
    return rateLimiterConfig;
  },
  getLoggingConfig() {
    return readLoggingConfig();
  },
  getRabbitMqConfig() {
    return readRabbitMqConfig();
  },
  getRouteModulesConfig() {
    return readRouteModulesConfig();
  },
  load() {
    return {
      auth: tokenConfig,
      captcha: captchaConfig,
      database: databaseConfig,
      logging: readLoggingConfig(),
      routeModules: readRouteModulesConfig(),
      rabbitmq: readRabbitMqConfig(),
      rateLimiter: rateLimiterConfig,
      server: {
        nodeEnv: readNodeEnvironment(),
        isProduction: readNodeEnvironment() === "production",
      },
    };
  },
  get() {
    return this.load();
  },
};

export function loadEnvironment() {
  return environment.load();
}

export function getEnvironment() {
  return environment.get();
}

export function getOptionalEnvironmentVariable(name: string) {
  return process.env[name];
}
