import { getOptionalEnvironmentVariable } from "@/configuration/environment";
import BadRequestError from "@/errors/http/bad-request.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { OAuthTokenVerifier } from "@/features/auth/oauth/oauth-token-verifier";
import type {
  OAuthAuthenticateInput,
  VerifiedOAuthProfile,
} from "@/features/auth/oauth/oauth.types";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_JWKS_ALLOWED_HOSTS = ["appleid.apple.com"];

function readAudiences(): string[] {
  const configuredValues = [
    getOptionalEnvironmentVariable("APPLE_OAUTH_CLIENT_IDS"),
    getOptionalEnvironmentVariable("APPLE_OAUTH_CLIENT_ID"),
    getOptionalEnvironmentVariable("APPLE_SERVICE_ID"),
    getOptionalEnvironmentVariable("APPLE_BUNDLE_ID"),
  ].filter((value): value is string => Boolean(value));

  const audiences = configuredValues
    .flatMap((value) => value.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!audiences.length) {
    throw new BadRequestError("Apple OAuth is not configured.");
  }

  return [...new Set(audiences)];
}

function normalizeEmailVerified(value: boolean | string | undefined): boolean {
  return value === true || value === "true";
}

class AppleOAuthService {
  constructor(private readonly tokenVerifier: OAuthTokenVerifier) {}

  async verify(input: OAuthAuthenticateInput): Promise<VerifiedOAuthProfile> {
    const payload = await this.tokenVerifier.verifyIdToken(input.idToken, {
      issuer: APPLE_ISSUER,
      audience: readAudiences(),
      jwksUrl: APPLE_JWKS_URL,
      allowedHosts: APPLE_JWKS_ALLOWED_HOSTS,
    });

    if (!payload.sub || typeof payload.email !== "string") {
      throw new UnauthorizedError("Apple identity token is missing required claims.");
    }

    const emailVerified = normalizeEmailVerified(payload.email_verified);

    if (!emailVerified) {
      throw new UnauthorizedError("Apple account email is not verified.");
    }

    return {
      provider: "apple",
      providerUserId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified,
      firstName: input.firstName,
      lastName: input.lastName,
    };
  }
}

export default AppleOAuthService;
export { AppleOAuthService };
