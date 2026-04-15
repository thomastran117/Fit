import { AuthController } from "@/features/auth/auth.controller";
import { CaptchaService } from "@/features/auth/captcha/captcha.service";
import { DeviceRepository } from "@/features/auth/device/device.repository";
import { DeviceService } from "@/features/auth/device/device.service";
import { OtpService } from "@/features/auth/otp/otp.service";
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

export interface ApplicationContainer {
  cacheService: CacheService;
  emailService: EmailService;
  captchaService: CaptchaService;
  otpService: OtpService;
  deviceRepository: DeviceRepository;
  deviceService: DeviceService;
  tokenService: TokenService;
  authRepository: AuthRepository;
  authService: AuthService;
  authController: AuthController;
  blobService: BlobService;
  blobController: BlobController;
  bookingsRepository: BookingsRepository;
  bookingsService: BookingsService;
  bookingsController: BookingsController;
  profileRepository: ProfileRepository;
  profileService: ProfileService;
  profileController: ProfileController;
  postingsRepository: PostingsRepository;
  rentingsRepository: RentingsRepository;
  rentingsService: RentingsService;
  rentingsController: RentingsController;
  postingsAnalyticsRepository: PostingsAnalyticsRepository;
  postingsAnalyticsService: PostingsAnalyticsService;
  postingsReviewsRepository: PostingsReviewsRepository;
  postingsReviewsService: PostingsReviewsService;
  postingsSearchService: PostingsSearchService;
  postingsService: PostingsService;
  postingsController: PostingsController;
}

let container: ApplicationContainer | null = null;

function createContainer(): ApplicationContainer {
  const cacheService = new CacheService();
  const emailService = EmailService.create();
  const captchaService = CaptchaService.create();
  const deviceRepository = new DeviceRepository();
  const deviceService = new DeviceService({
    deviceRepository,
    emailService,
    cache: cacheService,
  });
  const otpService = new OtpService({
    cache: cacheService,
  });
  const tokenService = new TokenService({
    cache: cacheService,
  });
  const blobService = new BlobService();
  const bookingsRepository = new BookingsRepository();
  const rentingsRepository = new RentingsRepository();
  const profileRepository = new ProfileRepository();
  const profileService = new ProfileService(profileRepository, blobService);
  const profileController = new ProfileController(profileService);
  const postingsRepository = new PostingsRepository();
  const postingsAnalyticsRepository = new PostingsAnalyticsRepository();
  const postingsAnalyticsService = new PostingsAnalyticsService(
    postingsAnalyticsRepository,
    postingsRepository,
  );
  const bookingsService = new BookingsService(
    bookingsRepository,
    postingsRepository,
    postingsAnalyticsRepository,
    rentingsRepository,
  );
  const bookingsController = new BookingsController(bookingsService);
  const rentingsService = new RentingsService(rentingsRepository, bookingsRepository);
  const rentingsController = new RentingsController(rentingsService);
  const postingsReviewsRepository = new PostingsReviewsRepository();
  const postingsReviewsService = new PostingsReviewsService(
    postingsReviewsRepository,
    postingsRepository,
  );
  const postingsSearchService = new PostingsSearchService(postingsRepository);
  const postingsService = new PostingsService(
    postingsRepository,
    postingsSearchService,
    blobService,
  );
  const postingsController = new PostingsController(
    postingsService,
    postingsAnalyticsService,
    postingsReviewsService,
  );
  const authRepository = new AuthRepository();
  const authService = AuthService.create({
    authRepository,
    tokenService,
    otpService,
    deviceService,
    emailService,
  });
  const authController = new AuthController(authService, captchaService);
  const blobController = new BlobController(blobService);

  return {
    cacheService,
    emailService,
    captchaService,
    otpService,
    deviceRepository,
    deviceService,
    tokenService,
    authRepository,
    authService,
    authController,
    blobService,
    blobController,
    bookingsRepository,
    bookingsService,
    bookingsController,
    rentingsRepository,
    rentingsService,
    rentingsController,
    profileRepository,
    profileService,
    profileController,
    postingsRepository,
    postingsAnalyticsRepository,
    postingsAnalyticsService,
    postingsReviewsRepository,
    postingsReviewsService,
    postingsSearchService,
    postingsService,
    postingsController,
  };
}

export function initializeContainer(): ApplicationContainer {
  if (container) {
    return container;
  }

  container = createContainer();
  return container;
}

export function getContainer(): ApplicationContainer {
  if (!container) {
    throw new Error("Application container has not been initialized. Call initializeContainer() first.");
  }

  return container;
}


