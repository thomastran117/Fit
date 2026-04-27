import type { AppRole } from "@/features/auth/auth.model";
import type { JwtClaims } from "@/features/auth/token/token.service";

export interface PersonalAccessTokenPrincipal {
  sub: string;
  email?: string;
  role?: AppRole;
  deviceId?: string;
  authMethod: "pat";
  scopes: string[];
  personalAccessTokenId: string;
  personalAccessTokenName: string;
}

export interface JwtAuthPrincipal extends JwtClaims {
  authMethod: "jwt";
}

export type AuthPrincipal = JwtAuthPrincipal | PersonalAccessTokenPrincipal;
