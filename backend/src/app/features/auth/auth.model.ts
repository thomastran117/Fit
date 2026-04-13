export interface LocalSignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  deviceId?: string;
}

export interface LocalAuthenticateRequest {
  email: string;
  password: string;
  deviceId?: string;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionRecord {
  userId: string;
  sessionId: string;
  email: string;
  role: string;
  deviceId?: string;
}

export interface AuthUserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  emailVerified: boolean;
}

export interface AuthTokenPairResponse {
  accessToken: string;
  refreshToken: string;
  session: AuthSessionRecord;
  user: AuthUserProfile;
}
