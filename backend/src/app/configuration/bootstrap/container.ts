import { AuthController } from "@/features/auth/auth.controller";
import { OtpService } from "@/features/auth/otp/otp.service";
import { AuthRepository } from "@/features/auth/auth.repository";
import { AuthService } from "@/features/auth/auth.service";
import { TokenService } from "@/features/auth/token/token.service";
import { CacheService } from "@/features/cache/cache.service";
import { EmailService } from "@/features/email/email.service";

export interface ApplicationContainer {
  cacheService: CacheService;
  emailService: EmailService;
  otpService: OtpService;
  tokenService: TokenService;
  authRepository: AuthRepository;
  authService: AuthService;
  authController: AuthController;
}

let container: ApplicationContainer | null = null;

function createContainer(): ApplicationContainer {
  const cacheService = new CacheService();
  const emailService = EmailService.create();
  const otpService = new OtpService({
    cache: cacheService,
  });
  const tokenService = new TokenService({
    cache: cacheService,
  });
  const authRepository = new AuthRepository();
  const authService = AuthService.create({
    authRepository,
    tokenService,
    otpService,
    emailService,
  });
  const authController = new AuthController(authService);

  return {
    cacheService,
    emailService,
    otpService,
    tokenService,
    authRepository,
    authService,
    authController,
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
