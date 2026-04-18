import bcrypt from "bcrypt";
import type { ClientRequestContext } from "@/configuration/http/bindings";
import BadRequestError from "@/errors/http/bad-request.error";
import ConflictError from "@/errors/http/conflict.error";
import LockedError from "@/errors/http/locked.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { DeviceService } from "@/features/auth/device/device.service";
import type { CacheService } from "@/features/cache/cache.service";
import { EmailService } from "@/features/email/email.service";
import { AuthRepository } from "@/features/auth/auth.repository";
import {
  type AuthSessionResult,
  type SignupVerificationPendingResult,
  type AuthUserProfile,
  type AuthUserRecord,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LocalAuthenticateInput,
  type LocalSignupInput,
  type OAuthAuthenticateInput,
  type RefreshInput,
  type ResetPasswordInput,
  type RemoveKnownDeviceInput,
  type ResendForgotPasswordInput,
  type ResendUnlockLocalLoginInput,
  type ResendVerificationEmailInput,
  type VerifyEmailInput,
  type UnlockLocalLoginInput,
} from "@/features/auth/auth.model";
import { OtpService } from "@/features/auth/otp/otp.service";
import { AppleOAuthService } from "@/features/auth/oauth/apple.service";
import { GoogleOAuthService } from "@/features/auth/oauth/google.service";
import { MicrosoftOAuthService } from "@/features/auth/oauth/microsoft.service";
import type { VerifiedOAuthProfile } from "@/features/auth/oauth/oauth.types";
import { TokenService, type JwtClaims } from "@/features/auth/token/token.service";

interface AuthRequestContext {
  auth: JwtClaims;
  client: ClientRequestContext;
  refreshToken?: string;
}

const BCRYPT_SALT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH =
  "$2b$12$1M7NQyWNh5v3NFg4cTQdUeVUI5BvR9f0vAOVeI3E1FQfQ0rFJz0Vy";
const MAX_FAILED_LOCAL_LOGIN_ATTEMPTS = 5;
const LOCAL_LOGIN_ATTEMPT_TTL_IN_SECONDS = 15 * 60;
const LOCAL_LOGIN_LOCK_TTL_IN_SECONDS = 30 * 60;
const LOCAL_LOGIN_UNLOCK_OTP_PURPOSE = "local-login-unlock";
const LOCAL_PASSWORD_RESET_OTP_PURPOSE = "local-password-reset";

