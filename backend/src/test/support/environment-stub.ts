const tokenConfig = {
  accessTokenSecret: "test-access-secret",
  refreshTokenSecret: "test-refresh-secret",
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  rememberMeRefreshTokenTtlSeconds: 90 * 24 * 60 * 60,
  issuer: undefined,
  audience: undefined,
  refreshTokenMode: "stateful" as const,
  refreshTokenCachePrefix: "auth:refresh",
};

const captchaConfig = {
  secretKey: "test-turnstile-secret",
  allowedHosts: ["challenges.cloudflare.com"],
};

const databaseConfig = {
  operationLoggingEnabled: false,
  queryLoggingEnabled: false,
  slowOperationThresholdMs: 500,
  slowQueryThresholdMs: 250,
  url: "mysql://user:password@localhost:3306/rent_test",
};

export const environment = {
  isProduction(): boolean {
    return false;
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
  load() {
    return {
      auth: tokenConfig,
      captcha: captchaConfig,
      database: databaseConfig,
      server: {
        isProduction: false,
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
