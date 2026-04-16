import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { ClientRequestContext } from "@/configuration/http/bindings";
import BadRequestError from "@/errors/http/bad-request.error";
import ConflictError from "@/errors/http/conflict.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { DeviceService } from "@/features/auth/device/device.service";
import { EmailService } from "@/features/email/email.service";
import { AuthRepository } from "@/features/auth/auth.repository";
import {
  type AuthSessionResult,
  type SignupVerificationPendingResult,
  type AuthUserProfile,
  type AuthUserRecord,
  type LocalAuthenticateInput,
  type LocalSignupInput,
  type OAuthAuthenticateInput,
  type RemoveKnownDeviceInput,
  type ResendVerificationEmailInput,
  type VerifyEmailInput,
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
}

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_KEY_LENGTH = 64;

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
  ) {}

  async localAuthenticate(input: LocalAuthenticateInput): Promise<AuthSessionResult> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

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

    await this.sendVerificationCode(user);

    return {
      verificationRequired: true,
      email: user.email,
      alreadyPending: false,
    };
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

  async refresh(): Promise<{ refreshed: true }> {
    return {
      refreshed: true,
    };
  }

  async logout(context: AuthRequestContext): Promise<{
    loggedOut: true;
    auth: {
      userId: string;
      deviceId?: string;
    };
    client: ClientRequestContext;
  }> {
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
    });

    const refreshToken = await this.tokenService.createRefreshToken({
      sub: user.id,
      deviceId,
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

    const salt = randomBytes(16).toString("base64url");
    const derivedKey = (await scrypt(password, salt, PASSWORD_HASH_KEY_LENGTH)) as Buffer;

    return `${salt}:${derivedKey.toString("base64url")}`;
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const [salt, storedHash] = passwordHash.split(":");

    if (!salt || !storedHash) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, PASSWORD_HASH_KEY_LENGTH)) as Buffer;
    const storedHashBuffer = Buffer.from(storedHash, "base64url");

    if (derivedKey.length !== storedHashBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedHashBuffer);
  }

  private assertValidPassword(password: string): void {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }
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

  private async requireExistingUser(userId: string): Promise<AuthUserRecord> {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new BadRequestError("User account could not be found.");
    }

    return user;
  }
}
