const tokenConfig = {
  accessTokenSecret: "test-access-secret",
  refreshTokenSecret: "test-refresh-secret",
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  rememberMeRefreshTokenTtlSeconds: 90 * 24 * 60 * 60,
  issuer: undefined,
  audience: undefined,
  refreshTokenMode: "stateless" as const,
  refreshTokenCachePrefix: "auth:refresh",
};

export const environment = {
  isProduction(): boolean {
    return false;
  },
  getTokenConfig() {
    return tokenConfig;
  },
  load() {
    return {
      auth: tokenConfig,
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
