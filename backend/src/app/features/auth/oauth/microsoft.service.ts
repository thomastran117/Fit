import { getOptionalEnvironmentVariable } from "@/configuration/environment";
import BadRequestError from "@/errors/http/bad-request.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { OAuthTokenVerifier } from "@/features/auth/oauth/oauth-token-verifier";
import type {
  OAuthAuthenticateInput,
  VerifiedOAuthProfile,
} from "@/features/auth/oauth/oauth.types";

const MICROSOFT_JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys";
const MICROSOFT_JWKS_ALLOWED_HOSTS = ["login.microsoftonline.com"];
const MICROSOFT_ISSUERS = [
  "https://login.microsoftonline.com/common/v2.0",
  "https://login.microsoftonline.com/consumers/v2.0",
  "https://login.microsoftonline.com/organizations/v2.0",
];

function readAudiences(): string[] {
  const value =
    getOptionalEnvironmentVariable("MICROSOFT_OAUTH_CLIENT_IDS") ??
    getOptionalEnvironmentVariable("MICROSOFT_OAUTH_CLIENT_ID");

  if (!value) {
    throw new BadRequestError("Microsoft OAuth is not configured.");
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitName(name?: string): { firstName?: string; lastName?: string } {
  if (!name) {
    return {};
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return {};
  }

  const [firstName, ...rest] = parts;
  return {
    firstName,
    lastName: rest.length ? rest.join(" ") : undefined,
  };
}

class MicrosoftOAuthService {
  constructor(private readonly tokenVerifier: OAuthTokenVerifier = new OAuthTokenVerifier()) {}

  async verify(input: OAuthAuthenticateInput): Promise<VerifiedOAuthProfile> {
    const payload = await this.tokenVerifier.verifyIdToken(input.idToken, {
      issuer: MICROSOFT_ISSUERS,
      audience: readAudiences(),
      jwksUrl: MICROSOFT_JWKS_URL,
      allowedHosts: MICROSOFT_JWKS_ALLOWED_HOSTS,
    });

    const emailClaim =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.preferred_username === "string"
          ? payload.preferred_username
          : undefined;

    if (!payload.sub || !emailClaim) {
      throw new UnauthorizedError("Microsoft ID token is missing required claims.");
    }

    const tokenNames = splitName(typeof payload.name === "string" ? payload.name : undefined);

    return {
      provider: "microsoft",
      providerUserId: payload.sub,
      email: emailClaim.trim().toLowerCase(),
      emailVerified: true,
      firstName: input.firstName ?? tokenNames.firstName,
      lastName: input.lastName ?? tokenNames.lastName,
    };
  }
}

export default MicrosoftOAuthService;
export { MicrosoftOAuthService };
