import { RequestValidationError } from "@/configuration/validation/request";
import type { AppBindings } from "@/configuration/http/bindings";
import { PostingsController } from "@/features/postings/postings.controller";
import type { JwtClaims } from "@/features/auth/token/token.service";
import type { Context } from "hono";

const mockRequireJwtAuth = jest.fn();
const mockGetOptionalJwtAuth = jest.fn();

jest.mock("@/configuration/middlewares/jwt-middleware", () => ({
  requireJwtAuth: (...args: unknown[]) => mockRequireJwtAuth(...args),
  getOptionalJwtAuth: (...args: unknown[]) => mockGetOptionalJwtAuth(...args),
}));

function createClaims(overrides: Partial<JwtClaims> = {}): JwtClaims {
  return {
    sub: "owner-1",
    email: "owner@example.com",
    role: "owner",
    deviceId: "device-1",
    tokenVersion: 0,
    iat: 1,
    exp: 9_999_999_999,
    ...overrides,
  };
}

function createContext(options?: {
  body?: unknown;
  url?: string;
  params?: Record<string, string>;
}) {
  const context = {
    req: {
      json: async () => options?.body ?? {},
      url: options?.url ?? "https://example.test/postings",
      param: (name: string) => options?.params?.[name],
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

describe("PostingsController", () => {
  beforeEach(() => {
    mockRequireJwtAuth.mockReset();
    mockGetOptionalJwtAuth.mockReset();
  });

  it("maps family and subtype search filters into the service input", async () => {
    const searchPublic = jest.fn(async () => ({
      postings: [],
      pagination: {
        page: 2,
        pageSize: 5,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      },
      source: "elasticsearch" as const,
    }));
    const controller = new PostingsController(
      {
        searchPublic,
      } as never,
      {} as never,
      {} as never,
    );
    const context = createContext({
      url: "https://example.test/postings?page=2&pageSize=5&family=vehicle&subtype=car",
    });

    const response = await controller.search(context);

    expect(searchPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 5,
        family: "vehicle",
        subtype: "car",
        sort: "relevance",
      }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects create requests that omit the required variant", async () => {
    mockRequireJwtAuth.mockResolvedValue(createClaims());
    const createDraft = jest.fn();
    const controller = new PostingsController(
      {
        createDraft,
      } as never,
      {} as never,
      {} as never,
    );
    const context = createContext({
      body: {
        name: "Test posting",
        description: "Nice place",
        pricing: {
          currency: "cad",
          daily: {
            amount: 100,
          },
        },
        photos: [
          {
            blobUrl: "https://example.blob.core.windows.net/postings/photo-1.jpg",
            blobName: "postings/photo-1.jpg",
            position: 0,
          },
        ],
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

    await expect(controller.create(context)).rejects.toMatchObject<
      Partial<RequestValidationError>
    >({
      message: "Request body validation failed.",
      details: [
        {
          path: "variant",
        },
      ],
    });
    expect(createDraft).not.toHaveBeenCalled();
  });
});
