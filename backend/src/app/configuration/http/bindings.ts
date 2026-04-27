import type { AuthPrincipal } from "@/features/auth/auth.principal";
import type { ServiceContainer } from "@/configuration/bootstrap/container";

export type OutputFormat = "json" | "xml";

export interface ClientSignatureContext {
  clientId: string;
  timestamp: number;
  signature: string;
  payload: string;
}

export interface ClientDeviceContext {
  id?: string;
  type: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  isMobile: boolean;
  userAgent?: string;
  platform?: string;
}

export interface ClientRequestContext {
  ip?: string;
  device: ClientDeviceContext;
}

export interface AppBindings {
  Variables: {
    auth: AuthPrincipal;
    client: ClientRequestContext;
    clientSignature: ClientSignatureContext;
    container: ServiceContainer;
    idempotencyKey: string;
    outputFormat: OutputFormat;
    requestId: string;
  };
}
