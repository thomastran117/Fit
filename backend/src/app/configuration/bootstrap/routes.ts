import type { Context, Hono } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import {
  containerTokens,
  getRequestContainer,
  type ServiceToken,
} from "@/configuration/bootstrap/container";
import type { AuthController } from "@/features/auth/auth.controller";
import type { BlobController } from "@/features/blob/blob.controller";
import type { BookingsController } from "@/features/bookings/bookings.controller";
import type { ProfileController } from "@/features/profile/profile.controller";
import type { PostingsController } from "@/features/postings/postings.controller";
import type { RentingsController } from "@/features/rentings/rentings.controller";
import { jwtMiddleware } from "../middlewares/jwt-middleware";

type ControllerHandlerName<TController> = {
  [TKey in keyof TController]: TController[TKey] extends (
    context: Context<AppBindings>,
  ) => Promise<Response>
    ? TKey
    : never;
}[keyof TController];

function resolveHandler<TController>(
  token: ServiceToken<TController>,
  handlerName: ControllerHandlerName<TController>,
) {
  return async (context: Context<AppBindings>): Promise<Response> => {
    const controller = getRequestContainer(context).resolve(token);
    const handler = controller[handlerName] as (
      context: Context<AppBindings>,
    ) => Promise<Response>;
    return handler(context);
  };
}

export function mountRoutes(app: Hono<AppBindings>): Hono<AppBindings> {
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

  app.post(
    "/auth/local/login",
    resolveHandler<AuthController>(containerTokens.authController, "localAuthenticate"),
  );
  app.post(
    "/auth/local/signup",
    resolveHandler<AuthController>(containerTokens.authController, "localSignup"),
  );
  app.post(
    "/auth/local/email/verify",
    resolveHandler<AuthController>(containerTokens.authController, "verifyEmail"),
  );
  app.post(
    "/auth/local/email/resend",
    resolveHandler<AuthController>(containerTokens.authController, "resendVerificationEmail"),
  );
  app.post(
    "/auth/local/unlock",
    resolveHandler<AuthController>(containerTokens.authController, "unlockLocalLogin"),
  );
  app.post(
    "/auth/local/unlock/resend",
    resolveHandler<AuthController>(containerTokens.authController, "resendUnlockLocalLogin"),
  );
  app.post(
    "/auth/local/verify",
    resolveHandler<AuthController>(containerTokens.authController, "localVerify"),
  );
  app.post(
    "/auth/oauth/google",
    resolveHandler<AuthController>(containerTokens.authController, "googleAuthenticate"),
  );
  app.post(
    "/auth/oauth/microsoft",
    resolveHandler<AuthController>(containerTokens.authController, "microsoftAuthenticate"),
  );
  app.post(
    "/auth/oauth/apple",
    resolveHandler<AuthController>(containerTokens.authController, "appleAuthenticate"),
  );
  app.post(
    "/auth/refresh",
    resolveHandler<AuthController>(containerTokens.authController, "refresh"),
  );
  app.post(
    "/auth/logout",
    resolveHandler<AuthController>(containerTokens.authController, "logout"),
  );
  app.post(
    "/auth/device/verify",
    resolveHandler<AuthController>(containerTokens.authController, "deviceVerify"),
  );
  app.get(
    "/auth/devices",
    resolveHandler<AuthController>(containerTokens.authController, "devices"),
  );
  app.delete(
    "/auth/devices/remove",
    resolveHandler<AuthController>(containerTokens.authController, "removeKnownDevice"),
  );
  app.post(
    "/blob/upload-url",
    resolveHandler<BlobController>(containerTokens.blobController, "createUploadUrl"),
  );
  app.get("/profiles", resolveHandler<ProfileController>(containerTokens.profileController, "list"));
  app.get(
    "/profile/me",
    resolveHandler<ProfileController>(containerTokens.profileController, "getMe"),
  );
  app.put(
    "/profile/me",
    resolveHandler<ProfileController>(containerTokens.profileController, "updateMe"),
  );
  app.post(
    "/postings",
    resolveHandler<PostingsController>(containerTokens.postingsController, "create"),
  );
  app.get(
    "/postings",
    resolveHandler<PostingsController>(containerTokens.postingsController, "search"),
  );
  app.get(
    "/postings/batch",
    resolveHandler<PostingsController>(containerTokens.postingsController, "batchPublic"),
  );
  app.get(
    "/postings/analytics/summary",
    resolveHandler<PostingsController>(containerTokens.postingsController, "analyticsSummary"),
  );
  app.get(
    "/postings/analytics/postings",
    resolveHandler<PostingsController>(containerTokens.postingsController, "analyticsPostings"),
  );
  app.get(
    "/postings/me",
    resolveHandler<PostingsController>(containerTokens.postingsController, "listMine"),
  );
  app.get(
    "/postings/me/batch",
    resolveHandler<PostingsController>(containerTokens.postingsController, "batchMine"),
  );
  app.get(
    "/postings/:id/analytics",
    resolveHandler<PostingsController>(containerTokens.postingsController, "analyticsById"),
  );
  app.get(
    "/postings/:id/reviews",
    resolveHandler<PostingsController>(containerTokens.postingsController, "listReviews"),
  );
  app.post(
    "/postings/:id/reviews",
    resolveHandler<PostingsController>(containerTokens.postingsController, "createReview"),
  );
  app.put(
    "/postings/:id/reviews/me",
    resolveHandler<PostingsController>(containerTokens.postingsController, "updateOwnReview"),
  );
  app.post(
    "/postings/:id/booking-requests",
    resolveHandler<BookingsController>(containerTokens.bookingsController, "createForPosting"),
  );
  app.get(
    "/postings/:id/booking-requests",
    resolveHandler<BookingsController>(containerTokens.bookingsController, "listForOwnerPosting"),
  );
  app.get(
    "/postings/:id",
    resolveHandler<PostingsController>(containerTokens.postingsController, "getById"),
  );
  app.put(
    "/postings/:id",
    resolveHandler<PostingsController>(containerTokens.postingsController, "update"),
  );
  app.post(
    "/postings/:id/publish",
    resolveHandler<PostingsController>(containerTokens.postingsController, "publish"),
  );
  app.post(
    "/postings/:id/archive",
    resolveHandler<PostingsController>(containerTokens.postingsController, "archive"),
  );
  app.get(
    "/booking-requests/me",
    resolveHandler<BookingsController>(containerTokens.bookingsController, "listMine"),
  );
  app.get(
    "/booking-requests/:id",
    resolveHandler<BookingsController>(containerTokens.bookingsController, "getById"),
  );
  app.put(
    "/booking-requests/:id",
    resolveHandler<BookingsController>(containerTokens.bookingsController, "updateOwn"),
  );
  app.post(
    "/booking-requests/:id/approve",
    resolveHandler<BookingsController>(containerTokens.bookingsController, "approve"),
  );
  app.post(
    "/booking-requests/:id/decline",
    resolveHandler<BookingsController>(containerTokens.bookingsController, "decline"),
  );
  app.post(
    "/booking-requests/:id/convert",
    resolveHandler<RentingsController>(containerTokens.rentingsController, "convertBookingRequest"),
  );
  app.get(
    "/rentings/me",
    resolveHandler<RentingsController>(containerTokens.rentingsController, "listMine"),
  );
  app.get(
    "/rentings/:id",
    resolveHandler<RentingsController>(containerTokens.rentingsController, "getById"),
  );

  return app;
}
