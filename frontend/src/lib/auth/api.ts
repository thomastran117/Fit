import { publicEnv } from "@/lib/env";
import { getDeviceId, getDevicePlatform } from "@/lib/auth/device";
import { readStoredSession } from "@/lib/auth/storage";
import {
  ApiError,
  type ApiErrorResponse,
  type AuthResponseBody,
  type ForgotPasswordAcceptedResult,
  type SignupVerificationPendingResult,
} from "@/lib/auth/types";

interface LoginInput {
  email: string;
  password: string;
  captchaToken: string;
  deviceId?: string;
}

interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  captchaToken: string;
  deviceId?: string;
}

interface VerifyEmailInput {
  email: string;
  code: string;
  deviceId?: string;
}

interface ResendVerificationEmailInput {
  email: string;
}

interface ForgotPasswordInput {
  email: string;
  captchaToken: string;
}

interface ResendForgotPasswordInput {
  email: string;
}

interface ResetPasswordInput {
  email: string;
  code: string;
  newPassword: string;
  deviceId?: string;
}

interface UnlockLocalLoginInput {
  email: string;
  code: string;
}

interface ResendUnlockLocalLoginInput {
  email: string;
}

interface OAuthAuthenticateInput {
  nonce: string;
  code?: string;
  codeVerifier?: string;
  idToken?: string;
  deviceId?: string;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  deviceId?: string;
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
  const deviceId = getDeviceId();
  const devicePlatform = getDevicePlatform();
  const response = await fetch(`${publicEnv.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(deviceId ? { "x-device-id": deviceId } : {}),
      ...(devicePlatform ? { "x-device-platform": devicePlatform } : {}),
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

async function postAuthenticatedJson<TResponse, TBody extends object = object>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const deviceId = getDeviceId();
  const devicePlatform = getDevicePlatform();
  const session = readStoredSession();
  const response = await fetch(`${publicEnv.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...(deviceId ? { "x-device-id": deviceId } : {}),
      ...(devicePlatform ? { "x-device-platform": devicePlatform } : {}),
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
    return postJson<AuthResponseBody>("/auth/local/login", {
      ...input,
      deviceId: input.deviceId ?? getDeviceId(),
    });
  },
  logout(): Promise<{ loggedOut: true }> {
    return postJson<{ loggedOut: true }>("/auth/logout", {});
  },
  authenticateWithGoogle(input: OAuthAuthenticateInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/oauth/google", {
      ...input,
      deviceId: input.deviceId ?? getDeviceId(),
    });
  },
  authenticateWithMicrosoft(input: OAuthAuthenticateInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/oauth/microsoft", {
      ...input,
      deviceId: input.deviceId ?? getDeviceId(),
    });
  },
  signup(input: SignupInput): Promise<SignupVerificationPendingResult> {
    return postJson<SignupVerificationPendingResult>("/auth/local/signup", {
      ...input,
      deviceId: input.deviceId ?? getDeviceId(),
    });
  },
  verifyEmail(input: VerifyEmailInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/local/email/verify", {
      ...input,
      deviceId: input.deviceId ?? getDeviceId(),
    });
  },
  resendVerificationEmail(
    input: ResendVerificationEmailInput,
  ): Promise<{ resent: true; email: string }> {
    return postJson<{ resent: true; email: string }>("/auth/local/email/resend", input);
  },
  forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordAcceptedResult> {
    return postJson<ForgotPasswordAcceptedResult>("/auth/local/password/forgot", input);
  },
  resendForgotPassword(
    input: ResendForgotPasswordInput,
  ): Promise<ForgotPasswordAcceptedResult> {
    return postJson<ForgotPasswordAcceptedResult>("/auth/local/password/forgot/resend", input);
  },
  resetPassword(input: ResetPasswordInput): Promise<AuthResponseBody> {
    return postJson<AuthResponseBody>("/auth/local/password/reset", {
      ...input,
      deviceId: input.deviceId ?? getDeviceId(),
    });
  },
  unlockLocalLogin(input: UnlockLocalLoginInput): Promise<{ unlocked: true; email: string }> {
    return postJson<{ unlocked: true; email: string }>("/auth/local/unlock", {
      ...input,
      deviceId: getDeviceId(),
    });
  },
  resendUnlockLocalLogin(
    input: ResendUnlockLocalLoginInput,
  ): Promise<{ resent: true; email: string }> {
    return postJson<{ resent: true; email: string }>("/auth/local/unlock/resend", input);
  },
  changePassword(input: ChangePasswordInput): Promise<AuthResponseBody> {
    return postAuthenticatedJson<AuthResponseBody>("/auth/local/password/change", {
      ...input,
      deviceId: input.deviceId ?? getDeviceId(),
    });
  },
};
