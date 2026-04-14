import { randomUUID } from "node:crypto";
import { setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { parseRequestBody } from "@/configuration/validation/request";
import BadRequestError from "@/errors/http/bad-request.error";
import { AuthService } from "@/features/auth/auth.service";
import { CaptchaService } from "@/features/auth/captcha/captcha.service";
import { tokenService } from "@/features/auth/token/token.service";
import type {
  AuthResponseBody,
  AuthSessionResult,
  LocalAuthenticateInput,
  LocalAuthenticateRequestBody,
  LocalSignupInput,
  LocalSignupRequestBody,
  OAuthAuthenticateInput,
  OAuthAuthenticateRequestBody,
  RemoveKnownDeviceInput,
  RemoveKnownDeviceRequestBody,
  ResendVerificationEmailInput,
  ResendVerificationEmailRequestBody,
  SignupVerificationPendingResult,
  VerifyEmailInput,
  VerifyEmailRequestBody,
} from "@/features/auth/auth.model";
import {
  localAuthenticateRequestSchema,
  localSignupRequestSchema,
  oauthAuthenticateRequestSchema,
  removeKnownDeviceRequestSchema,
  resendVerificationEmailRequestSchema,
  verifyEmailRequestSchema,
} from "@/features/auth/auth.model";

export class AuthController {
  private static readonly REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  localAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, localAuthenticateRequestSchema);
    await this.verifyCaptcha(context, input.captchaToken);
    const result = await this.authService.localAuthenticate(
      this.toLocalAuthenticateInput(context, input),
    );

    return this.json(context, result);
  };

  localSignup = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, localSignupRequestSchema);
    await this.verifyCaptcha(context, input.captchaToken);
    const result = await this.authService.localSignup(this.toLocalSignupInput(context, input));

    return context.json(result, 202);
  };

  verifyEmail = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, verifyEmailRequestSchema);
    const result = await this.authService.verifyEmail(this.toVerifyEmailInput(context, input));
    return this.json(context, result);
  };

  resendVerificationEmail = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, resendVerificationEmailRequestSchema);
    const result = await this.authService.resendVerificationEmail(
      this.toResendVerificationEmailInput(input),
    );
    return context.json(result, 202);
  };

  localVerify = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.localVerify({
      auth: context.get("auth"),
      client: context.get("client"),
    });
    return context.json(result);
  };

  googleAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, oauthAuthenticateRequestSchema);
    const result = await this.authService.googleAuthenticate(
      this.toOAuthAuthenticateInput(context, input),
    );
    return this.json(context, result);
  };

  microsoftAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, oauthAuthenticateRequestSchema);
    const result = await this.authService.microsoftAuthenticate(
      this.toOAuthAuthenticateInput(context, input),
    );
    return this.json(context, result);
  };

  appleAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, oauthAuthenticateRequestSchema);
    const result = await this.authService.appleAuthenticate(
      this.toOAuthAuthenticateInput(context, input),
    );
    return this.json(context, result);
  };

  refresh = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.refresh();
    return context.json(result);
  };

  logout = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.logout({
      auth: context.get("auth"),
      client: context.get("client"),
    });
    return context.json(result);
  };

  deviceVerify = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.deviceVerify({
      auth: context.get("auth"),
      client: context.get("client"),
    });
    return context.json(result);
  };

  devices = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.devices({
      auth: context.get("auth"),
      client: context.get("client"),
    });
    return context.json(result);
  };

  removeKnownDevice = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, removeKnownDeviceRequestSchema);
    const result = await this.authService.removeKnownDevice(
      this.toRemoveKnownDeviceInput(context, input),
    );
    return context.json(result);
  };

  private json(
    context: Context<AppBindings>,
    body: AuthSessionResult,
    status?: 200 | 201,
  ): Response {
    const responseBody = this.toAuthResponseBody(context, body);

    if (this.shouldSetRefreshCookie(context)) {
      setCookie(context, AuthController.REFRESH_TOKEN_COOKIE_NAME, body.refreshToken, {
        path: "/",
        httpOnly: true,
        secure: this.isSecureCookieEnabled(),
        sameSite: "Lax",
        maxAge: tokenService.getRefreshTokenExpiresInSeconds(),
      });
    }

    return context.json(responseBody, status);
  }

  private toLocalAuthenticateInput(
    context: Context<AppBindings>,
    input: LocalAuthenticateRequestBody,
  ): LocalAuthenticateInput {
    return {
      email: input.email,
      password: input.password,
      client: context.get("client"),
      deviceId: this.resolveDeviceId(context, input.deviceId),
    };
  }

  private toLocalSignupInput(
    context: Context<AppBindings>,
    input: LocalSignupRequestBody,
  ): LocalSignupInput {
    return {
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      deviceId: this.resolveDeviceId(context, input.deviceId),
    };
  }

  private toOAuthAuthenticateInput(
    context: Context<AppBindings>,
    input: OAuthAuthenticateRequestBody,
  ): OAuthAuthenticateInput {
    return {
      idToken: input.idToken,
      client: context.get("client"),
      firstName: input.firstName,
      lastName: input.lastName,
      deviceId: this.resolveDeviceId(context, input.deviceId),
    };
  }

  private resolveDeviceId(context: Context<AppBindings>, deviceId?: string): string | undefined {
    return deviceId ?? context.get("client").device.id;
  }

  private toVerifyEmailInput(
    context: Context<AppBindings>,
    input: VerifyEmailRequestBody,
  ): VerifyEmailInput {
    return {
      client: context.get("client"),
      email: input.email,
      code: input.code,
      deviceId: this.resolveDeviceId(context, input.deviceId),
    };
  }

  private toResendVerificationEmailInput(
    input: ResendVerificationEmailRequestBody,
  ): ResendVerificationEmailInput {
    return {
      email: input.email,
    };
  }

  private toRemoveKnownDeviceInput(
    context: Context<AppBindings>,
    input: RemoveKnownDeviceRequestBody,
  ): RemoveKnownDeviceInput {
    return {
      userId: context.get("auth").sub,
      deviceId: input.deviceId,
    };
  }

  private toAuthResponseBody(
    context: Context<AppBindings>,
    result: AuthSessionResult,
  ): AuthResponseBody {
    const responseBody: AuthResponseBody = {
      accessToken: result.accessToken,
      device: result.device,
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
      },
    };

    if (!this.shouldSetRefreshCookie(context)) {
      responseBody.refreshToken = result.refreshToken;
    }

    return responseBody;
  }

  private shouldSetRefreshCookie(context: Context<AppBindings>): boolean {
    const clientDevice = context.get("client").device;

    if (clientDevice.isMobile) {
      return false;
    }

    return clientDevice.type === "desktop";
  }

  private isSecureCookieEnabled(): boolean {
    return process.env.NODE_ENV === "production";
  }
  private async verifyCaptcha(context: Context<AppBindings>, captchaToken: string): Promise<void> {
    const result = await this.captchaService.verify({
      token: captchaToken,
      remoteIp: context.get("client").ip,
      idempotencyKey: context.req.header("x-request-id") ?? randomUUID(),
    });

    if (!result.success) {
      throw new BadRequestError("Captcha verification failed.", {
        errors: result.errors,
        failOpen: result.failOpen,
      });
    }
  }
}
