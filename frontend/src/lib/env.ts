const fallbackApiBaseUrl = "http://localhost:8040";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const publicEnv = {
  apiBaseUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || fallbackApiBaseUrl,
  ),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "",
  googleOAuthClientId: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() || "",
  microsoftOAuthClientId: process.env.NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID?.trim() || "",
} as const;
