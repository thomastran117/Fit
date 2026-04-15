import { AuthController } from "@/features/auth/auth.controller";
import { CaptchaService } from "@/features/auth/captcha/captcha.service";
import { DeviceRepository } from "@/features/auth/device/device.repository";
import { DeviceService } from "@/features/auth/device/device.service";
import { OtpService } from "@/features/auth/otp/otp.service";
import { AppleOAuthService } from "@/features/auth/oauth/apple.service";
import { GoogleOAuthService } from "@/features/auth/oauth/google.service";
import { MicrosoftOAuthService } from "@/features/auth/oauth/microsoft.service";
import { OAuthTokenVerifier } from "@/features/auth/oauth/oauth-token-verifier";
import { AuthRepository } from "@/features/auth/auth.repository";
import { AuthService } from "@/features/auth/auth.service";
import { TokenService } from "@/features/auth/token/token.service";
import { BlobController } from "@/features/blob/blob.controller";
import { BlobService } from "@/features/blob/blob.service";
import { BookingsController } from "@/features/bookings/bookings.controller";
import { BookingsRepository } from "@/features/bookings/bookings.repository";
import { BookingsService } from "@/features/bookings/bookings.service";
import { CacheService } from "@/features/cache/cache.service";
import { EmailService } from "@/features/email/email.service";
import { ProfileController } from "@/features/profile/profile.controller";
import { ProfileRepository } from "@/features/profile/profile.repository";
import { ProfileService } from "@/features/profile/profile.service";
import { PostingsAnalyticsRepository } from "@/features/postings/postings.analytics.repository";
import { PostingsAnalyticsService } from "@/features/postings/postings.analytics.service";
import { PostingsController } from "@/features/postings/postings.controller";
import { PostingsReviewsRepository } from "@/features/postings/postings.reviews.repository";
import { PostingsReviewsService } from "@/features/postings/postings.reviews.service";
import { PostingsRepository } from "@/features/postings/postings.repository";
import { PostingsSearchService } from "@/features/postings/postings.search.service";
import { PostingsService } from "@/features/postings/postings.service";
import { RentingsController } from "@/features/rentings/rentings.controller";
import { RentingsRepository } from "@/features/rentings/rentings.repository";
import { RentingsService } from "@/features/rentings/rentings.service";
import type { RootServiceContainer } from "@/configuration/container/core";
import { containerTokens } from "@/configuration/container/tokens";

