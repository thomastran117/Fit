import { publicEnv } from "@/lib/env";
import {
  ApiError,
  type ApiErrorResponse,
  type AuthResponseBody,
  type SignupVerificationPendingResult,
} from "@/lib/auth/types";

interface LoginInput {
  email: string;
  password: string;
  captchaToken: string;
}

interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  captchaToken: string;
}

interface VerifyEmailInput {
  email: string;
  code: string;
}

interface ResendVerificationEmailInput {
  email: string;
}

interface OAuthAuthenticateInput {
  nonce: string;
  code?: string;
  codeVerifier?: string;
  idToken?: string;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function postJson<TResponse, TBody extends object = object>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(`${publicEnv.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as Partial<ApiErrorResponse>;
    throw new ApiError(
      errorPayload.error ?? "Something went wrong.",
      errorPayload.code ?? "UNKNOWN_ERROR",
      response.status,
      errorPayload.details,
    );
  }

  return payload as TResponse;
}

export const authApi = {
  login(input: LoginInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/local/login", input);
  },
  logout(): Promise<{ loggedOut: true }> {
    return postJson<{ loggedOut: true }>("/auth/logout", {});
  },
  authenticateWithGoogle(input: OAuthAuthenticateInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/oauth/google", input);
  },
  authenticateWithMicrosoft(input: OAuthAuthenticateInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/oauth/microsoft", input);
  },
  signup(input: SignupInput): Promise<SignupVerificationPendingResult> {
    return postJson<SignupVerificationPendingResult>("/auth/local/signup", input);
  },
  verifyEmail(input: VerifyEmailInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/local/email/verify", input);
  },
  resendVerificationEmail(
    input: ResendVerificationEmailInput,
  ): Promise<{ resent: true; email: string }> {
    return postJson<{ resent: true; email: string }>("/auth/local/email/resend", input);
  },
};
