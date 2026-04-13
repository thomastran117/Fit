import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cacheService, type CacheService } from "@/features/cache/cache.service.js";

type RefreshTokenMode = "stateless" | "stateful";

export interface AccessTokenPayload {
  sub: string;
  email?: string;
  role?: string;
  sessionId?: string;
  deviceId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  deviceId?: string;
  tokenVersion?: number;
  [key: string]: string | number | boolean | null | undefined;
}

interface JwtClaims extends AccessTokenPayload {
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
}

interface RefreshTokenClaims extends RefreshTokenPayload {
  iat: number;
  exp: number;
  jti: string;
}

interface StatefulRefreshSession extends RefreshTokenClaims {
  signature: string;
}

interface TokenServiceOptions {
  cache?: CacheService;
  accessTokenSecret?: string;
  refreshTokenSecret?: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  issuer?: string;
  audience?: string;
  refreshTokenMode?: RefreshTokenMode;
  refreshTokenCachePrefix?: string;
}

const ACCESS_TOKEN_ALGORITHM = "HS256";
const REFRESH_TOKEN_VERSION = "v1";

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsedValue;
}

function readRequiredSecret(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function toBase64Url(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer.toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export class TokenService {
  private readonly cache: CacheService;
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly refreshTokenMode: RefreshTokenMode;
  private readonly refreshTokenCachePrefix: string;

  constructor(options: TokenServiceOptions = {}) {
    this.cache = options.cache ?? cacheService;
    this.accessTokenSecret = options.accessTokenSecret ?? readRequiredSecret("ACCESS_TOKEN_SECRET", "development-access-secret");
    this.refreshTokenSecret = options.refreshTokenSecret ?? readRequiredSecret("REFRESH_TOKEN_SECRET", "development-refresh-secret");
    this.accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? readNumber("ACCESS_TOKEN_TTL_SECONDS", 15 * 60);
    this.refreshTokenTtlSeconds = options.refreshTokenTtlSeconds ?? readNumber("REFRESH_TOKEN_TTL_SECONDS", 30 * 24 * 60 * 60);
    this.issuer = options.issuer ?? process.env.TOKEN_ISSUER;
    this.audience = options.audience ?? process.env.TOKEN_AUDIENCE;
    this.refreshTokenMode =
      options.refreshTokenMode ??
      ((process.env.REFRESH_TOKEN_MODE as RefreshTokenMode | undefined) ?? "stateless");
    this.refreshTokenCachePrefix = options.refreshTokenCachePrefix ?? process.env.REFRESH_TOKEN_CACHE_PREFIX ?? "auth:refresh";
  }

  createAccessToken(payload: AccessTokenPayload): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: JwtClaims = {
      ...payload,
      iat: now,
      exp: now + this.accessTokenTtlSeconds,
      ...(this.issuer ? { iss: this.issuer } : {}),
      ...(this.audience ? { aud: this.audience } : {}),
    };

    return this.signJwt(claims);
  }

  verifyAccessToken(token: string): JwtClaims {
    return this.verifyJwt(token);
  }

  async createRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    if (this.refreshTokenMode === "stateful") {
      return this.createStatefulRefreshToken(payload);
    }

    return this.createStatelessRefreshToken(payload);
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    if (this.refreshTokenMode === "stateful") {
      return this.verifyStatefulRefreshToken(token);
    }

    return this.verifyStatelessRefreshToken(token);
  }

  async revokeRefreshToken(token: string): Promise<boolean> {
    if (this.refreshTokenMode === "stateful") {
      return this.revokeStatefulRefreshToken(token);
    }

    return false;
  }

  createStatelessRefreshToken(payload: RefreshTokenPayload): string {
    const claims = this.buildRefreshClaims(payload);
    const body = toBase64Url(JSON.stringify(claims));
    const signature = signValue(body, this.refreshTokenSecret);

    return `${REFRESH_TOKEN_VERSION}.${body}.${signature}`;
  }

  verifyStatelessRefreshToken(token: string): RefreshTokenClaims {
    const [version, body, signature] = token.split(".");

    if (!version || !body || !signature || version !== REFRESH_TOKEN_VERSION) {
      throw new Error("Invalid refresh token format.");
    }

    const expectedSignature = signValue(body, this.refreshTokenSecret);

    if (!safeEquals(signature, expectedSignature)) {
      throw new Error("Invalid refresh token signature.");
    }

    const claims = JSON.parse(fromBase64Url(body)) as RefreshTokenClaims;
    this.assertRefreshTokenIsValid(claims);

    return claims;
  }

  async createStatefulRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    const claims = this.buildRefreshClaims(payload);
    const body = toBase64Url(JSON.stringify(claims));
    const signature = signValue(body, this.refreshTokenSecret);
    const token = `${REFRESH_TOKEN_VERSION}.${body}.${signature}`;
    const cacheKey = this.getRefreshCacheKey(claims.jti);
    const session: StatefulRefreshSession = {
      ...claims,
      signature,
    };

    await this.cache.setJson(cacheKey, session, this.refreshTokenTtlSeconds);

    return token;
  }

  async verifyStatefulRefreshToken(token: string): Promise<RefreshTokenClaims> {
    const [version, body, signature] = token.split(".");

    if (!version || !body || !signature || version !== REFRESH_TOKEN_VERSION) {
      throw new Error("Invalid refresh token format.");
    }

    const claims = JSON.parse(fromBase64Url(body)) as RefreshTokenClaims;
    this.assertRefreshTokenIsValid(claims);

    const session = await this.cache.getJson<StatefulRefreshSession>(
      this.getRefreshCacheKey(claims.jti),
    );

    if (!session) {
      throw new Error("Refresh token session not found.");
    }

    const expectedSignature = signValue(body, this.refreshTokenSecret);

    if (!safeEquals(signature, expectedSignature) || !safeEquals(signature, session.signature)) {
      throw new Error("Invalid refresh token signature.");
    }

    if (session.sub !== claims.sub || session.sessionId !== claims.sessionId) {
      throw new Error("Refresh token session mismatch.");
    }

    return claims;
  }

  async revokeStatefulRefreshToken(token: string): Promise<boolean> {
    const claims = this.parseRefreshToken(token);
    return this.cache.delete(this.getRefreshCacheKey(claims.jti));
  }

  private signJwt(payload: JwtClaims): string {
    const header = {
      alg: ACCESS_TOKEN_ALGORITHM,
      typ: "JWT",
    };

    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = signValue(unsignedToken, this.accessTokenSecret);

    return `${unsignedToken}.${signature}`;
  }

  private verifyJwt(token: string): JwtClaims {
    const [encodedHeader, encodedPayload, signature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new Error("Invalid access token format.");
    }

    const expectedSignature = signValue(
      `${encodedHeader}.${encodedPayload}`,
      this.accessTokenSecret,
    );

    if (!safeEquals(signature, expectedSignature)) {
      throw new Error("Invalid access token signature.");
    }

    const header = JSON.parse(fromBase64Url(encodedHeader)) as { alg?: string; typ?: string };

    if (header.alg !== ACCESS_TOKEN_ALGORITHM || header.typ !== "JWT") {
      throw new Error("Invalid access token header.");
    }

    const claims = JSON.parse(fromBase64Url(encodedPayload)) as JwtClaims;
    const now = Math.floor(Date.now() / 1000);

    if (claims.exp <= now) {
      throw new Error("Access token has expired.");
    }

    if (this.issuer && claims.iss !== this.issuer) {
      throw new Error("Access token issuer is invalid.");
    }

    if (this.audience && claims.aud !== this.audience) {
      throw new Error("Access token audience is invalid.");
    }

    return claims;
  }

  private buildRefreshClaims(payload: RefreshTokenPayload): RefreshTokenClaims {
    const now = Math.floor(Date.now() / 1000);

    return {
      ...payload,
      iat: now,
      exp: now + this.refreshTokenTtlSeconds,
      jti: randomBytes(32).toString("base64url"),
    };
  }

  private parseRefreshToken(token: string): RefreshTokenClaims {
    const [version, body, signature] = token.split(".");

    if (!version || !body || !signature || version !== REFRESH_TOKEN_VERSION) {
      throw new Error("Invalid refresh token format.");
    }

    return JSON.parse(fromBase64Url(body)) as RefreshTokenClaims;
  }

  private assertRefreshTokenIsValid(claims: RefreshTokenClaims): void {
    const now = Math.floor(Date.now() / 1000);

    if (claims.exp <= now) {
      throw new Error("Refresh token has expired.");
    }
  }

  private getRefreshCacheKey(jti: string): string {
    return `${this.refreshTokenCachePrefix}:${jti}`;
  }
}

export const tokenService = new TokenService();
