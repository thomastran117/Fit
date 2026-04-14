import type { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { getContainer } from "@/configuration/bootstrap/container";
import { jwtMiddleware } from "../middlewares/jwt-middleware";

export function mountRoutes(app: Hono<AppBindings>): Hono<AppBindings> {
  const { authController } = getContainer();

  app.use("/auth/local/verify", jwtMiddleware);
  app.use("/auth/logout", jwtMiddleware);
  app.use("/auth/device/verify", jwtMiddleware);
  app.use("/auth/devices", jwtMiddleware);
  app.use("/auth/devices/remove", jwtMiddleware);

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
  app.post("/auth/local/email/verify", authController.verifyEmail);
  app.post("/auth/local/email/resend", authController.resendVerificationEmail);
  app.post("/auth/local/verify", authController.localVerify);
  app.post("/auth/oauth/google", authController.googleAuthenticate);
  app.post("/auth/oauth/microsoft", authController.microsoftAuthenticate);
  app.post("/auth/oauth/apple", authController.appleAuthenticate);
  app.post("/auth/refresh", authController.refresh);
  app.post("/auth/logout", authController.logout);
  app.post("/auth/device/verify", authController.deviceVerify);
  app.get("/auth/devices", authController.devices);
  app.delete("/auth/devices/remove", authController.removeKnownDevice);

  return app;
}
