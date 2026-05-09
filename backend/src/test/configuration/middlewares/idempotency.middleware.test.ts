import { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { handleApplicationError } from "@/configuration/middlewares/error-handler.middleware";
import { idempotencyMiddleware } from "@/configuration/middlewares/idempotency.middleware";
import { requestIdMiddleware } from "@/configuration/middlewares/request-id.middleware";

function createApp() {
  const app = new Hono<AppBindings>();
  app.use("*", requestIdMiddleware);
  app.use("*", idempotencyMiddleware);
  app.onError(handleApplicationError);
  app.post("/payments", (context) =>
    context.json({
      idempotencyKey: context.get("idempotencyKey"),
      requestId: context.get("requestId"),
    }),
  );
  return app;
}

describe("idempotencyMiddleware", () => {
  it("prefers the explicit idempotency key header", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/payments", {
      method: "POST",
      headers: {
        "idempotency-key": "payment-attempt-1",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("idempotency-key")).toBe("payment-attempt-1");
    await expect(response.json()).resolves.toEqual({
      idempotencyKey: "payment-attempt-1",
      requestId: expect.any(String),
    });
  });

  it("falls back to the request id when no explicit idempotency key is supplied", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/payments", {
      method: "POST",
      headers: {
        "x-request-id": "req-fallback-1",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("idempotency-key")).toBe("req-fallback-1");
    await expect(response.json()).resolves.toEqual({
      idempotencyKey: "req-fallback-1",
      requestId: "req-fallback-1",
    });
  });

  it("rejects conflicting idempotency key headers", async () => {
    const app = createApp();
    const response = await app.request("http://rent.test/payments", {
      method: "POST",
      headers: {
        "idempotency-key": "payment-attempt-1",
        "x-idempotency-key": "payment-attempt-2",
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Conflicting idempotency key headers were provided.",
      errors: [
        {
          code: "BAD_REQUEST",
          message: "Conflicting idempotency key headers were provided.",
        },
      ],
      details: {
        headers: ["idempotency-key", "x-idempotency-key"],
      },
      meta: {
        requestId: expect.any(String),
      },
    });
  });
});
