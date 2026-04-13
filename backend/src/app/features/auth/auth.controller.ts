import type { Context } from "hono";
import type { AppBindings } from "@/configuration/http/bindings";
import { parseRequestBody } from "@/configuration/validation/request";
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

  localAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, localAuthenticateRequestSchema);
    const result = await this.authService.localAuthenticate(this.withClientDeviceId(context, input));

    return context.json(result);
  };

  localSignup = async (context: Context<AppBindings>): Promise<Response> => {
    const input = await parseRequestBody(context, localSignupRequestSchema);
    const result = await this.authService.localSignup(this.withClientDeviceId(context, input));

    return context.json(result, 201);
  };

  localVerify = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.localVerify({
      auth: context.get("auth"),
      client: context.get("client"),
    });
    return context.json(result);
  };

  googleAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.googleAuthenticate();
    return context.json(result);
  };

  microsoftAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.microsoftAuthenticate();
    return context.json(result);
  };

  appleAuthenticate = async (context: Context<AppBindings>): Promise<Response> => {
    const result = await this.authService.appleAuthenticate();
    return context.json(result);
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

  private withClientDeviceId<TInput extends { deviceId?: string }>(
    context: Context<AppBindings>,
    input: TInput,
  ): TInput {
    const deviceId = input.deviceId ?? context.get("client").device.id;

    if (!deviceId) {
      return input;
    }

    return {
      ...input,
      deviceId,
    };
  }
}
