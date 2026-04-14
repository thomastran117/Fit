import type { JwtClaims } from "@/features/auth/token/token.service";

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
    auth: JwtClaims;
    client: ClientRequestContext;
    clientSignature: ClientSignatureContext;
    outputFormat: OutputFormat;
  };
}
