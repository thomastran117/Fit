export type OAuthProvider = "google" | "microsoft" | "apple";

export interface OAuthAuthenticateInput {
  idToken: string;
  deviceId?: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifiedOAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
}
