import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { handleApplicationError } from "@/configuration/middlewares/error-handler.middleware";
import { requestIdMiddleware } from "@/configuration/middlewares/request-id.middleware";

function createApp() {
  const app = new Hono<AppBindings>();
  app.use("*", requestIdMiddleware);
  app.onError(handleApplicationError);
  app.get("/health", (context) =>
    context.json({
      requestId: context.get("requestId"),
    }),
  );
  return app;
}

describe("requestIdMiddleware", () => {
  it("reuses a valid incoming request id and echoes it in the response", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/health", {
      headers: {
        "x-request-id": "req-1234",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-1234");
    await expect(response.json()).resolves.toEqual({
      requestId: "req-1234",
    });
  });

  it("generates a request id when the client does not provide one", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects malformed request id headers", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/health", {
      headers: {
        "x-request-id": "bad request id",
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "x-request-id header is invalid.",
      code: "BAD_REQUEST",
      details: {
        header: "x-request-id",
      },
    });
  });
});