interface LocalLoginAttemptRecord {
  failedAttempts: number;
  lockedAt?: string;
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly deviceService: DeviceService,
    private readonly emailService: EmailService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly microsoftOAuthService: MicrosoftOAuthService,
    private readonly appleOAuthService: AppleOAuthService,
    private readonly cacheService: CacheService,
  ) {}

  async localAuthenticate(input: LocalAuthenticateInput): Promise<AuthSessionResult> {
    const user = await this.authRepository.findUserByEmail(input.email);
    const isPasswordValid = await this.verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    const loginAttemptRecord = await this.getLocalLoginAttemptRecord(input.email);

    if (loginAttemptRecord?.lockedAt) {
      await this.sendLocalLoginUnlockCode(user);
      throw new LockedError("This sign-in is locked. Use the code we emailed you to unlock it.", {
        email: input.email,
        unlockRequired: true,
      });
    }

    if (!user || !isPasswordValid) {
      const updatedAttemptRecord = await this.recordFailedLocalLoginAttempt(input.email);

      if (updatedAttemptRecord.lockedAt) {
        await this.sendLocalLoginUnlockCode(user);
        throw new LockedError(
          "This sign-in is locked. Use the code we emailed you to unlock it.",
          {
            email: input.email,
            unlockRequired: true,
          },
        );
      }

      throw new UnauthorizedError("Invalid email or password.");
    }

    await this.clearLocalLoginAttemptRecord(input.email);

    if (!user.emailVerified) {
      throw new UnauthorizedError("Please verify your email address before signing in.");
    }

    return this.authenticateVerifiedUser(user, input);
  }

  async localSignup(input: LocalSignupInput): Promise<SignupVerificationPendingResult> {
    const existingUser = await this.authRepository.findUserByEmail(input.email);

    if (existingUser) {
      if (!existingUser.emailVerified) {
        return {
          verificationRequired: true,
          email: existingUser.email,
          alreadyPending: true,
        };
      }

      throw new ConflictError("An account with this email already exists.");
    }

    const passwordHash = await this.hashPassword(input.password);
    const user = await this.authRepository.createLocalUser(
      {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      },
      passwordHash,
    );

    await this.deviceService.registerKnownDevice(user, input.client, input.deviceId);
    await this.sendVerificationCode(user);

    return {
      verificationRequired: true,
      email: user.email,
      alreadyPending: false,
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{
    accepted: true;
  }> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (user && this.isEligibleForLocalPasswordManagement(user)) {
      await this.sendPasswordResetCode(user);
    }

    return {
      accepted: true,
    };
  }

  async resendForgotPassword(input: ResendForgotPasswordInput): Promise<{
    accepted: true;
  }> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (user && this.isEligibleForLocalPasswordManagement(user)) {
      await this.sendPasswordResetCode(user);
    }

    return {
      accepted: true,
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<AuthSessionResult> {
    await this.otpService.verify({
      purpose: LOCAL_PASSWORD_RESET_OTP_PURPOSE,
      subject: input.email,
      code: input.code,
    });

    const user = await this.authRepository.findUserByEmail(input.email);
    const eligibleUser = this.requireEligibleLocalPasswordUser(
      user,
      "This account cannot reset a password.",
    );
    const passwordHash = await this.hashPassword(input.newPassword);

    await this.rejectIfPasswordMatchesCurrent(input.newPassword, eligibleUser.passwordHash);
    await this.authRepository.updatePasswordHash(eligibleUser.id, passwordHash);
    const nextTokenVersion = await this.authRepository.rotateTokenVersion(eligibleUser.id);
    await this.clearLocalLoginAttemptRecord(eligibleUser.email);

    const updatedUser: AuthUserRecord = {
      ...eligibleUser,
      passwordHash,
      tokenVersion: nextTokenVersion,
    };
    const deviceStatus = await this.deviceService.registerKnownDevice(
      updatedUser,
      input.client,
      input.deviceId,
    );

    return this.issueTokensForUser(updatedUser, deviceStatus, input.deviceId);
  }

  async verifyEmail(input: VerifyEmailInput): Promise<AuthSessionResult> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user) {
      throw new BadRequestError("Account could not be found for email verification.");
    }

    if (user.emailVerified) {
      throw new ConflictError("Email address has already been verified.");
    }

    await this.otpService.verify({
      purpose: "email-verification",
      subject: user.email,
      code: input.code,
    });

    await this.authRepository.markEmailVerified(user.id);

    const verifiedUser: AuthUserRecord = {
      ...user,
      emailVerified: true,
    };

    return this.issueTokensForUser(
      verifiedUser,
      await this.deviceService.registerKnownDevice(verifiedUser, input.client, input.deviceId),
      input.deviceId,
    );
  }

  async resendVerificationEmail(input: ResendVerificationEmailInput): Promise<{
    resent: true;
    email: string;
  }> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user) {
      throw new BadRequestError("Account could not be found for email verification.");
    }

    if (user.emailVerified) {
      throw new ConflictError("Email address has already been verified.");
    }

    await this.sendVerificationCode(user);

    return {
      resent: true,
      email: user.email,
    };
  }

  async changePassword(input: ChangePasswordInput): Promise<AuthSessionResult> {
    const user = this.requireEligibleLocalPasswordUser(
      await this.authRepository.findUserById(input.userId),
      "This account cannot change a password.",
    );
    const isPasswordValid = await this.verifyPassword(input.currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Current password is incorrect.");
    }

    await this.rejectIfPasswordMatchesCurrent(input.newPassword, user.passwordHash);

    const passwordHash = await this.hashPassword(input.newPassword);
    await this.authRepository.updatePasswordHash(user.id, passwordHash);
    const nextTokenVersion = await this.authRepository.rotateTokenVersion(user.id);
    await this.clearLocalLoginAttemptRecord(user.email);

    const updatedUser: AuthUserRecord = {
      ...user,
      passwordHash,
      tokenVersion: nextTokenVersion,
    };
    const deviceStatus = await this.deviceService.registerKnownDevice(
      updatedUser,
      input.client,
      input.deviceId,
    );

    return this.issueTokensForUser(updatedUser, deviceStatus, input.deviceId);
  }

  async unlockLocalLogin(input: UnlockLocalLoginInput): Promise<{
    unlocked: true;
    email: string;
  }> {
    await this.otpService.verify({
      purpose: LOCAL_LOGIN_UNLOCK_OTP_PURPOSE,
      subject: input.email,
      code: input.code,
    });

    await this.clearLocalLoginAttemptRecord(input.email);

    return {
      unlocked: true,
      email: input.email,
    };
  }

  async resendUnlockLocalLogin(input: ResendUnlockLocalLoginInput): Promise<{
    resent: true;
    email: string;
  }> {
    const isLocked = await this.isLocalLoginLocked(input.email);

    if (!isLocked) {
      return {
        resent: true,
        email: input.email,
      };
    }

    const user = await this.authRepository.findUserByEmail(input.email);
    await this.sendLocalLoginUnlockCode(user);

    return {
      resent: true,
      email: input.email,
    };
  }

  async localVerify(context: AuthRequestContext): Promise<{
    verified: true;
    auth: {
      userId: string;
      deviceId?: string;
      role?: string;
    };
    client: ClientRequestContext;
  }> {
    return {
      verified: true,
      auth: {
        userId: context.auth.sub,
        deviceId: context.auth.deviceId,
        role: context.auth.role,
      },
      client: context.client,
    };
  }

  async googleAuthenticate(input: OAuthAuthenticateInput): Promise<AuthSessionResult> {
    const profile = await this.googleOAuthService.verify(input);
    return this.authenticateOAuthProfile(profile, input);
  }

  async microsoftAuthenticate(input: OAuthAuthenticateInput): Promise<AuthSessionResult> {
    const profile = await this.microsoftOAuthService.verify(input);
    return this.authenticateOAuthProfile(profile, input);
  }

  async appleAuthenticate(input: OAuthAuthenticateInput): Promise<AuthSessionResult> {
    const profile = await this.appleOAuthService.verify(input);
    return this.authenticateOAuthProfile(profile, input);
  }

  async refresh(input: RefreshInput): Promise<AuthSessionResult> {
    if (!input.refreshToken) {
      throw new UnauthorizedError("Refresh token is required.");
    }

    const claims = await this.tokenService.verifyRefreshToken(input.refreshToken);
    const user = await this.requireExistingUser(claims.sub);
    const deviceId = claims.deviceId ?? input.client.device.id;
    const deviceStatus = await this.deviceService.registerKnownDevice(user, input.client, deviceId);

    return this.issueTokensForUser(user, deviceStatus, deviceId);
  }

  async logout(context: AuthRequestContext): Promise<{
    loggedOut: true;
    auth: {
      userId: string;
      deviceId?: string;
    };
    client: ClientRequestContext;
  }> {
    if (context.refreshToken) {
      await this.tokenService.revokeRefreshToken(context.refreshToken);
    }

    await this.authRepository.rotateTokenVersion(context.auth.sub);

    return {
      loggedOut: true,
      auth: {
        userId: context.auth.sub,
        deviceId: context.auth.deviceId,
      },
      client: context.client,
    };
  }

  async deviceVerify(context: AuthRequestContext): Promise<{
    verified: true;
    device: ClientRequestContext["device"] & {
      known: boolean;
      knownByIp: boolean;
      deviceId?: string;
    };
    auth: {
      userId: string;
      tokenDeviceId?: string;
    };
  }> {
    const user = await this.requireExistingUser(context.auth.sub);
    const deviceStatus = await this.deviceService.registerKnownDevice(
      user,
      context.client,
      context.auth.deviceId ?? context.client.device.id,
    );

    return {
      verified: true,
      device: {
        ...context.client.device,
        known: deviceStatus.known,
        knownByIp: deviceStatus.knownByIp,
        deviceId: deviceStatus.deviceId,
      },
      auth: {
        userId: context.auth.sub,
        tokenDeviceId: context.auth.deviceId,
      },
    };
  }

  async devices(context: AuthRequestContext): Promise<{
    devices: Array<{
      id: string;
      current: boolean;
      deviceId: string;
      type: string;
      platform?: string;
      userAgent?: string;
      lastIpAddress?: string;
      firstSeenAt: string;
      lastSeenAt: string;
      verifiedAt: string;
    }>;
  }> {
    const knownDevices = await this.deviceService.listKnownDevices(
      context.auth.sub,
      context.auth.deviceId,
    );

    return {
      devices: knownDevices.map((device) => ({
        id: device.id,
        current: device.current,
        deviceId: device.deviceId,
        type: device.type,
        platform: device.platform,
        userAgent: device.userAgent,
        lastIpAddress: device.lastIpAddress,
        firstSeenAt: device.firstSeenAt,
        lastSeenAt: device.lastSeenAt,
        verifiedAt: device.verifiedAt,
      })),
    };
  }

  async removeKnownDevice(input: RemoveKnownDeviceInput): Promise<{
    removed: true;
    deviceId: string;
  }> {
    await this.deviceService.removeKnownDevice(input.userId, input.deviceId);

    return {
      removed: true,
      deviceId: input.deviceId,
    };
  }

  private async issueTokensForUser(
    user: AuthUserRecord,
    deviceStatus: { deviceId?: string; known: boolean; knownByIp: boolean },
    deviceId?: string,
  ): Promise<AuthSessionResult> {
    const accessToken = this.tokenService.createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      deviceId,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = await this.tokenService.createRefreshToken({
      sub: user.id,
      deviceId,
      tokenVersion: user.tokenVersion,
    });

    return {
      accessToken,
      refreshToken,
      device: deviceStatus,
      user: this.toUserProfile(user),
    };
  }

  private async authenticateOAuthProfile(
    profile: VerifiedOAuthProfile,
    input: OAuthAuthenticateInput,
  ): Promise<AuthSessionResult> {
    if (!profile.emailVerified) {
      throw new Error("OAuth account email must be verified.");
    }

    const existingUser = await this.authRepository.findUserByEmail(profile.email);
    const user = existingUser ?? (await this.authRepository.createOAuthUser(profile));

    return this.authenticateVerifiedUser(user, input);
  }

  private async hashPassword(password: string): Promise<string> {
    this.assertValidPassword(password);
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return this.isBcryptHash(passwordHash)
      ? bcrypt.compare(password, passwordHash)
      : this.verifyPasswordAgainstFakeHash(password);
  }

  private async verifyPasswordAgainstFakeHash(password: string): Promise<boolean> {
    return bcrypt.compare(password, DUMMY_PASSWORD_HASH);
  }

  private async rejectIfPasswordMatchesCurrent(
    password: string,
    passwordHash: string,
  ): Promise<void> {
    const matchesCurrentPassword = await this.verifyPassword(password, passwordHash);

    if (matchesCurrentPassword) {
      throw new ConflictError("New password must be different from the current password.");
    }
  }

  private assertValidPassword(password: string): void {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }
  }

  private isBcryptHash(passwordHash: string): boolean {
    return /^\$2[aby]\$\d{2}\$/.test(passwordHash);
  }

  private toUserProfile(user: AuthUserRecord): AuthUserProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.profile.username,
      phoneNumber: user.profile.phoneNumber,
      avatarUrl: user.profile.avatarUrl,
      isPrivate: user.profile.isPrivate,
      trustworthinessScore: user.profile.trustworthinessScore,
      rentPostingsCount: user.profile.rentPostingsCount,
      availableRentPostingsCount: user.profile.availableRentPostingsCount,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  private async sendVerificationCode(user: AuthUserRecord): Promise<void> {
    const issuedOtp = await this.otpService.issue({
      purpose: "email-verification",
      subject: user.email,
    });

    await this.emailService.sendVerificationEmail({
      to: user.email,
      verificationCode: issuedOtp.code,
      firstName: user.firstName,
    });
  }

  private async sendPasswordResetCode(user: AuthUserRecord): Promise<void> {
    try {
      const issuedOtp = await this.otpService.issue({
        purpose: LOCAL_PASSWORD_RESET_OTP_PURPOSE,
        subject: user.email,
      });

      await this.emailService.sendPasswordResetEmail({
        to: user.email,
        resetCode: issuedOtp.code,
        firstName: user.firstName,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TooManyRequestError") {
        return;
      }

      throw error;
    }
  }

  private async authenticateVerifiedUser(
    user: AuthUserRecord,
    input: { deviceId?: string; client: ClientRequestContext },
  ): Promise<AuthSessionResult> {
    const deviceStatus = await this.deviceService.evaluateSuccessfulAuthentication(
      user,
      input.client,
      input.deviceId,
    );

    return this.issueTokensForUser(user, deviceStatus, input.deviceId);
  }

  private getLocalLoginAttemptKey(email: string): string {
    return `auth:local-login-attempts:${email.toLowerCase()}`;
  }

  private async getLocalLoginAttemptRecord(
    email: string,
  ): Promise<LocalLoginAttemptRecord | null> {
    return this.cacheService.getJson<LocalLoginAttemptRecord>(this.getLocalLoginAttemptKey(email));
  }

  private async recordFailedLocalLoginAttempt(email: string): Promise<LocalLoginAttemptRecord> {
    const existingRecord = await this.getLocalLoginAttemptRecord(email);
    const nextFailedAttempts = (existingRecord?.failedAttempts ?? 0) + 1;
    const nextRecord: LocalLoginAttemptRecord =
      nextFailedAttempts >= MAX_FAILED_LOCAL_LOGIN_ATTEMPTS
        ? {
            failedAttempts: nextFailedAttempts,
            lockedAt: new Date().toISOString(),
          }
        : {
            failedAttempts: nextFailedAttempts,
          };

    await this.cacheService.setJson(
      this.getLocalLoginAttemptKey(email),
      nextRecord,
      nextRecord.lockedAt
        ? LOCAL_LOGIN_LOCK_TTL_IN_SECONDS
        : LOCAL_LOGIN_ATTEMPT_TTL_IN_SECONDS,
    );

    return nextRecord;
  }

  private async clearLocalLoginAttemptRecord(email: string): Promise<void> {
    await this.cacheService.delete(this.getLocalLoginAttemptKey(email));
  }

  private async isLocalLoginLocked(email: string): Promise<boolean> {
    const record = await this.getLocalLoginAttemptRecord(email);
    return Boolean(record?.lockedAt);
  }

  private async sendLocalLoginUnlockCode(user: AuthUserRecord | null): Promise<void> {
    if (!user) {
      return;
    }

    try {
      const issuedOtp = await this.otpService.issue({
        purpose: LOCAL_LOGIN_UNLOCK_OTP_PURPOSE,
        subject: user.email,
      });

      await this.emailService.sendLoginUnlockEmail({
        to: user.email,
        unlockCode: issuedOtp.code,
        firstName: user.firstName,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TooManyRequestError") {
        return;
      }

      throw error;
    }
  }

  private isEligibleForLocalPasswordManagement(user: AuthUserRecord): boolean {
    return user.emailVerified && this.isLocalPasswordAccount(user);
  }

  private isLocalPasswordAccount(user: AuthUserRecord): boolean {
    return !user.passwordHash.startsWith("oauth:");
  }

  private requireEligibleLocalPasswordUser(
    user: AuthUserRecord | null,
    defaultMessage: string,
  ): AuthUserRecord {
    if (!user) {
      throw new BadRequestError(defaultMessage);
    }

    if (!this.isLocalPasswordAccount(user)) {
      throw new ConflictError(
        "This account uses a social sign-in provider. Use that provider to access your account.",
      );
    }

    if (!user.emailVerified) {
      throw new ConflictError("Please verify your email address before managing your password.");
    }

    return user;
  }

  private async requireExistingUser(userId: string): Promise<AuthUserRecord> {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new BadRequestError("User account could not be found.");
    }

    return user;
  }
}
