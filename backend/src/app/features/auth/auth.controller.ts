import type { Context } from "hono";
import { AuthService } from "@/features/auth/auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  localAuthenticate = async (context: Context): Promise<Response> => {
    const result = await this.authService.localAuthenticate();
    return context.json(result);
  };

  localSignup = async (context: Context): Promise<Response> => {
    const result = await this.authService.localSignup();
    return context.json(result);
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
}
