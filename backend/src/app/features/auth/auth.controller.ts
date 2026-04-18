import { randomUUID } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { parseRequestBody } from "@/configuration/validation/request";
import { environment } from "@/configuration/environment";
import BadRequestError from "@/errors/http/bad-request.error";
import { AuthService } from "@/features/auth/auth.service";
import { CaptchaService } from "@/features/auth/captcha/captcha.service";
import { TokenService } from "@/features/auth/token/token.service";
import type {
  AuthResponseBody,
  AuthSessionResult,
  ChangePasswordInput,
  ChangePasswordRequestBody,
  ForgotPasswordInput,
  ForgotPasswordRequestBody,
  LocalAuthenticateInput,
  LocalAuthenticateRequestBody,
  LocalSignupInput,
  LocalSignupRequestBody,
  OAuthAuthenticateInput,
  OAuthAuthenticateRequestBody,
  RefreshInput,
  RefreshRequestBody,
  ResetPasswordInput,
  ResetPasswordRequestBody,
  RemoveKnownDeviceInput,
  RemoveKnownDeviceRequestBody,
  ResendForgotPasswordInput,
  ResendForgotPasswordRequestBody,
  ResendUnlockLocalLoginInput,
  ResendUnlockLocalLoginRequestBody,
  ResendVerificationEmailInput,
  ResendVerificationEmailRequestBody,
  SignupVerificationPendingResult,
  UnlockLocalLoginInput,
  UnlockLocalLoginRequestBody,
  VerifyEmailInput,
  VerifyEmailRequestBody,
} from "@/features/auth/auth.model";
import {
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  localAuthenticateRequestSchema,
  localSignupRequestSchema,
  oauthAuthenticateRequestSchema,
  refreshRequestSchema,
  removeKnownDeviceRequestSchema,
  resendForgotPasswordRequestSchema,
  resendUnlockLocalLoginRequestSchema,
  resetPasswordRequestSchema,
  resendVerificationEmailRequestSchema,
  unlockLocalLoginRequestSchema,
  verifyEmailRequestSchema,
} from "@/features/auth/auth.model";

export class AuthController {
  private static readonly REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
    private readonly tokenService: TokenService,
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

  forgotPassword = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, forgotPasswordRequestSchema);
    await this.verifyCaptcha(context, input.captchaToken);
    const result = await this.authService.forgotPassword(this.toForgotPasswordInput(input));
    return context.json(result, 202);
  };

  resendForgotPassword = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, resendForgotPasswordRequestSchema);
    const result = await this.authService.resendForgotPassword(
      this.toResendForgotPasswordInput(input),
    );
    return context.json(result, 202);
  };

  resetPassword = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, resetPasswordRequestSchema);
    const result = await this.authService.resetPassword(this.toResetPasswordInput(context, input));
    return this.json(context, result);
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

  changePassword = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, changePasswordRequestSchema);
    const result = await this.authService.changePassword(
      this.toChangePasswordInput(context, input),
    );
    return this.json(context, result);
  };

  unlockLocalLogin = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, unlockLocalLoginRequestSchema);
    const result = await this.authService.unlockLocalLogin(this.toUnlockLocalLoginInput(input));
    return context.json(result);
  };

  resendUnlockLocalLogin = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, resendUnlockLocalLoginRequestSchema);
    const result = await this.authService.resendUnlockLocalLogin(
      this.toResendUnlockLocalLoginInput(input),
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
    const input = await parseRequestBody(context, refreshRequestSchema);
    const result = await this.authService.refresh(this.toRefreshInput(context, input));
    return this.json(context, result);
  };

  logout = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.logout({
      auth: context.get("auth"),
      client: context.get("client"),
      refreshToken: getCookie(context, AuthController.REFRESH_TOKEN_COOKIE_NAME),
    });

    deleteCookie(context, AuthController.REFRESH_TOKEN_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: this.isSecureCookieEnabled(),
      sameSite: "Lax",
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
        maxAge: this.tokenService.getRefreshTokenExpiresInSeconds(),
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
      client: context.get("client"),
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
      code: input.code,
      codeVerifier: input.codeVerifier,
      idToken: input.idToken,
      nonce: input.nonce,
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

  private toForgotPasswordInput(input: ForgotPasswordRequestBody): ForgotPasswordInput {
    return {
      email: input.email,
    };
  }

  private toResendForgotPasswordInput(
    input: ResendForgotPasswordRequestBody,
  ): ResendForgotPasswordInput {
    return {
      email: input.email,
    };
  }

  private toRefreshInput(
    context: Context<AppBindings>,
    input: RefreshRequestBody,
  ): RefreshInput {
    return {
      client: context.get("client"),
      refreshToken: input.refreshToken ?? getCookie(context, AuthController.REFRESH_TOKEN_COOKIE_NAME),
    };
  }

  private toResetPasswordInput(
    context: Context<AppBindings>,
    input: ResetPasswordRequestBody,
  ): ResetPasswordInput {
    return {
      client: context.get("client"),
      email: input.email,
      code: input.code,
      newPassword: input.newPassword,
      deviceId: this.resolveDeviceId(context, input.deviceId),
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

  private toUnlockLocalLoginInput(input: UnlockLocalLoginRequestBody): UnlockLocalLoginInput {
    return {
      email: input.email,
      code: input.code,
    };
  }

  private toResendUnlockLocalLoginInput(
    input: ResendUnlockLocalLoginRequestBody,
  ): ResendUnlockLocalLoginInput {
    return {
      email: input.email,
    };
  }

  private toChangePasswordInput(
    context: Context<AppBindings>,
    input: ChangePasswordRequestBody,
  ): ChangePasswordInput {
    return {
      userId: context.get("auth").sub,
      client: context.get("client"),
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      deviceId: context.get("auth").deviceId ?? context.get("client").device.id,
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
        avatarUrl: result.user.avatarUrl,
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
    return environment.isProduction();
  }
  private async verifyCaptcha(context: Context<AppBindings>, captchaToken: string): Promise<void> {
    const result = await this.captchaService.verify({
      token: captchaToken,
      remoteIp: context.get("client").ip,
      idempotencyKey: context.req.header("x-request-id") ?? randomUUID(),
    });

    if (!result.success || result.failOpen) {
      throw new BadRequestError("Captcha verification failed.", {
        errors: result.errors,
        failOpen: result.failOpen,
      });
    }
  }
}