export function registerApplicationServices(container: RootServiceContainer): void {
  container.register({
    token: containerTokens.cacheService,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new CacheService(),
  });
  container.register({
    token: containerTokens.emailService,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new EmailService(),
  });
  container.register({
    token: containerTokens.captchaService,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new CaptchaService(),
  });
  container.register({
    token: containerTokens.otpService,
    lifetime: "singleton",
    dependencies: [containerTokens.cacheService],
    resolve: ({ resolve }) =>
      new OtpService({
        cache: resolve(containerTokens.cacheService),
      }),
  });
  container.register({
    token: containerTokens.oauthTokenVerifier,
    lifetime: "transient",
    dependencies: [],
    resolve: () => new OAuthTokenVerifier(),
  });
  container.register({
    token: containerTokens.googleOAuthService,
    lifetime: "transient",
    dependencies: [containerTokens.oauthTokenVerifier],
    resolve: ({ resolve }) =>
      new GoogleOAuthService(resolve(containerTokens.oauthTokenVerifier)),
  });
  container.register({
    token: containerTokens.microsoftOAuthService,
    lifetime: "transient",
    dependencies: [containerTokens.oauthTokenVerifier],
    resolve: ({ resolve }) =>
      new MicrosoftOAuthService(resolve(containerTokens.oauthTokenVerifier)),
  });
  container.register({
    token: containerTokens.appleOAuthService,
    lifetime: "transient",
    dependencies: [containerTokens.oauthTokenVerifier],
    resolve: ({ resolve }) =>
      new AppleOAuthService(resolve(containerTokens.oauthTokenVerifier)),
  });
  container.register({
    token: containerTokens.deviceRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new DeviceRepository(),
  });
  container.register({
    token: containerTokens.deviceService,
    lifetime: "singleton",
    dependencies: [
      containerTokens.deviceRepository,
      containerTokens.emailService,
      containerTokens.cacheService,
    ],
    resolve: ({ resolve }) =>
      new DeviceService({
        deviceRepository: resolve(containerTokens.deviceRepository),
        emailService: resolve(containerTokens.emailService),
        cache: resolve(containerTokens.cacheService),
      }),
  });
  container.register({
    token: containerTokens.tokenService,
    lifetime: "singleton",
    dependencies: [containerTokens.cacheService],
    resolve: ({ resolve }) =>
      new TokenService({
        cache: resolve(containerTokens.cacheService),
      }),
  });
  container.register({
    token: containerTokens.authRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new AuthRepository(),
  });
  container.register({
    token: containerTokens.authService,
    lifetime: "scoped",
    dependencies: [
      containerTokens.authRepository,
      containerTokens.tokenService,
      containerTokens.otpService,
      containerTokens.deviceService,
      containerTokens.emailService,
      containerTokens.googleOAuthService,
      containerTokens.microsoftOAuthService,
      containerTokens.appleOAuthService,
    ],
    resolve: ({ resolve }) =>
      new AuthService(
        resolve(containerTokens.authRepository),
        resolve(containerTokens.tokenService),
        resolve(containerTokens.otpService),
        resolve(containerTokens.deviceService),
        resolve(containerTokens.emailService),
        resolve(containerTokens.googleOAuthService),
        resolve(containerTokens.microsoftOAuthService),
        resolve(containerTokens.appleOAuthService),
      ),
  });
  container.register({
    token: containerTokens.authController,
    lifetime: "scoped",
    dependencies: [
      containerTokens.authService,
      containerTokens.captchaService,
      containerTokens.tokenService,
    ],
    resolve: ({ resolve }) =>
      new AuthController(
        resolve(containerTokens.authService),
        resolve(containerTokens.captchaService),
        resolve(containerTokens.tokenService),
      ),
  });
  container.register({
    token: containerTokens.blobService,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new BlobService(),
  });
  container.register({
    token: containerTokens.blobController,
    lifetime: "scoped",
    dependencies: [containerTokens.blobService],
    resolve: ({ resolve }) => new BlobController(resolve(containerTokens.blobService)),
  });
  container.register({
    token: containerTokens.bookingsRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new BookingsRepository(),
  });
  container.register({
    token: containerTokens.rentingsRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new RentingsRepository(),
  });
  container.register({
    token: containerTokens.profileRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new ProfileRepository(),
  });
  container.register({
    token: containerTokens.profileService,
    lifetime: "scoped",
    dependencies: [containerTokens.profileRepository, containerTokens.blobService],
    resolve: ({ resolve }) =>
      new ProfileService(
        resolve(containerTokens.profileRepository),
        resolve(containerTokens.blobService),
      ),
  });
  container.register({
    token: containerTokens.profileController,
    lifetime: "scoped",
    dependencies: [containerTokens.profileService],
    resolve: ({ resolve }) => new ProfileController(resolve(containerTokens.profileService)),
  });
  container.register({
    token: containerTokens.postingsRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new PostingsRepository(),
  });
  container.register({
    token: containerTokens.postingsAnalyticsRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new PostingsAnalyticsRepository(),
  });
  container.register({
    token: containerTokens.postingsAnalyticsService,
    lifetime: "scoped",
    dependencies: [
      containerTokens.postingsAnalyticsRepository,
      containerTokens.postingsRepository,
    ],
    resolve: ({ resolve }) =>
      new PostingsAnalyticsService(
        resolve(containerTokens.postingsAnalyticsRepository),
        resolve(containerTokens.postingsRepository),
      ),
  });
  container.register({
    token: containerTokens.bookingsService,
    lifetime: "scoped",
    dependencies: [
      containerTokens.bookingsRepository,
      containerTokens.postingsRepository,
      containerTokens.postingsAnalyticsRepository,
      containerTokens.rentingsRepository,
    ],
    resolve: ({ resolve }) =>
      new BookingsService(
        resolve(containerTokens.bookingsRepository),
        resolve(containerTokens.postingsRepository),
        resolve(containerTokens.postingsAnalyticsRepository),
        resolve(containerTokens.rentingsRepository),
      ),
  });
  container.register({
    token: containerTokens.bookingsController,
    lifetime: "scoped",
    dependencies: [containerTokens.bookingsService, containerTokens.tokenService],
    resolve: ({ resolve }) =>
      new BookingsController(
        resolve(containerTokens.bookingsService),
        resolve(containerTokens.tokenService),
      ),
  });
  container.register({
    token: containerTokens.rentingsService,
    lifetime: "scoped",
    dependencies: [
      containerTokens.rentingsRepository,
      containerTokens.bookingsRepository,
      containerTokens.postingsAnalyticsRepository,
    ],
    resolve: ({ resolve }) =>
      new RentingsService(
        resolve(containerTokens.rentingsRepository),
        resolve(containerTokens.bookingsRepository),
        resolve(containerTokens.postingsAnalyticsRepository),
      ),
  });
  container.register({
    token: containerTokens.rentingsController,
    lifetime: "scoped",
    dependencies: [containerTokens.rentingsService, containerTokens.tokenService],
    resolve: ({ resolve }) =>
      new RentingsController(
        resolve(containerTokens.rentingsService),
        resolve(containerTokens.tokenService),
      ),
  });
  container.register({
    token: containerTokens.postingsReviewsRepository,
    lifetime: "singleton",
    dependencies: [],
    resolve: () => new PostingsReviewsRepository(),
  });
  container.register({
    token: containerTokens.postingsReviewsService,
    lifetime: "scoped",
    dependencies: [
      containerTokens.postingsReviewsRepository,
      containerTokens.postingsRepository,
    ],
    resolve: ({ resolve }) =>
      new PostingsReviewsService(
        resolve(containerTokens.postingsReviewsRepository),
        resolve(containerTokens.postingsRepository),
      ),
  });
  container.register({
    token: containerTokens.postingsSearchService,
    lifetime: "scoped",
    dependencies: [containerTokens.postingsRepository],
    resolve: ({ resolve }) =>
      new PostingsSearchService(resolve(containerTokens.postingsRepository)),
  });
  container.register({
    token: containerTokens.postingsService,
    lifetime: "scoped",
    dependencies: [
      containerTokens.postingsRepository,
      containerTokens.postingsSearchService,
      containerTokens.blobService,
    ],
    resolve: ({ resolve }) =>
      new PostingsService(
        resolve(containerTokens.postingsRepository),
        resolve(containerTokens.postingsSearchService),
        resolve(containerTokens.blobService),
      ),
  });
  container.register({
    token: containerTokens.postingsController,
    lifetime: "scoped",
    dependencies: [
      containerTokens.postingsService,
      containerTokens.postingsAnalyticsService,
      containerTokens.postingsReviewsService,
      containerTokens.tokenService,
    ],
    resolve: ({ resolve }) =>
      new PostingsController(
        resolve(containerTokens.postingsService),
        resolve(containerTokens.postingsAnalyticsService),
        resolve(containerTokens.postingsReviewsService),
        resolve(containerTokens.tokenService),
      ),
  });
}
