import { createPublicKey, verify } from "node:crypto";
import BadRequestError from "@/errors/http/bad-request.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface JwtPayload {
  sub?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  email?: string;
  email_verified?: boolean | string;
  given_name?: string;
  family_name?: string;
  name?: string;
  preferred_username?: string;
  nonce?: string;
  [key: string]: unknown;
}

interface JsonWebKey {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
}

interface JsonWebKeySet {
  keys?: JsonWebKey[];
}

interface VerifyJwtOptions {
  issuer: string | string[];
  audience: string | string[];
  jwksUrl: string;
  allowedAlgorithms?: string[];
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64UrlJson<TValue>(input: string, label: string): TValue {
  try {
    return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as TValue;
  } catch {
    throw new BadRequestError(`OAuth token ${label} is malformed.`);
  }
}

function asArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function matchesAudience(
  expectedAudience: string | string[],
  actualAudience: string | string[] | undefined,
): boolean {
  if (!actualAudience) {
    return false;
  }

  const expected = asArray(expectedAudience);
  const actual = asArray(actualAudience);

  return actual.some((value) => expected.includes(value));
}

function matchesIssuer(expectedIssuer: string | string[], actualIssuer: string | undefined): boolean {
  if (!actualIssuer) {
    return false;
  }

  return asArray(expectedIssuer).includes(actualIssuer);
}

function getJwkPublicKey(jwk: JsonWebKey): ReturnType<typeof createPublicKey> {
  if (jwk.x5c?.length) {
    const certificate = jwk.x5c[0];

    if (!certificate) {
      throw new UnauthorizedError("OAuth signing certificate is missing.");
    }

    const pem = `-----BEGIN CERTIFICATE-----\n${certificate}\n-----END CERTIFICATE-----`;
    return createPublicKey(pem);
  }

  if (jwk.kty === "RSA" && jwk.n && jwk.e) {
    return createPublicKey({
      key: {
        kty: "RSA",
        n: jwk.n,
        e: jwk.e,
      },
      format: "jwk",
    });
  }

  throw new UnauthorizedError("OAuth signing key is not supported.");
}

export class OAuthTokenVerifier {
  private static readonly jwksCache = new Map<
    string,
    {
      expiresAt: number;
      keys: JsonWebKey[];
    }
  >();

  async verifyIdToken(token: string, options: VerifyJwtOptions): Promise<JwtPayload> {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new BadRequestError("OAuth ID token format is invalid.");
    }

    const header = fromBase64UrlJson<JwtHeader>(encodedHeader, "header");
    const payload = fromBase64UrlJson<JwtPayload>(encodedPayload, "payload");
    const allowedAlgorithms = options.allowedAlgorithms ?? ["RS256"];

    if (!header.alg || !allowedAlgorithms.includes(header.alg)) {
      throw new UnauthorizedError("OAuth token algorithm is invalid.");
    }

    if (!matchesIssuer(options.issuer, payload.iss)) {
      throw new UnauthorizedError("OAuth token issuer is invalid.");
    }

    if (!matchesAudience(options.audience, payload.aud)) {
      throw new UnauthorizedError("OAuth token audience is invalid.");
    }

    this.assertTokenTimes(payload);

    const signingKey = await this.findSigningKey(options.jwksUrl, header.kid);
    const verified = verify(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
      getJwkPublicKey(signingKey),
      Buffer.from(encodedSignature, "base64url"),
    );

    if (!verified) {
      throw new UnauthorizedError("OAuth token signature is invalid.");
    }

    return payload;
  }

  private assertTokenTimes(payload: JwtPayload): void {
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== "number" || payload.exp <= now) {
      throw new UnauthorizedError("OAuth token has expired.");
    }

    if (typeof payload.nbf === "number" && payload.nbf > now) {
      throw new UnauthorizedError("OAuth token is not active yet.");
    }
  }

  private async findSigningKey(jwksUrl: string, kid?: string): Promise<JsonWebKey> {
    const keys = await this.fetchJwks(jwksUrl);

    if (kid) {
      const matchingKey = keys.find((key) => key.kid === kid);

      if (matchingKey) {
        return matchingKey;
      }
    }

    if (keys.length === 1) {
      const [singleKey] = keys;

      if (singleKey) {
        return singleKey;
      }
    }

    throw new UnauthorizedError("OAuth signing key was not found.");
  }

  private async fetchJwks(jwksUrl: string): Promise<JsonWebKey[]> {
    const cached = OAuthTokenVerifier.jwksCache.get(jwksUrl);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    const response = await fetch(jwksUrl);

    if (!response.ok) {
      throw new UnauthorizedError("OAuth signing keys could not be fetched.");
    }

    const body = (await response.json()) as JsonWebKeySet;
    const keys = body.keys ?? [];

    if (!keys.length) {
      throw new UnauthorizedError("OAuth signing keys are unavailable.");
    }

    OAuthTokenVerifier.jwksCache.set(jwksUrl, {
      keys,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return keys;
  }
}
