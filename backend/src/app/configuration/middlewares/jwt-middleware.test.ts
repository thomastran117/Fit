import assert from "node:assert/strict";
import type { Context } from "hono";
import type { AppBindings, ClientRequestContext } from "@/configuration/http/bindings";
import type { ServiceContainer } from "@/configuration/bootstrap/container";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import type { JwtClaims } from "@/features/auth/token/token.service";
import { ProfileController } from "@/features/profile/profile.controller";
import { PostingsController } from "@/features/postings/postings.controller";
import { getOptionalJwtAuth, requireJwtAuth } from "@/configuration/middlewares/jwt-middleware";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

class FakeTokenService {
  constructor(
    private readonly verify: (token: string) => Promise<JwtClaims> | JwtClaims,
  ) {}

  verifyAccessToken(token: string): Promise<JwtClaims> {
    return Promise.resolve(this.verify(token));
  }
}

class FakeContainer implements ServiceContainer {
  constructor(private readonly tokenService: FakeTokenService) {}

  resolve<TValue>(_token: unknown): TValue {
    return this.tokenService as TValue;
  }

  createScope(): ServiceContainer {
    return this;
  }

  async dispose(): Promise<void> {}
}

function createClaims(overrides: Partial<JwtClaims> = {}): JwtClaims {
  return {
    sub: "user-1",
    email: "user@example.com",
    deviceId: "device-1",
    tokenVersion: 0,
    iat: 1,
    exp: 9_999_999_999,
    ...overrides,
  };
}

function createClientContext(): ClientRequestContext {
  return {
    ip: "127.0.0.1",
    device: {
      id: "device-1",
      type: "desktop",
      isMobile: false,
      userAgent: "test-agent",
      platform: "test-os",
    },
  };
}

function createContext(options?: {
  authorization?: string;
  url?: string;
  params?: Record<string, string>;
  tokenService?: FakeTokenService;
  client?: ClientRequestContext;
}): Context<AppBindings> {
  const variables = new Map<string, unknown>();

  variables.set("container", new FakeContainer(options?.tokenService ?? new FakeTokenService(() => createClaims())));
  variables.set("client", options?.client ?? createClientContext());

  const context = {
    req: {
      url: options?.url ?? "https://example.test/resource",
      header: (name: string) =>
        name.toLowerCase() === "authorization" ? options?.authorization : undefined,
      param: (name: string) => options?.params?.[name],
      json: async () => ({}),
    },
    get: (name: string) => variables.get(name),
    set: (name: string, value: unknown) => {
      variables.set(name, value);
    },
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "content-type": "application/json",
        },
      }),
  };

  return context as unknown as Context<AppBindings>;
}

const tests: TestCase[] = [
  {
    name: "requireJwtAuth returns claims and stores auth on the context",
    run: async () => {
      const claims = createClaims({ sub: "verified-user" });
      const context = createContext({
        authorization: "Bearer good-token",
        tokenService: new FakeTokenService((token) => {
          assert.equal(token, "good-token");
          return claims;
        }),
      });

      const result = await requireJwtAuth(context);

      assert.deepEqual(result, claims);
      assert.deepEqual(context.get("auth"), claims);
    },
  },
  {
    name: "requireJwtAuth rejects when the authorization header is missing",
    run: async () => {
      const context = createContext();

      await assert.rejects(
        requireJwtAuth(context),
        (error: unknown) =>
          error instanceof UnauthorizedError &&
          error.message === "Authorization header is required.",
      );
    },
  },
  {
    name: "requireJwtAuth rejects malformed non-bearer authorization headers",
    run: async () => {
      const context = createContext({
        authorization: "Basic abc123",
      });

      await assert.rejects(
        requireJwtAuth(context),
        (error: unknown) =>
          error instanceof UnauthorizedError &&
          error.message === "Authorization header must use the Bearer scheme.",
      );
    },
  },
  {
    name: "getOptionalJwtAuth returns null when no authorization header is supplied",
    run: async () => {
      const context = createContext();

      const result = await getOptionalJwtAuth(context);

      assert.equal(result, null);
      assert.equal(context.get("auth"), undefined);
    },
  },
  {
    name: "getOptionalJwtAuth rejects malformed authorization headers instead of ignoring them",
    run: async () => {
      const context = createContext({
        authorization: "Token nope",
      });

      await assert.rejects(
        getOptionalJwtAuth(context),
        (error: unknown) =>
          error instanceof UnauthorizedError &&
          error.message === "Authorization header must use the Bearer scheme.",
      );
    },
  },
  {
    name: "profile controller getMe authenticates through the shared helper before reading auth",
    run: async () => {
      const claims = createClaims({ sub: "profile-user" });
      let receivedUserId: string | null = null;
      const controller = new ProfileController({
        getByUserId: async (userId: string) => {
          receivedUserId = userId;
          return { id: "profile-1", userId };
        },
      } as never);
      const context = createContext({
        authorization: "Bearer profile-token",
        tokenService: new FakeTokenService(() => claims),
      });

      const response = await controller.getMe(context);

      assert.equal(receivedUserId, "profile-user");
      assert.deepEqual(context.get("auth"), claims);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { id: "profile-1", userId: "profile-user" });
    },
  },
  {
    name: "postings controller getById preserves optional auth and tracks public views anonymously",
    run: async () => {
      let receivedViewerId: string | undefined;
      const controller = new PostingsController(
        {
          getById: async (postingId: string, viewerId?: string) => {
            receivedViewerId = viewerId;
            return {
              id: postingId,
              ownerId: "owner-1",
            };
          },
        } as never,
        {
          trackPublicView: async (
            posting: { id: string; ownerId: string },
            client: ClientRequestContext,
            viewerId?: string,
          ) => {
            assert.equal(posting.id, "posting-123");
            assert.equal(client.device.id, "device-1");
            assert.equal(viewerId, undefined);
          },
        } as never,
        {} as never,
      );
      const context = createContext({
        url: "https://example.test/postings/posting-123",
        params: {
          id: "posting-123",
        },
      });

      const response = await controller.getById(context);

      assert.equal(receivedViewerId, undefined);
      assert.equal(context.get("auth"), undefined);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { id: "posting-123", ownerId: "owner-1" });
    },
  },
];

export async function runJwtMiddlewareTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }

  console.log(`Completed ${tests.length} jwt middleware tests.`);
}

void runJwtMiddlewareTests().catch((error: unknown) => {
  console.error("JWT middleware tests failed.", error);
  process.exit(1);
});
