import type { Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { getContainer } from "@/configuration/bootstrap/container";
import { jwtMiddleware } from "../middlewares/jwt-middleware";

export function mountRoutes(app: Hono<AppBindings>): Hono<AppBindings> {
  const {
    authController,
    blobController,
    bookingsController,
    profileController,
    postingsController,
  } = getContainer();

  app.use("/auth/local/verify", jwtMiddleware);
  app.use("/auth/logout", jwtMiddleware);
  app.use("/auth/device/verify", jwtMiddleware);
  app.use("/auth/devices", jwtMiddleware);
  app.use("/auth/devices/remove", jwtMiddleware);
  app.use("/blob/upload-url", jwtMiddleware);
  app.use("/profile/me", jwtMiddleware);

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
  app.post("/blob/upload-url", blobController.createUploadUrl);
  app.get("/profiles", profileController.list);
  app.get("/profile/me", profileController.getMe);
  app.put("/profile/me", profileController.updateMe);
  app.post("/postings", postingsController.create);
  app.get("/postings", postingsController.search);
  app.get("/postings/batch", postingsController.batchPublic);
  app.get("/postings/analytics/summary", postingsController.analyticsSummary);
  app.get("/postings/analytics/postings", postingsController.analyticsPostings);
  app.get("/postings/me", postingsController.listMine);
  app.get("/postings/me/batch", postingsController.batchMine);
  app.get("/postings/:id/analytics", postingsController.analyticsById);
  app.get("/postings/:id/reviews", postingsController.listReviews);
  app.post("/postings/:id/reviews", postingsController.createReview);
  app.put("/postings/:id/reviews/me", postingsController.updateOwnReview);
  app.post("/postings/:id/booking-requests", bookingsController.createForPosting);
  app.get("/postings/:id/booking-requests", bookingsController.listForOwnerPosting);
  app.get("/postings/:id", postingsController.getById);
  app.put("/postings/:id", postingsController.update);
  app.post("/postings/:id/publish", postingsController.publish);
  app.post("/postings/:id/archive", postingsController.archive);
  app.get("/booking-requests/me", bookingsController.listMine);
  app.get("/booking-requests/:id", bookingsController.getById);
  app.put("/booking-requests/:id", bookingsController.updateOwn);
  app.post("/booking-requests/:id/approve", bookingsController.approve);
  app.post("/booking-requests/:id/decline", bookingsController.decline);

  return app;
}

