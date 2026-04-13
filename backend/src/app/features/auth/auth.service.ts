import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { ClientRequestContext } from "@/configuration/http/bindings";
import { AuthRepository } from "@/features/auth/auth.repository";
import {
  type AuthSessionRecord,
  type AuthTokenPairResponse,
  type AuthUserProfile,
  type AuthUserRecord,
  type LocalAuthenticateRequest,
  type LocalSignupRequest,
} from "@/features/auth/auth.model";
import { TokenService, type JwtClaims } from "@/features/auth/token/token.service";

interface AuthServiceOptions {
  authRepository: AuthRepository;
  tokenService: TokenService;
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
  ) {}

  static create(options: AuthServiceOptions): AuthService {
    return new AuthService(options.authRepository, options.tokenService);
  }

  async localAuthenticate(input: LocalAuthenticateRequest): Promise<AuthTokenPairResponse> {
    const email = this.normalizeEmail(input.email);
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password.");
    }

    return this.issueTokensForUser(user, input.deviceId);
  }

  async localSignup(input: LocalSignupRequest): Promise<AuthTokenPairResponse> {
    const email = this.normalizeEmail(input.email);
    const existingUser = await this.authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new Error("An account with this email already exists.");
    }

    const passwordHash = await this.hashPassword(input.password);
    const user = await this.authRepository.createLocalUser(
      {
        ...input,
        email,
      },
      passwordHash,
    );

    return this.issueTokensForUser(user, input.deviceId);
  }

  async localVerify(context: AuthRequestContext): Promise<{
    verified: true;
    session: {
      userId: string;
      sessionId?: string;
      deviceId?: string;
      role?: string;
    };
    client: ClientRequestContext;
  }> {
    return {
      verified: true,
      session: {
        userId: context.auth.sub,
        sessionId: context.auth.sessionId,
        deviceId: context.auth.deviceId,
        role: context.auth.role,
      },
      client: context.client,
    };
  }

  async googleAuthenticate(): Promise<AuthTokenPairResponse> {
    throw new Error("Google authentication is not implemented yet.");
  }

  async microsoftAuthenticate(): Promise<AuthTokenPairResponse> {
    throw new Error("Microsoft authentication is not implemented yet.");
  }

  async appleAuthenticate(): Promise<AuthTokenPairResponse> {
    throw new Error("Apple authentication is not implemented yet.");
  }

  async refresh(): Promise<{ refreshed: true }> {
    return {
      refreshed: true,
    };
  }

  async logout(context: AuthRequestContext): Promise<{
    loggedOut: true;
    session: {
      userId: string;
      sessionId?: string;
    };
    client: ClientRequestContext;
  }> {
    return {
      loggedOut: true,
      session: {
        userId: context.auth.sub,
        sessionId: context.auth.sessionId,
      },
      client: context.client,
    };
  }

  async deviceVerify(context: AuthRequestContext): Promise<{
    verified: true;
    device: ClientRequestContext["device"];
    session: {
      userId: string;
      sessionId?: string;
      tokenDeviceId?: string;
    };
  }> {
    return {
      verified: true,
      device: context.client.device,
      session: {
        userId: context.auth.sub,
        sessionId: context.auth.sessionId,
        tokenDeviceId: context.auth.deviceId,
      },
    };
  }

  async devices(context: AuthRequestContext): Promise<{
    devices: Array<{
      current: true;
      sessionId?: string;
      tokenDeviceId?: string;
      detectedDevice: ClientRequestContext["device"];
      ip?: string;
    }>;
  }> {
    return {
      devices: [
        {
          current: true,
          sessionId: context.auth.sessionId,
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
  ): Promise<AuthTokenPairResponse> {
    const session = await this.authRepository.createSession(user, deviceId);

    const accessToken = this.tokenService.createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.sessionId,
      deviceId: session.deviceId,
    });

    const refreshToken = await this.tokenService.createRefreshToken({
      sub: user.id,
      sessionId: session.sessionId,
      deviceId: session.deviceId,
    });

    return {
      accessToken,
      refreshToken,
      session,
      user: this.toUserProfile(user),
    };
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

  private normalizeEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("A valid email is required.");
    }

    return normalizedEmail;
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
}
