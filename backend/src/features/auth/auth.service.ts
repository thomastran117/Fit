import { AuthRepository, type AuthSessionRecord } from "@/features/auth/auth.repository.js";
import { TokenService } from "@/features/auth/token/token.service.js";

interface AuthServiceOptions {
  authRepository: AuthRepository;
  tokenService: TokenService;
}

interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  session: AuthSessionRecord;
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
  ) {}

  static create(options: AuthServiceOptions): AuthService {
    return new AuthService(options.authRepository, options.tokenService);
  }

  async localAuthenticate(): Promise<AuthTokenPair> {
    return this.issueTokensForUser("local-user");
  }

  async localSignup(): Promise<AuthTokenPair> {
    return this.issueTokensForUser("signup-user");
  }

  async localVerify(): Promise<{ verified: true }> {
    return {
      verified: true,
    };
  }

  async googleAuthenticate(): Promise<AuthTokenPair> {
    return this.issueTokensForUser("google-user");
  }

  async microsoftAuthenticate(): Promise<AuthTokenPair> {
    return this.issueTokensForUser("microsoft-user");
  }

  async appleAuthenticate(): Promise<AuthTokenPair> {
    return this.issueTokensForUser("apple-user");
  }

  async refresh(): Promise<{ refreshed: true }> {
    return {
      refreshed: true,
    };
  }

  async logout(): Promise<{ loggedOut: true }> {
    return {
      loggedOut: true,
    };
  }

  async deviceVerify(): Promise<{ verified: true }> {
    return {
      verified: true,
    };
  }

  async devices(): Promise<{ devices: never[] }> {
    return {
      devices: [],
    };
  }

  private async issueTokensForUser(userId: string): Promise<AuthTokenPair> {
    const session =
      (await this.authRepository.findSessionByUserId(userId)) ?? {
        userId,
        sessionId: `session:${userId}`,
      };

    const accessToken = this.tokenService.createAccessToken({
      sub: session.userId,
      email: session.email,
      role: session.role,
      sessionId: session.sessionId,
      deviceId: session.deviceId,
    });

    const refreshToken = await this.tokenService.createRefreshToken({
      sub: session.userId,
      sessionId: session.sessionId,
      deviceId: session.deviceId,
    });

    return {
      accessToken,
      refreshToken,
      session,
    };
  }
}
