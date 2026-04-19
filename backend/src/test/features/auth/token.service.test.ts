import UnauthorizedError from "@/errors/http/unauthorized.error";
import { TokenService, type JwtClaims } from "@/features/auth/token/token.service";

function createClaims(overrides: Partial<JwtClaims> = {}): JwtClaims {
  return {
    sub: "user-1",
    email: "user@example.com",
    role: "user",
    deviceId: "device-1",
    tokenVersion: 2,
    iat: 1,
    exp: 9_999_999_999,
    ...overrides,
  };
}

function createAuthRepository(options?: {
  tokenVersion?: number | null;
}) {
  return {
    findTokenVersionByUserId: jest.fn(async () =>
      options?.tokenVersion === undefined ? 2 : options.tokenVersion,
    ),
  };
}

function createCache() {
  const store = new Map<string, { value: unknown; ttlSeconds: number }>();

  return {
    store,
    service: {
      getJson: jest.fn(async <TValue>(key: string) => {
        return (store.get(key)?.value as TValue | undefined) ?? null;
      }),
      setJson: jest.fn(async (key: string, value: unknown, ttlSeconds: number) => {
        store.set(key, {
          value,
          ttlSeconds,
        });
      }),
      delete: jest.fn(async (key: string) => store.delete(key)),
    },
  };
}

function createService(options?: {
  tokenVersion?: number | null;
  refreshTokenMode?: "stateless" | "stateful";
  issuer?: string;
  audience?: string;
  cachePrefix?: string;
}) {
  const authRepository = createAuthRepository({
    tokenVersion: options?.tokenVersion,
  });
  const cache = createCache();
  const service = new TokenService({
    cache: cache.service as never,
    authRepository: authRepository as never,
    refreshTokenMode: options?.refreshTokenMode,
    issuer: options?.issuer,
    audience: options?.audience,
    refreshTokenCachePrefix: options?.cachePrefix,
  });

  return {
    service,
    authRepository,
    cache,
  };
}

describe("TokenService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates and verifies access tokens while preserving auth claims", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const { service, authRepository } = createService();

    const token = service.createAccessToken({
      sub: "user-1",
      email: "user@example.com",
      role: "owner",
      deviceId: "device-9",
      tokenVersion: 2,
    });

    const claims = await service.verifyAccessToken(token);

    expect(claims).toMatchObject({
      sub: "user-1",
      email: "user@example.com",
      role: "owner",
      deviceId: "device-9",
      tokenVersion: 2,
      iat: 1_700_000_000,
      exp: 1_700_000_900,
    });
    expect(authRepository.findTokenVersionByUserId).toHaveBeenCalledWith("user-1");
  });

  it("rejects access tokens when the stored token version has changed", async () => {
    const { service } = createService({
      tokenVersion: 3,
    });
    const token = service.createAccessToken({
      sub: "user-1",
      tokenVersion: 2,
    });

    await expect(service.verifyAccessToken(token)).rejects.toMatchObject<
      Partial<UnauthorizedError>
    >({
      message: "Session is no longer valid.",
    });
  });

  it("rejects access tokens when the authenticated user no longer exists", async () => {
    const { service } = createService({
      tokenVersion: null,
    });
    const token = service.createAccessToken({
      sub: "missing-user",
      tokenVersion: 2,
    });

    await expect(service.verifyAccessToken(token)).rejects.toMatchObject<
      Partial<UnauthorizedError>
    >({
      message: "Authenticated user could not be found.",
    });
  });

  it("enforces configured issuer and audience for access tokens", async () => {
    const issuerService = createService({
      issuer: "rent-api",
      audience: "rent-web",
    }).service;
    const verifierService = createService({
      issuer: "rent-api",
      audience: "rent-mobile",
    }).service;
    const token = issuerService.createAccessToken({
      sub: "user-1",
      tokenVersion: 2,
    });

    await expect(verifierService.verifyAccessToken(token)).rejects.toThrow(
      "Access token audience is invalid.",
    );
  });

  it("returns the longer configured refresh TTL when remember me is enabled", () => {
    const { service } = createService();

    expect(service.getRefreshTokenExpiresInSeconds(false)).toBe(2_592_000);
    expect(service.getRefreshTokenExpiresInSeconds(true)).toBe(7_776_000);
  });

  it("creates and verifies stateless refresh tokens with remember-me claims", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const { service, authRepository } = createService();

    const token = await service.createRefreshToken(
      {
        sub: "user-1",
        deviceId: "device-1",
        rememberMe: true,
        tokenVersion: 2,
      },
      {
        expiresInSeconds: service.getRefreshTokenExpiresInSeconds(true),
      },
    );

    const claims = await service.verifyRefreshToken(token);

    expect(claims).toMatchObject({
      sub: "user-1",
      deviceId: "device-1",
      rememberMe: true,
      tokenVersion: 2,
      iat: 1_700_000_000,
      exp: 1_707_776_000,
    });
    expect(typeof claims.jti).toBe("string");
    expect(authRepository.findTokenVersionByUserId).toHaveBeenCalledWith("user-1");
  });

  it("rejects stateless refresh tokens with invalid signatures", async () => {
    const { service } = createService();
    const token = await service.createRefreshToken({
      sub: "user-1",
      tokenVersion: 2,
    });
    const parts = token.split(".");
    const tamperedToken = `${parts[0]}.${parts[1]}.not-the-real-signature`;

    await expect(service.verifyRefreshToken(tamperedToken)).rejects.toThrow(
      "Invalid refresh token signature.",
    );
  });

  it("stores, verifies, and revokes stateful refresh token sessions", async () => {
    const { service, cache } = createService({
      refreshTokenMode: "stateful",
      cachePrefix: "test:refresh",
    });
    const token = await service.createRefreshToken(
      {
        sub: "user-1",
        deviceId: "device-7",
        tokenVersion: 2,
      },
      {
        expiresInSeconds: 120,
      },
    );
    const parts = token.split(".");
    const body = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as {
      jti: string;
    };

    expect(cache.service.setJson).toHaveBeenCalledTimes(1);
    expect(cache.service.setJson).toHaveBeenCalledWith(
      `test:refresh:${body.jti}`,
      expect.objectContaining({
        sub: "user-1",
        deviceId: "device-7",
      }),
      120,
    );

    await expect(service.verifyRefreshToken(token)).resolves.toMatchObject({
      sub: "user-1",
      deviceId: "device-7",
      tokenVersion: 2,
    });
    await expect(service.revokeRefreshToken(token)).resolves.toBe(true);
    expect(cache.service.delete).toHaveBeenCalledWith(`test:refresh:${body.jti}`);
  });

  it("rejects stateful refresh tokens when the cached session is missing", async () => {
    const { service, cache } = createService({
      refreshTokenMode: "stateful",
    });
    const token = await service.createRefreshToken({
      sub: "user-1",
      tokenVersion: 2,
    });
    const cacheKey = [...cache.store.keys()][0];

    cache.store.delete(cacheKey);

    await expect(service.verifyRefreshToken(token)).rejects.toThrow(
      "Refresh token session not found.",
    );
  });
});
