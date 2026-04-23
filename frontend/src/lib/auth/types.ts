export interface AuthResponseUser {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
}

export type OAuthProvider = "google" | "microsoft" | "apple";

export interface AuthResponseBody {
  accessToken: string;
  refreshToken?: string;
  device: {
    deviceId?: string;
    known: boolean;
    knownByIp: boolean;
  };
  user: AuthResponseUser;
}

export interface SignupVerificationPendingResult {
  verificationRequired: true;
  email: string;
  alreadyPending: boolean;
}

export interface ForgotPasswordAcceptedResult {
  accepted: true;
}

export type AuthEmailAcceptedResult = ForgotPasswordAcceptedResult;

export interface LinkedOAuthProvidersResult {
  hasPassword: boolean;
  providers: Array<{
    id: string;
    provider: OAuthProvider;
    providerEmail?: string;
    emailVerified: boolean;
    displayName?: string;
    linkedAt: string;
  }>;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type StoredAuthSession = AuthResponseBody;
