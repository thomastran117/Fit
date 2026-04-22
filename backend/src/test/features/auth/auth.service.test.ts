import bcrypt from "bcrypt";
import BadRequestError from "@/errors/http/bad-request.error";
import ConflictError from "@/errors/http/conflict.error";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { AuthService } from "@/features/auth/auth.service";
import type { AuthUserRecord } from "@/features/auth/auth.model";

function createUser(): AuthUserRecord {
  return {
    id: "user-1",
    email: "user@example.com",
    passwordHash: "",
    tokenVersion: 2,
    firstName: "Test",
    lastName: "User",
    role: "user",
    emailVerified: true,
    profile: {
      id: "profile-1",
      userId: "user-1",
      username: "test-user",
      phoneNumber: undefined,
      avatarUrl: undefined,
      avatarBlobName: undefined,
      isPrivate: false,
      trustworthinessScore: 80,
      rentPostingsCount: 0,
      availableRentPostingsCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createClient() {
  return {
    ip: "127.0.0.1",
    device: {
      id: "device-1",
      type: "desktop" as const,
      isMobile: false,
    },
  };
}

function createService(overrides?: {
  findUserByEmail?: (email: string) => Promise<AuthUserRecord | null>;
  findUserById?: (userId: string) => Promise<AuthUserRecord | null>;
  createLocalUser?: (
    input: { email: string; firstName?: string; lastName?: string },
    passwordHash: string,
  ) => Promise<AuthUserRecord>;
  createOAuthUser?: (profile: {
    email: string;
    provider: string;
    providerUserId: string;
    emailVerified: boolean;
    firstName?: string;
    lastName?: string;
  }) => Promise<AuthUserRecord>;
  markEmailVerified?: (userId: string) => Promise<void>;
  updatePasswordHash?: (userId: string, passwordHash: string) => Promise<void>;
  rotateTokenVersion?: (userId: string) => Promise<number>;
  verifyRefreshToken?: (token: string) => Promise<{ sub: string; deviceId?: string; rememberMe?: boolean }>;
  createRefreshToken?: (payload: Record<string, unknown>, options?: { expiresInSeconds?: number }) => Promise<string>;
  getRefreshTokenExpiresInSeconds?: (rememberMe?: boolean) => number;
  revokeRefreshToken?: (token: string) => Promise<boolean>;
  evaluateSuccessfulAuthentication?: () => Promise<{ deviceId?: string; known: boolean; knownByIp: boolean }>;
  registerKnownDevice?: () => Promise<{ deviceId?: string; known: boolean; knownByIp: boolean }>;
  listKnownDevices?: (userId: string, currentDeviceId?: string) => Promise<Array<{
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
  }>>;
  removeKnownDevice?: (userId: string, deviceId: string) => Promise<void>;
  registerKnownDevice?: (
    user: AuthUserRecord,
    client: ReturnType<typeof createClient>,
    deviceId: string,
  ) => Promise<{ deviceId?: string; known: boolean; knownByIp: boolean }>;
  issueOtp?: (input: { purpose: string; subject: string }) => Promise<{ code: string }>;
  verifyOtp?: (input: { purpose: string; subject: string; code: string }) => Promise<void>;
  sendVerificationEmail?: (input: {
    to: string;
    verificationCode: string;
    firstName?: string;
  }) => Promise<void>;
  sendPasswordResetEmail?: (input: {
    to: string;
    resetCode: string;
    firstName?: string;
  }) => Promise<void>;
  sendLoginUnlockEmail?: (input: {
    to: string;
    unlockCode: string;
    firstName?: string;
  }) => Promise<void>;
  verifyGoogle?: (input: unknown) => Promise<{
    email: string;
    provider: string;
    providerUserId: string;
    emailVerified: boolean;
    firstName?: string;
    lastName?: string;
  }>;
}) {
  const authRepository = {
    findUserByEmail: overrides?.findUserByEmail ?? (async () => null),
    findUserById: overrides?.findUserById ?? (async () => null),
    createLocalUser:
      overrides?.createLocalUser ??
      (async (input) => ({
        ...createUser(),
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      })),
    createOAuthUser:
      overrides?.createOAuthUser ??
      (async (profile) => ({
        ...createUser(),
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      })),
    markEmailVerified: overrides?.markEmailVerified ?? (async () => {}),
    updatePasswordHash: overrides?.updatePasswordHash ?? (async () => {}),
    rotateTokenVersion: overrides?.rotateTokenVersion ?? (async () => 3),
  };
  const tokenService = {
    createAccessToken: () => "access-token",
    createRefreshToken: overrides?.createRefreshToken ?? (async () => "refresh-token"),
    getRefreshTokenExpiresInSeconds:
      overrides?.getRefreshTokenExpiresInSeconds ??
      ((rememberMe = false) => (rememberMe ? 777 : 333)),
    verifyRefreshToken:
      overrides?.verifyRefreshToken ??
      (async () => ({
        sub: "user-1",
        deviceId: "device-1",
        rememberMe: false,
      })),
    revokeRefreshToken: overrides?.revokeRefreshToken ?? (async () => true),
  };
  const otpService = {
    issue:
      overrides?.issueOtp ??
      (async () => ({
        code: "123456",
      })),
    verify: overrides?.verifyOtp ?? (async () => {}),
  };
  const deviceService = {
    evaluateSuccessfulAuthentication:
      overrides?.evaluateSuccessfulAuthentication ??
      (async () => ({
        deviceId: "device-1",
        known: true,
        knownByIp: true,
      })),
    registerKnownDevice:
      overrides?.registerKnownDevice ??
      (async () => ({
        deviceId: "device-1",
        known: true,
        knownByIp: true,
      })),
    listKnownDevices:
      overrides?.listKnownDevices ??
      (async () => [
        {
          id: "known-device-1",
          current: true,
          deviceId: "device-1",
          type: "desktop",
          platform: "macOS",
          userAgent: "test-agent",
          lastIpAddress: "127.0.0.1",
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-02T00:00:00.000Z",
          verifiedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    removeKnownDevice: overrides?.removeKnownDevice ?? (async () => {}),
  };
  const emailService = {
    sendVerificationEmail: overrides?.sendVerificationEmail ?? (async () => {}),
    sendPasswordResetEmail: overrides?.sendPasswordResetEmail ?? (async () => {}),
    sendLoginUnlockEmail: overrides?.sendLoginUnlockEmail ?? (async () => {}),
  };
  const googleOAuthService = {
    verify:
      overrides?.verifyGoogle ??
      (async () => ({
        email: "oauth@example.com",
        provider: "google",
        providerUserId: "google-user-1",
        emailVerified: true,
      })),
  };
  const microsoftOAuthService = {};
  const appleOAuthService = {};
  const cacheService = {
    getJson: async () => null,
    delete: async () => true,
    setJson: async () => {},
  };

  return new AuthService(
    authRepository as never,
    tokenService as never,
    otpService as never,
    deviceService as never,
    emailService as never,
    googleOAuthService as never,
    microsoftOAuthService as never,
    appleOAuthService as never,
    cacheService as never,
  );
}

describe("AuthService", () => {
  it("returns a pending verification response when signup email already exists but is unverified", async () => {
    const existingUser = {
      ...createUser(),
      email: "pending@example.com",
      emailVerified: false,
    };
    const service = createService({
      findUserByEmail: async () => existingUser,
    });

    const result = await service.localSignup({
      client: createClient(),
      email: existingUser.email,
      password: "CorrectHorseBatteryStaple1!",
      firstName: "Pending",
      lastName: "User",
      deviceId: "device-1",
    });

    expect(result).toEqual({
      verificationRequired: true,
      email: existingUser.email,
      alreadyPending: true,
    });
  });

  it("returns a generic pending verification response when a verified account already exists for the email", async () => {
    const service = createService({
      findUserByEmail: async () => createUser(),
    });

    await expect(
      service.localSignup({
        client: createClient(),
        email: "user@example.com",
        password: "CorrectHorseBatteryStaple1!",
        firstName: "Test",
        lastName: "User",
        deviceId: "device-1",
      }),
    ).resolves.toEqual({
      verificationRequired: true,
      email: "user@example.com",
      alreadyPending: true,
    });
  });

  it("accepts forgot password requests without sending email for unknown accounts", async () => {
    let resetEmailSent = false;
    const service = createService({
      findUserByEmail: async () => null,
      sendPasswordResetEmail: async () => {
        resetEmailSent = true;
      },
    });

    await expect(
      service.forgotPassword({
        email: "missing@example.com",
      }),
    ).resolves.toEqual({
      accepted: true,
    });

    expect(resetEmailSent).toBe(false);
  });

  it("rejects refresh when no refresh token is provided", async () => {
    const service = createService();

    await expect(
      service.refresh({
        client: createClient(),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("issues a long-lived refresh token when remember me is enabled", async () => {
    const user = createUser();
    user.passwordHash = await bcrypt.hash("CorrectHorseBatteryStaple1!", 4);

    let issuedRememberMe: boolean | undefined;
    let issuedRefreshOptions: { expiresInSeconds?: number } | undefined;
    const service = createService({
      findUserByEmail: async () => user,
      createRefreshToken: async (payload, options) => {
        issuedRememberMe = (payload as { rememberMe?: boolean }).rememberMe;
        issuedRefreshOptions = options;
        return "refresh-token-remembered";
      },
      getRefreshTokenExpiresInSeconds: (rememberMe = false) =>
        rememberMe ? 2_592_000 : 86_400,
    });

    const session = await service.localAuthenticate({
      client: createClient(),
      email: user.email,
      password: "CorrectHorseBatteryStaple1!",
      rememberMe: true,
      deviceId: "device-1",
    });

    expect(session.refreshToken).toBe("refresh-token-remembered");
    expect(session.refreshTokenExpiresInSeconds).toBe(2_592_000);
    expect(issuedRememberMe).toBe(true);
    expect(issuedRefreshOptions?.expiresInSeconds).toBe(2_592_000);
  });

  it("preserves remember me when rotating refresh tokens", async () => {
    const user = createUser();
    let issuedRememberMe: boolean | undefined;
    let issuedRefreshOptions: { expiresInSeconds?: number } | undefined;
    let revokedRefreshToken: string | undefined;
    const service = createService({
      findUserById: async () => user,
      verifyRefreshToken: async () => ({
        sub: user.id,
        deviceId: "device-1",
        rememberMe: true,
      }),
      revokeRefreshToken: async (token) => {
        revokedRefreshToken = token;
        return true;
      },
      createRefreshToken: async (payload, options) => {
        issuedRememberMe = (payload as { rememberMe?: boolean }).rememberMe;
        issuedRefreshOptions = options;
        return "rotated-refresh-token";
      },
      getRefreshTokenExpiresInSeconds: (rememberMe = false) =>
        rememberMe ? 2_592_000 : 86_400,
    });

    const session = await service.refresh({
      client: createClient(),
      refreshToken: "incoming-refresh-token",
    });

    expect(session.refreshToken).toBe("rotated-refresh-token");
    expect(session.refreshTokenExpiresInSeconds).toBe(2_592_000);
    expect(issuedRememberMe).toBe(true);
    expect(issuedRefreshOptions?.expiresInSeconds).toBe(2_592_000);
    expect(revokedRefreshToken).toBe("incoming-refresh-token");
  });

  it("rejects change password when the current password is incorrect", async () => {
    const user = createUser();
    user.passwordHash = await bcrypt.hash("CorrectHorseBatteryStaple1!", 4);
    const service = createService({
      findUserById: async () => user,
    });

    await expect(
      service.changePassword({
        userId: user.id,
        client: createClient(),
        currentPassword: "WrongPassword1!",
        newPassword: "AnotherStrongPassword1!",
        deviceId: "device-1",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects password reset for social login accounts", async () => {
    const oauthUser = {
      ...createUser(),
      passwordHash: "oauth:google:provider-user-1",
    };
    const service = createService({
      findUserByEmail: async () => oauthUser,
    });

    await expect(
      service.resetPassword({
        client: createClient(),
        email: oauthUser.email,
        code: "123456",
        newPassword: "AnotherStrongPassword1!",
        deviceId: "device-1",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns verified auth details for localVerify", async () => {
    const service = createService();

    await expect(
      service.localVerify({
        auth: {
          sub: "user-1",
          role: "owner",
          deviceId: "device-99",
          iat: 1,
          exp: 999999,
        },
        client: createClient(),
      }),
    ).resolves.toEqual({
      verified: true,
      auth: {
        userId: "user-1",
        deviceId: "device-99",
        role: "owner",
      },
      client: createClient(),
    });
  });

  it("logs out by revoking the refresh token and rotating the token version", async () => {
    let revokedToken: string | undefined;
    let rotatedUserId: string | undefined;
    const service = createService({
      revokeRefreshToken: async (token) => {
        revokedToken = token;
        return true;
      },
      rotateTokenVersion: async (userId) => {
        rotatedUserId = userId;
        return 4;
      },
    });

    await expect(
      service.logout({
        auth: {
          sub: "user-1",
          deviceId: "device-1",
          iat: 1,
          exp: 999999,
        },
        client: createClient(),
        refreshToken: "refresh-token-1",
      }),
    ).resolves.toEqual({
      loggedOut: true,
      auth: {
        userId: "user-1",
        deviceId: "device-1",
      },
      client: createClient(),
    });

    expect(revokedToken).toBe("refresh-token-1");
    expect(rotatedUserId).toBe("user-1");
  });

  it("lists known devices for the authenticated user", async () => {
    const service = createService();

    await expect(
      service.devices({
        auth: {
          sub: "user-1",
          deviceId: "device-1",
          iat: 1,
          exp: 999999,
        },
        client: createClient(),
      }),
    ).resolves.toEqual({
      devices: [
        {
          id: "known-device-1",
          current: true,
          deviceId: "device-1",
          type: "desktop",
          platform: "macOS",
          userAgent: "test-agent",
          lastIpAddress: "127.0.0.1",
          firstSeenAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-02T00:00:00.000Z",
          verifiedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("delegates removeKnownDevice to the device service", async () => {
    let removed: { userId: string; deviceId: string } | null = null;
    const service = createService({
      removeKnownDevice: async (userId, deviceId) => {
        removed = { userId, deviceId };
      },
    });

    await expect(
      service.removeKnownDevice({
        userId: "user-1",
        deviceId: "device-2",
      }),
    ).resolves.toEqual({
      removed: true,
      deviceId: "device-2",
    });

    expect(removed).toEqual({
      userId: "user-1",
      deviceId: "device-2",
    });
  });

  it("creates a new local user and sends verification during signup", async () => {
    const createdUser = {
      ...createUser(),
      email: "new-user@example.com",
      firstName: "New",
      lastName: "User",
      emailVerified: false,
    };
    let createdPasswordHash: string | undefined;
    let registeredDeviceId: string | undefined;
    let verificationEmailSentTo: string | undefined;
    const service = createService({
      findUserByEmail: async () => null,
      createLocalUser: async (_input, passwordHash) => {
        createdPasswordHash = passwordHash;
        return createdUser;
      },
      registerKnownDevice: async (_user, _client, deviceId) => {
        registeredDeviceId = deviceId;
        return {
          deviceId,
          known: true,
          knownByIp: true,
        };
      },
      sendVerificationEmail: async (input) => {
        verificationEmailSentTo = input.to;
      },
    });

    const result = await service.localSignup({
      client: createClient(),
      email: createdUser.email,
      password: "CorrectHorseBatteryStaple1!",
      firstName: createdUser.firstName,
      lastName: createdUser.lastName,
      deviceId: "device-1",
    });

    expect(typeof createdPasswordHash).toBe("string");
    await expect(
      bcrypt.compare("CorrectHorseBatteryStaple1!", createdPasswordHash ?? ""),
    ).resolves.toBe(true);
    expect(registeredDeviceId).toBe("device-1");
    expect(verificationEmailSentTo).toBe(createdUser.email);
    expect(result).toEqual({
      verificationRequired: true,
      email: createdUser.email,
      alreadyPending: false,
    });
  });

  it("creates a new OAuth user when the provider account is verified and not yet linked", async () => {
    const createdUser = {
      ...createUser(),
      email: "oauth-created@example.com",
      firstName: "OAuth",
      lastName: "User",
    };
    let createdOAuthEmail: string | undefined;
    const service = createService({
      findUserByEmail: async () => null,
      createOAuthUser: async (profile) => {
        createdOAuthEmail = profile.email;
        return createdUser;
      },
      verifyGoogle: async () => ({
        email: createdUser.email,
        provider: "google",
        providerUserId: "google-user-1",
        emailVerified: true,
        firstName: "OAuth",
        lastName: "User",
      }),
    });

    const result = await service.googleAuthenticate({
      client: createClient(),
      nonce: "nonce-1",
      code: "code-1",
      codeVerifier: "verifier-1",
      deviceId: "device-1",
    });

    expect(createdOAuthEmail).toBe(createdUser.email);
    expect(result.accessToken).toBe("access-token");
    expect(result.user.email).toBe(createdUser.email);
  });

  it("rejects OAuth authentication when the email belongs to an unlinked account", async () => {
    const existingUser = {
      ...createUser(),
      email: "oauth@example.com",
      passwordHash: await bcrypt.hash("CorrectHorseBatteryStaple1!", 4),
    };
    const service = createService({
      findUserByEmail: async () => existingUser,
      verifyGoogle: async () => ({
        email: existingUser.email,
        provider: "google",
        providerUserId: "google-user-1",
        emailVerified: true,
      }),
    });

    await expect(
      service.googleAuthenticate({
        client: createClient(),
        nonce: "nonce-1",
        code: "code-1",
        codeVerifier: "verifier-1",
        deviceId: "device-1",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects OAuth authentication when the provider email is not verified", async () => {
    const service = createService({
      verifyGoogle: async () => ({
        email: "oauth@example.com",
        provider: "google",
        providerUserId: "google-user-1",
        emailVerified: false,
      }),
    });

    await expect(
      service.googleAuthenticate({
        client: createClient(),
        nonce: "nonce-1",
        code: "code-1",
        codeVerifier: "verifier-1",
        deviceId: "device-1",
      }),
    ).rejects.toThrow("OAuth account email must be verified.");
  });

  it("accepts resend verification email without revealing that the user is already verified", async () => {
    const service = createService({
      findUserByEmail: async () => createUser(),
    });

    await expect(
      service.resendVerificationEmail({
        email: "user@example.com",
      }),
    ).resolves.toEqual({
      resent: true,
      email: "user@example.com",
    });
  });

  it("rejects verifyEmail when the account cannot be found", async () => {
    const service = createService({
      findUserByEmail: async () => null,
    });

    await expect(
      service.verifyEmail({
        client: createClient(),
        email: "missing@example.com",
        code: "123456",
        deviceId: "device-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
