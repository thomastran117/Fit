import { Hono } from "hono";
import { environment } from "@/configuration/environment";
import type { AppBindings } from "@/configuration/http/bindings";
import { securityHeadersMiddleware } from "@/configuration/middlewares/security-headers.middleware";

function createApp() {
  const app = new Hono<AppBindings>();
  app.use("*", securityHeadersMiddleware);
  app.get("/health", (context) => context.json({ ok: true }));
  return app;
}

describe("securityHeadersMiddleware", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("adds the baseline hardening headers to responses", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/health");

    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("adds HSTS in production", async () => {
    jest.spyOn(environment, "isProduction").mockReturnValue(true);
    const app = createApp();
    const response = await app.request("http://rent.test/health");

    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });
});
