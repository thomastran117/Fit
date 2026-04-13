import { Hono } from "hono";
import { getContainer } from "@/configuration/bootstrap/container.js";

export function createApplication(): Hono {
  const app = new Hono();
  const { authController } = getContainer();

  app.get("/", (context) => {
    return context.json({
      message: "TypeScript Hono server is running",
    });
  });

  app.get("/health", (context) => {
    return context.json({
      ok: true,
      uptime: process.uptime(),
    });
  });

  app.post("/auth/local/login", authController.localAuthenticate);
  app.post("/auth/local/signup", authController.localSignup);
  app.post("/auth/local/verify", authController.localVerify);
  app.post("/auth/oauth/google", authController.googleAuthenticate);
  app.post("/auth/oauth/microsoft", authController.microsoftAuthenticate);
  app.post("/auth/oauth/apple", authController.appleAuthenticate);
  app.post("/auth/refresh", authController.refresh);
  app.post("/auth/logout", authController.logout);
  app.post("/auth/device/verify", authController.deviceVerify);
  app.get("/auth/devices", authController.devices);

  return app;
}
