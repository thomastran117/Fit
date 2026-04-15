import { getOptionalEnvironmentVariable } from "@/configuration/environment";
import BadRequestError from "@/errors/http/bad-request.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { OAuthTokenVerifier } from "@/features/auth/oauth/oauth-token-verifier";
import type {
  OAuthAuthenticateInput,
  VerifiedOAuthProfile,
} from "@/features/auth/oauth/oauth.types";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_JWKS_ALLOWED_HOSTS = ["www.googleapis.com"];

function readAudiences(): string[] {
  const value =
    getOptionalEnvironmentVariable("GOOGLE_OAUTH_CLIENT_IDS") ??
    getOptionalEnvironmentVariable("GOOGLE_OAUTH_CLIENT_ID");

  if (!value) {
    throw new BadRequestError("Google OAuth is not configured.");
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeEmailVerified(value: boolean | string | undefined): boolean {
  return value === true || value === "true";
}

class GoogleOAuthService {
  constructor(private readonly tokenVerifier: OAuthTokenVerifier) {}

  async verify(input: OAuthAuthenticateInput): Promise<VerifiedOAuthProfile> {
    const payload = await this.tokenVerifier.verifyIdToken(input.idToken, {
      issuer: GOOGLE_ISSUERS,
      audience: readAudiences(),
      jwksUrl: GOOGLE_JWKS_URL,
      allowedHosts: GOOGLE_JWKS_ALLOWED_HOSTS,
    });

    if (!payload.sub || typeof payload.email !== "string") {
      throw new UnauthorizedError("Google ID token is missing required claims.");
    }

    const emailVerified = normalizeEmailVerified(payload.email_verified);

    if (!emailVerified) {
      throw new UnauthorizedError("Google account email is not verified.");
    }

    return {
      provider: "google",
      providerUserId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified,
      firstName:
        input.firstName ??
        (typeof payload.given_name === "string" ? payload.given_name.trim() || undefined : undefined),
      lastName:
        input.lastName ??
        (typeof payload.family_name === "string" ? payload.family_name.trim() || undefined : undefined),
    };
  }
}

export default GoogleOAuthService;
export { GoogleOAuthService };
