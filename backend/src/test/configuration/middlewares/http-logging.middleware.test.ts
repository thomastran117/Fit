import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { httpLoggingMiddleware } from "@/configuration/middlewares/http-logging.middleware";

function createApp() {
  const app = new Hono<AppBindings>();

  app.use("*", async (context, next) => {
    context.set("client", {
      ip: "203.0.113.10",
      device: {
        type: "desktop",
        isMobile: false,
      },
    });
    context.set("outputFormat", "json");
    await next();
  });
  app.use("*", httpLoggingMiddleware);
  app.get("/oauth/callback", (context) => context.json({ ok: true }));

  return app;
}

describe("httpLoggingMiddleware", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps safe query params in the log output", async () => {
    const app = createApp();
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    const response = await app.request(
      "http://rent.test/oauth/callback?page=2&pageSize=10&format=json",
    );

    expect(response.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledTimes(1);

    const [message] = infoSpy.mock.calls[0] ?? [];
    expect(message).toContain("/oauth/callback?page=2&pageSize=10&format=json");
  });

  it("redacts sensitive query params before logging the URL", async () => {
    const app = createApp();
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    const response = await app.request(
      "http://rent.test/oauth/callback?code=oauth-code&state=csrf-state&token=bearer-token&page=2",
    );

    expect(response.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledTimes(1);

    const [message] = infoSpy.mock.calls[0] ?? [];
    expect(message).toContain(
      "/oauth/callback?page=2&code=%5BREDACTED%5D&state=%5BREDACTED%5D&token=%5BREDACTED%5D",
    );
    expect(message).not.toContain("oauth-code");
    expect(message).not.toContain("csrf-state");
    expect(message).not.toContain("bearer-token");
  });
});
