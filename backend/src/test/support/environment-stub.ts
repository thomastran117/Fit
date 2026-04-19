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

const captchaConfig = {
  secretKey: "test-turnstile-secret",
  allowedHosts: ["challenges.cloudflare.com"],
};

export const environment = {
  isProduction(): boolean {
    return false;
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

export function getOptionalEnvironmentVariable(_name: string) {
  return undefined;
}
