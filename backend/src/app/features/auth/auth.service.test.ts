import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { AuthService } from "@/features/auth/auth.service";
import type { AuthUserRecord } from "@/features/auth/auth.model";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

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

function createService(overrides?: {
  findUserByEmail?: (email: string) => Promise<AuthUserRecord | null>;
  findUserById?: (userId: string) => Promise<AuthUserRecord | null>;
  verifyRefreshToken?: (token: string) => Promise<{ sub: string; deviceId?: string; rememberMe?: boolean }>;
  createRefreshToken?: (payload: Record<string, unknown>, options?: { expiresInSeconds?: number }) => Promise<string>;
  getRefreshTokenExpiresInSeconds?: (rememberMe?: boolean) => number;
  evaluateSuccessfulAuthentication?: () => Promise<{ deviceId?: string; known: boolean; knownByIp: boolean }>;
  registerKnownDevice?: () => Promise<{ deviceId?: string; known: boolean; knownByIp: boolean }>;
}) {
  const authRepository = {
    findUserByEmail: overrides?.findUserByEmail ?? (async () => null),
    findUserById: overrides?.findUserById ?? (async () => null),
  };
  const tokenService = {
    createAccessToken: () => "access-token",
    createRefreshToken:
      overrides?.createRefreshToken ??
      (async () => "refresh-token"),
    getRefreshTokenExpiresInSeconds:
      overrides?.getRefreshTokenExpiresInSeconds ?? ((rememberMe = false) => (rememberMe ? 777 : 333)),
    verifyRefreshToken:
      overrides?.verifyRefreshToken ??
      (async () => ({
        sub: "user-1",
        deviceId: "device-1",
        rememberMe: false,
      })),
  };
  const otpService = {};
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
  };
  const emailService = {};
  const googleOAuthService = {};
  const microsoftOAuthService = {};
  const appleOAuthService = {};
  const cacheService = {
    getJson: async () => null,
    delete: async () => true,
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

const tests: TestCase[] = [
  {
    name: "local authenticate issues a long-lived refresh token when remember me is enabled",
    run: async () => {
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
        getRefreshTokenExpiresInSeconds: (rememberMe = false) => (rememberMe ? 2_592_000 : 86_400),
      });

      const session = await service.localAuthenticate({
        client: {
          ip: "127.0.0.1",
          device: {
            id: "device-1",
            type: "desktop",
            isMobile: false,
          },
        },
        email: user.email,
        password: "CorrectHorseBatteryStaple1!",
        rememberMe: true,
        deviceId: "device-1",
      });

      assert.equal(session.refreshToken, "refresh-token-remembered");
      assert.equal(session.refreshTokenExpiresInSeconds, 2_592_000);
      assert.equal(issuedRememberMe, true);
      assert.equal(issuedRefreshOptions?.expiresInSeconds, 2_592_000);
    },
  },
  {
    name: "refresh preserves remember me when rotating refresh tokens",
    run: async () => {
      const user = createUser();
      let issuedRememberMe: boolean | undefined;
      let issuedRefreshOptions: { expiresInSeconds?: number } | undefined;
      const service = createService({
        findUserById: async () => user,
        verifyRefreshToken: async () => ({
          sub: user.id,
          deviceId: "device-1",
          rememberMe: true,
        }),
        createRefreshToken: async (payload, options) => {
          issuedRememberMe = (payload as { rememberMe?: boolean }).rememberMe;
          issuedRefreshOptions = options;
          return "rotated-refresh-token";
        },
        getRefreshTokenExpiresInSeconds: (rememberMe = false) => (rememberMe ? 2_592_000 : 86_400),
      });

      const session = await service.refresh({
        client: {
          ip: "127.0.0.1",
          device: {
            id: "device-1",
            type: "desktop",
            isMobile: false,
          },
        },
        refreshToken: "incoming-refresh-token",
      });

      assert.equal(session.refreshToken, "rotated-refresh-token");
      assert.equal(session.refreshTokenExpiresInSeconds, 2_592_000);
      assert.equal(issuedRememberMe, true);
      assert.equal(issuedRefreshOptions?.expiresInSeconds, 2_592_000);
    },
  },
];

export async function runAuthServiceTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }

  console.log(`Completed ${tests.length} auth service tests.`);
}

void runAuthServiceTests().catch((error: unknown) => {
  console.error("Auth service tests failed.", error);
  process.exit(1);
});
