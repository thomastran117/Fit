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

export type LocalSignupRequest = z.infer<typeof localSignupRequestSchema>;

export type LocalAuthenticateRequest = z.infer<typeof localAuthenticateRequestSchema>;

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
