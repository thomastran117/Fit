import type { Context } from "hono";
import type { AppBindings, ClientRequestContext } from "@/configuration/http/bindings";
import { containerTokens } from "@/configuration/container/tokens";
import type { ServiceContainer } from "@/configuration/bootstrap/container";
import UnauthorizedError from "@/errors/http/unauthorized.error";
import { ProfileController } from "@/features/profile/profile.controller";
import { PostingsController } from "@/features/postings/postings.controller";
import type { JwtClaims } from "@/features/auth/token/token.service";
import { getOptionalJwtAuth, requireJwtAuth } from "@/configuration/middlewares/jwt-middleware";
import { ContentSanitizationService } from "@/features/security/content-sanitization.service";

class FakeTokenService {
  constructor(
    private readonly verify: (token: string) => Promise<JwtClaims> | JwtClaims,
  ) {}

  verifyAccessToken(token: string): Promise<JwtClaims> {
    return Promise.resolve(this.verify(token));
  }
}

class FakeContainer implements ServiceContainer {
  private readonly contentSanitizationService = new ContentSanitizationService();

  constructor(private readonly tokenService: FakeTokenService) {}

  resolve<TValue>(token: unknown): TValue {
    if (token === containerTokens.contentSanitizationService) {
      return this.contentSanitizationService as TValue;
    }

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

  variables.set(
    "container",
    new FakeContainer(options?.tokenService ?? new FakeTokenService(() => createClaims())),
  );
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

describe("jwt middleware helpers", () => {
  it("requireJwtAuth returns claims and stores auth on the context", async () => {
    const claims = createClaims({ sub: "verified-user" });
    const context = createContext({
      authorization: "Bearer good-token",
      tokenService: new FakeTokenService((token) => {
        expect(token).toBe("good-token");
        return claims;
      }),
    });

    const result = await requireJwtAuth(context);

    expect(result).toEqual(claims);
    expect(context.get("auth")).toEqual(claims);
  });

  it("requireJwtAuth rejects when the authorization header is missing", async () => {
    const context = createContext();

    await expect(requireJwtAuth(context)).rejects.toMatchObject<Partial<UnauthorizedError>>({
      message: "Authorization header is required.",
    });
  });

  it("requireJwtAuth rejects malformed non-bearer authorization headers", async () => {
    const context = createContext({
      authorization: "Basic abc123",
    });

    await expect(requireJwtAuth(context)).rejects.toMatchObject<Partial<UnauthorizedError>>({
      message: "Authorization header must use the Bearer scheme.",
    });
  });

  it("getOptionalJwtAuth returns null when no authorization header is supplied", async () => {
    const context = createContext();

    const result = await getOptionalJwtAuth(context);

    expect(result).toBeNull();
    expect(context.get("auth")).toBeUndefined();
  });

  it("getOptionalJwtAuth rejects malformed authorization headers instead of ignoring them", async () => {
    const context = createContext({
      authorization: "Token nope",
    });

    await expect(getOptionalJwtAuth(context)).rejects.toMatchObject<Partial<UnauthorizedError>>({
      message: "Authorization header must use the Bearer scheme.",
    });
  });

  it("profile controller getMe authenticates through the shared helper before reading auth", async () => {
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

    expect(receivedUserId).toBe("profile-user");
    expect(context.get("auth")).toEqual(claims);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "profile-1", userId: "profile-user" });
  });

  it("postings controller getById preserves optional auth and tracks public views anonymously", async () => {
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
          expect(posting.id).toBe("posting-123");
          expect(client.device.id).toBe("device-1");
          expect(viewerId).toBeUndefined();
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

    expect(receivedViewerId).toBeUndefined();
    expect(context.get("auth")).toBeUndefined();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "posting-123", ownerId: "owner-1" });
  });
});
