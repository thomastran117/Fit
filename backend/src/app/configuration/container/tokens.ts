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
import type { PaymentProviderAdapter } from "@/features/payments/payment-provider";
import { PaymentsController } from "@/features/payments/payments.controller";
import { PaymentsRepository } from "@/features/payments/payments.repository";
import { PaymentsService } from "@/features/payments/payments.service";
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
import { SearchController } from "@/features/search/search.controller";
import { SearchQueueService } from "@/features/search/search.queue.service";
import { SearchService } from "@/features/search/search.service";
import { ContentSanitizationService } from "@/features/security/content-sanitization.service";
import { createServiceToken } from "@/configuration/container/core";

export const containerTokens = {
  cacheService: createServiceToken<CacheService>("CacheService"),
  emailService: createServiceToken<EmailService>("EmailService"),
  captchaService: createServiceToken<CaptchaService>("CaptchaService"),
  otpService: createServiceToken<OtpService>("OtpService"),
  oauthTokenVerifier: createServiceToken<OAuthTokenVerifier>("OAuthTokenVerifier"),
  googleOAuthService: createServiceToken<GoogleOAuthService>("GoogleOAuthService"),
  microsoftOAuthService: createServiceToken<MicrosoftOAuthService>("MicrosoftOAuthService"),
  appleOAuthService: createServiceToken<AppleOAuthService>("AppleOAuthService"),
  deviceRepository: createServiceToken<DeviceRepository>("DeviceRepository"),
  deviceService: createServiceToken<DeviceService>("DeviceService"),
  tokenService: createServiceToken<TokenService>("TokenService"),
  authRepository: createServiceToken<AuthRepository>("AuthRepository"),
  authService: createServiceToken<AuthService>("AuthService"),
  authController: createServiceToken<AuthController>("AuthController"),
  blobService: createServiceToken<BlobService>("BlobService"),
  blobController: createServiceToken<BlobController>("BlobController"),
  bookingsRepository: createServiceToken<BookingsRepository>("BookingsRepository"),
  bookingsService: createServiceToken<BookingsService>("BookingsService"),
  bookingsController: createServiceToken<BookingsController>("BookingsController"),
  paymentsRepository: createServiceToken<PaymentsRepository>("PaymentsRepository"),
  paymentProvider: createServiceToken<PaymentProviderAdapter>("PaymentProvider"),
  paymentsService: createServiceToken<PaymentsService>("PaymentsService"),
  paymentsController: createServiceToken<PaymentsController>("PaymentsController"),
  profileRepository: createServiceToken<ProfileRepository>("ProfileRepository"),
  profileService: createServiceToken<ProfileService>("ProfileService"),
  profileController: createServiceToken<ProfileController>("ProfileController"),
  postingsRepository: createServiceToken<PostingsRepository>("PostingsRepository"),
  rentingsRepository: createServiceToken<RentingsRepository>("RentingsRepository"),
  rentingsService: createServiceToken<RentingsService>("RentingsService"),
  rentingsController: createServiceToken<RentingsController>("RentingsController"),
  postingsAnalyticsRepository: createServiceToken<PostingsAnalyticsRepository>(
    "PostingsAnalyticsRepository",
  ),
  postingsAnalyticsService: createServiceToken<PostingsAnalyticsService>(
    "PostingsAnalyticsService",
  ),
  postingsReviewsRepository: createServiceToken<PostingsReviewsRepository>(
    "PostingsReviewsRepository",
  ),
  postingsReviewsService: createServiceToken<PostingsReviewsService>("PostingsReviewsService"),
  postingsSearchService: createServiceToken<PostingsSearchService>("PostingsSearchService"),
  searchQueueService: createServiceToken<SearchQueueService>("SearchQueueService"),
  searchService: createServiceToken<SearchService>("SearchService"),
  searchController: createServiceToken<SearchController>("SearchController"),
  contentSanitizationService: createServiceToken<ContentSanitizationService>(
    "ContentSanitizationService",
  ),
  postingsService: createServiceToken<PostingsService>("PostingsService"),
  postingsController: createServiceToken<PostingsController>("PostingsController"),
} as const;
