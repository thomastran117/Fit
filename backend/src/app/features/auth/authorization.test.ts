import assert from "node:assert/strict";
import type { Context } from "hono";
import type { AppBindings, ClientRequestContext } from "@/configuration/http/bindings";
import type { ServiceContainer } from "@/configuration/bootstrap/container";
import ForbiddenError from "@/errors/http/forbidden.error";
import {
  getAuthRole,
  hasMinimumRole,
  requireMinimumRole,
} from "@/features/auth/authorization";
import { normalizeAppRole } from "@/features/auth/auth.model";
import { PaymentsController } from "@/features/payments/payments.controller";
import { PostingsController } from "@/features/postings/postings.controller";
import type { JwtClaims } from "@/features/auth/token/token.service";

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
    role: "user",
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
  body?: unknown;
  tokenService?: FakeTokenService;
}): Context<AppBindings> {
  const variables = new Map<string, unknown>();

  variables.set("container", new FakeContainer(options?.tokenService ?? new FakeTokenService(() => createClaims())));
  variables.set("client", createClientContext());

  const context = {
    req: {
      url: options?.url ?? "https://example.test/resource",
      header: (name: string) =>
        name.toLowerCase() === "authorization" ? options?.authorization : undefined,
      param: (name: string) => options?.params?.[name],
      json: async () => options?.body ?? {},
      text: async () => "",
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
    name: "normalizeAppRole defaults missing roles to user",
    run: () => {
      assert.equal(normalizeAppRole(undefined), "user");
      assert.equal(getAuthRole(createClaims({ role: undefined })), "user");
    },
  },
  {
    name: "requireMinimumRole allows owner routes for owner and admin roles",
    run: () => {
      assert.equal(requireMinimumRole(createClaims({ role: "owner" }), "owner"), "owner");
      assert.equal(requireMinimumRole(createClaims({ role: "admin" }), "owner"), "admin");
      assert.equal(hasMinimumRole(createClaims({ role: "admin" }), "owner"), true);
    },
  },
  {
    name: "requireMinimumRole rejects regular users from owner routes",
    run: () => {
      assert.throws(
        () => requireMinimumRole(createClaims({ role: "user" }), "owner"),
        (error: unknown) => error instanceof ForbiddenError,
      );
    },
  },
  {
    name: "postings controller create rejects regular users before calling the service",
    run: async () => {
      let createDraftCalled = false;
      const controller = new PostingsController(
        {
          createDraft: async () => {
            createDraftCalled = true;
            return { id: "posting-1" };
          },
        } as never,
        {} as never,
        {} as never,
      );
      const context = createContext({
        authorization: "Bearer user-token",
        tokenService: new FakeTokenService(() => createClaims({ role: "user" })),
        body: {
          name: "Test posting",
          description: "Nice place",
          pricing: { currency: "cad", daily: { amount: 100 } },
          photos: [],
          tags: [],
          attributes: {},
          availabilityStatus: "available",
          availabilityBlocks: [],
          location: {
            latitude: 43.7,
            longitude: -79.4,
            city: "Toronto",
            region: "Ontario",
            country: "Canada",
          },
        },
      });

      await assert.rejects(controller.create(context), (error: unknown) => error instanceof ForbiddenError);
      assert.equal(createDraftCalled, false);
    },
  },
  {
    name: "payments controller repair is restricted to admins",
    run: async () => {
      let repairCalled = false;
      const controller = new PaymentsController({
        repairPayment: async () => {
          repairCalled = true;
        },
      } as never);
      const ownerContext = createContext({
        authorization: "Bearer owner-token",
        params: {
          id: "payment-1",
        },
        tokenService: new FakeTokenService(() => createClaims({ role: "owner" })),
      });

      await assert.rejects(controller.repair(ownerContext), (error: unknown) => error instanceof ForbiddenError);
      assert.equal(repairCalled, false);

      const adminContext = createContext({
        authorization: "Bearer admin-token",
        params: {
          id: "payment-2",
        },
        tokenService: new FakeTokenService(() => createClaims({ role: "admin" })),
      });

      const response = await controller.repair(adminContext);

      assert.equal(repairCalled, true);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    },
  },
];

export async function runAuthorizationTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`PASS ${test.name}`);
  }

  console.log(`Completed ${tests.length} authorization tests.`);
}

void runAuthorizationTests().catch((error: unknown) => {
  console.error("Authorization tests failed.", error);
  process.exit(1);
});
