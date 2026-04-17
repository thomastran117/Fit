export interface AuthResponseUser {
  id: string;
  email: string;
  username: string;
}

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
