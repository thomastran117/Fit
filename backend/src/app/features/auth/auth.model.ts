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

export const verifyEmailRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Verification code must be 6 digits."),
  deviceId: optionalTrimmedString,
});

export const resendVerificationEmailRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

export type LocalSignupRequestBody = z.infer<typeof localSignupRequestSchema>;

export type LocalAuthenticateRequestBody = z.infer<typeof localAuthenticateRequestSchema>;

export type OAuthAuthenticateRequestBody = z.infer<typeof oauthAuthenticateRequestSchema>;

export type VerifyEmailRequestBody = z.infer<typeof verifyEmailRequestSchema>;

export type ResendVerificationEmailRequestBody = z.infer<
  typeof resendVerificationEmailRequestSchema
>;

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

export interface VerifyEmailInput {
  email: string;
  code: string;
  deviceId?: string;
}

export interface ResendVerificationEmailInput {
  email: string;
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

export interface SignupVerificationPendingResult {
  verificationRequired: true;
  email: string;
  alreadyPending: boolean;
}
