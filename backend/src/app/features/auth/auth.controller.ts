import type { Context } from "hono";
import {
  parseRequestBody,
  RequestValidationError,
} from "@/configuration/validation/request";
import { AuthService } from "@/features/auth/auth.service";
import type {
  LocalAuthenticateRequest,
  LocalSignupRequest,
} from "@/features/auth/auth.model";
import {
  localAuthenticateRequestSchema,
  localSignupRequestSchema,
} from "@/features/auth/auth.model";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  localAuthenticate = async (context: Context): Promise<Response> => {
    try {
      const input = await parseRequestBody(context, localAuthenticateRequestSchema);
      const result = await this.authService.localAuthenticate(input);

      return context.json(result);
    } catch (error) {
      return this.handleAuthError(context, error);
    }
  };

  localSignup = async (context: Context): Promise<Response> => {
    try {
      const input = await parseRequestBody(context, localSignupRequestSchema);
      const result = await this.authService.localSignup(input);

      return context.json(result, 201);
    } catch (error) {
      return this.handleAuthError(context, error);
    }
  };

  localVerify = async (context: Context): Promise<Response> => {
    const result = await this.authService.localVerify();
    return context.json(result);
  };

  googleAuthenticate = async (context: Context): Promise<Response> => {
    const result = await this.authService.googleAuthenticate();
    return context.json(result);
  };

  microsoftAuthenticate = async (context: Context): Promise<Response> => {
    const result = await this.authService.microsoftAuthenticate();
    return context.json(result);
  };

  appleAuthenticate = async (context: Context): Promise<Response> => {
    const result = await this.authService.appleAuthenticate();
    return context.json(result);
  };

  refresh = async (context: Context): Promise<Response> => {
    const result = await this.authService.refresh();
    return context.json(result);
  };

  logout = async (context: Context): Promise<Response> => {
    const result = await this.authService.logout();
    return context.json(result);
  };

  deviceVerify = async (context: Context): Promise<Response> => {
    const result = await this.authService.deviceVerify();
    return context.json(result);
  };

  devices = async (context: Context): Promise<Response> => {
    const result = await this.authService.devices();
    return context.json(result);
  };

  private handleAuthError(context: Context, error: unknown): Response {
    if (error instanceof RequestValidationError) {
      return context.json(
        {
          error: error.message,
          details: error.details,
        },
        400,
      );
    }

    const message = error instanceof Error ? error.message : "Authentication request failed.";
    const status =
      message === "Invalid email or password."
        ? 401
        : message === "An account with this email already exists."
          ? 409
          : 400;

    return context.json(
      {
        error: message,
      },
      status,
    );
  }
}
