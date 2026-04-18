import type { ClientRequestContext } from "@/configuration/http/bindings";
import { z } from "zod";

const optionalTrimmedString = z.string().trim().min(1).optional();

export const localSignupRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters long."),
  captchaToken: z.string().trim().min(1, "Captcha token is required."),
  firstName: optionalTrimmedString,
  lastName: optionalTrimmedString,
  deviceId: optionalTrimmedString,
});

export const localAuthenticateRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, "Password is required."),
  captchaToken: z.string().trim().min(1, "Captcha token is required."),
  deviceId: optionalTrimmedString,
});

export const oauthAuthenticateRequestSchema = z
  .object({
    code: optionalTrimmedString,
    codeVerifier: optionalTrimmedString,
    idToken: optionalTrimmedString,
    nonce: z.string().trim().min(1, "Nonce is required."),
    deviceId: optionalTrimmedString,
    firstName: optionalTrimmedString,
    lastName: optionalTrimmedString,
  })
  .superRefine((input, context) => {
    if (input.idToken) {
      return;
    }

    if (!input.code) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Authorization code is required.",
        path: ["code"],
      });
    }

    if (!input.codeVerifier) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Code verifier is required.",
        path: ["codeVerifier"],
      });
    }
  });

export const verifyEmailRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Verification code must be 6 digits."),
  deviceId: optionalTrimmedString,
});

export const resendVerificationEmailRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

export const unlockLocalLoginRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Unlock code must be 6 digits."),
});

export const resendUnlockLocalLoginRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

export const refreshRequestSchema = z.object({
  refreshToken: optionalTrimmedString,
});

export const forgotPasswordRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  captchaToken: z.string().trim().min(1, "Captcha token is required."),
});

export const resendForgotPasswordRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

export const resetPasswordRequestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Reset code must be 6 digits."),
  newPassword: z.string().min(8, "Password must be at least 8 characters long."),
  deviceId: optionalTrimmedString,
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "Password must be at least 8 characters long."),
});

export const removeKnownDeviceRequestSchema = z.object({
  deviceId: z.string().trim().min(1, "Device ID is required."),
});

export type LocalSignupRequestBody = z.infer<typeof localSignupRequestSchema>;

export type LocalAuthenticateRequestBody = z.infer<typeof localAuthenticateRequestSchema>;

export type OAuthAuthenticateRequestBody = z.infer<typeof oauthAuthenticateRequestSchema>;

export type VerifyEmailRequestBody = z.infer<typeof verifyEmailRequestSchema>;

export type ResendVerificationEmailRequestBody = z.infer<
  typeof resendVerificationEmailRequestSchema
>;

export type UnlockLocalLoginRequestBody = z.infer<typeof unlockLocalLoginRequestSchema>;

export type ResendUnlockLocalLoginRequestBody = z.infer<
  typeof resendUnlockLocalLoginRequestSchema
>;

export type RefreshRequestBody = z.infer<typeof refreshRequestSchema>;

export type RemoveKnownDeviceRequestBody = z.infer<typeof removeKnownDeviceRequestSchema>;

export type ForgotPasswordRequestBody = z.infer<typeof forgotPasswordRequestSchema>;

export type ResendForgotPasswordRequestBody = z.infer<typeof resendForgotPasswordRequestSchema>;

export type ResetPasswordRequestBody = z.infer<typeof resetPasswordRequestSchema>;

export type ChangePasswordRequestBody = z.infer<typeof changePasswordRequestSchema>;

export interface LocalAuthenticateInput {
  client: ClientRequestContext;
  email: string;
  password: string;
  deviceId?: string;
}

export interface LocalSignupInput {
  client: ClientRequestContext;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  deviceId?: string;
}

export interface OAuthAuthenticateInput {
  client: ClientRequestContext;
  code?: string;
  codeVerifier?: string;
  idToken?: string;
  nonce: string;
  deviceId?: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifyEmailInput {
  client: ClientRequestContext;
  email: string;
  code: string;
  deviceId?: string;
}

export interface ResendVerificationEmailInput {
  email: string;
}

export interface UnlockLocalLoginInput {
  email: string;
  code: string;
}

export interface ResendUnlockLocalLoginInput {
  email: string;
}

export interface RefreshInput {
  client: ClientRequestContext;
  refreshToken?: string;
}

export interface RemoveKnownDeviceInput {
  userId: string;
  deviceId: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResendForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  client: ClientRequestContext;
  email: string;
  code: string;
  newPassword: string;
  deviceId?: string;
}

export interface ChangePasswordInput {
  userId: string;
  client: ClientRequestContext;
  currentPassword: string;
  newPassword: string;
  deviceId?: string;
}

export interface CreateLocalUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface UserProfileRecord {
  id: string;
  userId: string;
  username: string;
  phoneNumber?: string;
  avatarUrl?: string;
  avatarBlobName?: string;
  isPrivate: boolean;
  trustworthinessScore: number;
  rentPostingsCount: number;
  availableRentPostingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  tokenVersion: number;
  firstName?: string;
  lastName?: string;
  role: string;
  emailVerified: boolean;
  profile: UserProfileRecord;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username: string;
  phoneNumber?: string;
  avatarUrl?: string;
  isPrivate: boolean;
  trustworthinessScore: number;
  rentPostingsCount: number;
  availableRentPostingsCount: number;
  role: string;
  emailVerified: boolean;
}

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  device: {
    deviceId?: string;
    known: boolean;
    knownByIp: boolean;
  };
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
