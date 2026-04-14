import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { ClientRequestContext } from "@/configuration/http/bindings";
import BadRequestError from "@/errors/http/bad-request.error";
import ConflictError from "@/errors/http/conflict.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";
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
  type ResendVerificationEmailInput,
  type VerifyEmailInput,
} from "@/features/auth/auth.model";
import { OtpService } from "@/features/auth/otp/otp.service";
import { AppleOAuthService } from "@/features/auth/oauth/apple.service";
import { GoogleOAuthService } from "@/features/auth/oauth/google.service";
import { MicrosoftOAuthService } from "@/features/auth/oauth/microsoft.service";
import type { VerifiedOAuthProfile } from "@/features/auth/oauth/oauth.types";
import { TokenService, type JwtClaims } from "@/features/auth/token/token.service";

interface AuthServiceOptions {
  authRepository: AuthRepository;
  tokenService: TokenService;
  otpService: OtpService;
  emailService: EmailService;
  googleOAuthService?: GoogleOAuthService;
  microsoftOAuthService?: MicrosoftOAuthService;
  appleOAuthService?: AppleOAuthService;
}

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
    private readonly emailService: EmailService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly microsoftOAuthService: MicrosoftOAuthService,
    private readonly appleOAuthService: AppleOAuthService,
  ) {}

  static create(options: AuthServiceOptions): AuthService {
    return new AuthService(
      options.authRepository,
      options.tokenService,
      options.otpService,
      options.emailService,
      options.googleOAuthService ?? new GoogleOAuthService(),
      options.microsoftOAuthService ?? new MicrosoftOAuthService(),
      options.appleOAuthService ?? new AppleOAuthService(),
    );
  }

  async localAuthenticate(input: LocalAuthenticateInput): Promise<AuthSessionResult> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password.");
    }

    if (!user.emailVerified) {
      throw new UnauthorizedError("Please verify your email address before signing in.");
    }

    return this.issueTokensForUser(user, input.deviceId);
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

    return this.issueTokensForUser(
      {
        ...user,
        emailVerified: true,
      },
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
    return this.authenticateOAuthProfile(profile, input.deviceId);
  }

  async microsoftAuthenticate(input: OAuthAuthenticateInput): Promise<AuthSessionResult> {
    const profile = await this.microsoftOAuthService.verify(input);
    return this.authenticateOAuthProfile(profile, input.deviceId);
  }

  async appleAuthenticate(input: OAuthAuthenticateInput): Promise<AuthSessionResult> {
    const profile = await this.appleOAuthService.verify(input);
    return this.authenticateOAuthProfile(profile, input.deviceId);
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
    device: ClientRequestContext["device"];
    auth: {
      userId: string;
      tokenDeviceId?: string;
    };
  }> {
    return {
      verified: true,
      device: context.client.device,
      auth: {
        userId: context.auth.sub,
        tokenDeviceId: context.auth.deviceId,
      },
    };
  }

  async devices(context: AuthRequestContext): Promise<{
    devices: Array<{
      current: true;
      tokenDeviceId?: string;
      detectedDevice: ClientRequestContext["device"];
      ip?: string;
    }>;
  }> {
    return {
      devices: [
        {
          current: true,
          tokenDeviceId: context.auth.deviceId,
          detectedDevice: context.client.device,
          ip: context.client.ip,
        },
      ],
    };
  }

  private async issueTokensForUser(
    user: AuthUserRecord,
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
      user: this.toUserProfile(user),
    };
  }

  private async authenticateOAuthProfile(
    profile: VerifiedOAuthProfile,
    deviceId?: string,
  ): Promise<AuthSessionResult> {
    if (!profile.emailVerified) {
      throw new Error("OAuth account email must be verified.");
    }

    const existingUser = await this.authRepository.findUserByEmail(profile.email);
    const user = existingUser ?? (await this.authRepository.createOAuthUser(profile));

    return this.issueTokensForUser(user, deviceId);
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
}
