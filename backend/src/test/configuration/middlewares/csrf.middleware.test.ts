import { Hono } from "hono";
import { getApiRoutePrefix } from "@/configuration/http/api-path";
import type { AppBindings } from "@/configuration/http/bindings";
import { csrfMiddleware } from "@/configuration/middlewares/csrf.middleware";
import { handleApplicationError } from "@/configuration/middlewares/error-handler.middleware";

function createApp() {
  const app = new Hono<AppBindings>();
  app.use("/auth/*", csrfMiddleware);
  app.onError(handleApplicationError);
  app.post("/auth/refresh", (context) => context.json({ ok: true }));
  app.post("/auth/logout", (context) => context.json({ ok: true }));
  app.post("/auth/local/login", (context) => context.json({ ok: true }));
  return app;
}

describe("csrfMiddleware", () => {
  it("allows cookie-backed refresh when the CSRF cookie and header match", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/auth/refresh", {
      method: "POST",
      headers: {
        origin: "http://localhost:3040",
        cookie: "refresh_token=refresh-token; csrf_token=csrf-token",
        "x-csrf-token": "csrf-token",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects cookie-backed refresh when the CSRF header is missing", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/auth/refresh", {
      method: "POST",
      headers: {
        origin: "http://localhost:3040",
        cookie: "refresh_token=refresh-token; csrf_token=csrf-token",
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: "CSRF validation failed.",
      errors: [
        {
          code: "FORBIDDEN",
          message: "CSRF validation failed.",
        },
      ],
      meta: {
        requestId: "unknown",
      },
    });
  });

  it("allows browser login without a CSRF token before a session cookie exists", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/auth/local/login", {
      method: "POST",
      headers: {
        origin: "http://localhost:3040",
      },
    });

    expect(response.status).toBe(200);
  });

  it("allows non-browser refresh requests to use the explicit body-token strategy", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/auth/refresh", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        refreshToken: "native-refresh-token",
      }),
    });

    expect(response.status).toBe(200);
  });

  it("supports versioned auth routes when CSRF is mounted on the API base path", async () => {
    const app = new Hono<AppBindings>();
    const api = app.basePath(getApiRoutePrefix());

    api.use("/auth/*", csrfMiddleware);
    app.onError(handleApplicationError);
    api.post("/auth/refresh", (context) => context.json({ ok: true }));

    const response = await app.request(`http://rent.test${getApiRoutePrefix()}/auth/refresh`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3040",
        cookie: "refresh_token=refresh-token; csrf_token=csrf-token",
        "x-csrf-token": "csrf-token",
      },
    });

    expect(response.status).toBe(200);
  });
});
