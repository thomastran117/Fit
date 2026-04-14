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
import { CacheService } from "@/features/cache/cache.service";
import { EmailService } from "@/features/email/email.service";
import { ProfileController } from "@/features/profile/profile.controller";
import { ProfileRepository } from "@/features/profile/profile.repository";
import { ProfileService } from "@/features/profile/profile.service";
import { RentingsAnalyticsRepository } from "@/features/rentings/rentings.analytics.repository";
import { RentingsAnalyticsService } from "@/features/rentings/rentings.analytics.service";
import { RentingsController } from "@/features/rentings/rentings.controller";
import { RentingsRepository } from "@/features/rentings/rentings.repository";
import { RentingsSearchService } from "@/features/rentings/rentings.search.service";
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
  profileRepository: ProfileRepository;
  profileService: ProfileService;
  profileController: ProfileController;
  rentingsRepository: RentingsRepository;
  rentingsAnalyticsRepository: RentingsAnalyticsRepository;
  rentingsAnalyticsService: RentingsAnalyticsService;
  rentingsSearchService: RentingsSearchService;
  rentingsService: RentingsService;
  rentingsController: RentingsController;
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
  const profileRepository = new ProfileRepository();
  const profileService = new ProfileService(profileRepository, blobService);
  const profileController = new ProfileController(profileService);
  const rentingsRepository = new RentingsRepository();
  const rentingsAnalyticsRepository = new RentingsAnalyticsRepository();
  const rentingsAnalyticsService = new RentingsAnalyticsService(
    rentingsAnalyticsRepository,
    rentingsRepository,
  );
  const rentingsSearchService = new RentingsSearchService(rentingsRepository);
  const rentingsService = new RentingsService(
    rentingsRepository,
    rentingsSearchService,
    blobService,
  );
  const rentingsController = new RentingsController(
    rentingsService,
    rentingsAnalyticsService,
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
    profileRepository,
    profileService,
    profileController,
    rentingsRepository,
    rentingsAnalyticsRepository,
    rentingsAnalyticsService,
    rentingsSearchService,
    rentingsService,
    rentingsController,
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
