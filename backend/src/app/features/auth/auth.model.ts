import { z } from "zod";

const optionalTrimmedString = z.string().trim().min(1).optional();

export const localSignupRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters long."),
  firstName: optionalTrimmedString,
  lastName: optionalTrimmedString,
  deviceId: optionalTrimmedString,
});

export const localAuthenticateRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, "Password is required."),
  deviceId: optionalTrimmedString,
});

export const oauthAuthenticateRequestSchema = z.object({
  idToken: z.string().trim().min(1, "ID token is required."),
  deviceId: optionalTrimmedString,
  firstName: optionalTrimmedString,
  lastName: optionalTrimmedString,
});

export type LocalSignupRequestBody = z.infer<typeof localSignupRequestSchema>;

export type LocalAuthenticateRequestBody = z.infer<typeof localAuthenticateRequestSchema>;

export type OAuthAuthenticateRequestBody = z.infer<typeof oauthAuthenticateRequestSchema>;

export interface LocalAuthenticateInput {
  email: string;
  password: string;
  deviceId?: string;
}

export interface LocalSignupInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  deviceId?: string;
}

export interface OAuthAuthenticateInput {
  idToken: string;
  deviceId?: string;
  firstName?: string;
  lastName?: string;
}

export interface CreateLocalUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
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

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  session: AuthSessionRecord;
  user: AuthUserProfile;
}

export interface AuthResponseUser {
  id: string;
  email: string;
  username: string;
}

export interface AuthResponseBody {
  accessToken: string;
  refreshToken?: string;
  user: AuthResponseUser;
}
