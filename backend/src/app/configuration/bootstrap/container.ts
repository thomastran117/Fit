import { AuthController } from "@/features/auth/auth.controller";
import { AuthRepository } from "@/features/auth/auth.repository";
import { AuthService } from "@/features/auth/auth.service";
import { TokenService } from "@/features/auth/token/token.service";
import { CacheService } from "@/features/cache/cache.service";

export interface ApplicationContainer {
  cacheService: CacheService;
  tokenService: TokenService;
  authRepository: AuthRepository;
  authService: AuthService;
  authController: AuthController;
}

let container: ApplicationContainer | null = null;

function createContainer(): ApplicationContainer {
  const cacheService = new CacheService();
  const tokenService = new TokenService({
    cache: cacheService,
  });
  const authRepository = new AuthRepository();
  const authService = AuthService.create({
    authRepository,
    tokenService,
  });
  const authController = new AuthController(authService);

  return {
    cacheService,
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
