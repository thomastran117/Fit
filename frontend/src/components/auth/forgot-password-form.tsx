"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCaptchaPanel } from "@/components/auth/auth-captcha-panel";
import { useAuth } from "@/components/auth/auth-context";
import { useAuthCaptchaToken } from "@/lib/auth/captcha-store";
import { authApi } from "@/lib/auth/api";
import type { AuthResponseBody } from "@/lib/auth/types";

interface RequestErrors {
  email?: string;
  captchaToken?: string;
}

interface ResetErrors {
  code?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface ApiErrorShape {
  status?: number;
  message?: string;
  body?: {
    error?: string;
    code?: string;
    details?: unknown;
  };
}

function validateRequest(values: { email: string; captchaToken: string }): RequestErrors {
  const errors: RequestErrors = {};

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.captchaToken.trim()) {
    errors.captchaToken = "Complete the captcha before continuing.";
  }

  return errors;
}

function validateReset(values: {
  code: string;
  newPassword: string;
  confirmPassword: string;
}): ResetErrors {
  const errors: ResetErrors = {};

  if (!/^\d{6}$/.test(values.code.trim())) {
    errors.code = "Enter the 6-digit reset code from your email.";
  }

  if (!values.newPassword) {
    errors.newPassword = "New password is required.";
  } else if (values.newPassword.length < 8) {
    errors.newPassword = "Password must be at least 8 characters.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Please confirm your new password.";
  } else if (values.newPassword !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

function getRequestFailureResult(error: unknown): {
  generalError: string | null;
  fieldErrors?: Partial<RequestErrors>;
} {
  const apiError = error as ApiErrorShape | undefined;
  const status = apiError?.status;
  const code = apiError?.body?.code;
  const message = apiError?.body?.error ?? apiError?.message;

  if (status === 400) {
    switch (code) {
      case "CAPTCHA_REQUIRED":
      case "CAPTCHA_MISSING":
        return {
          generalError: "Please complete the security check before requesting a reset code.",
          fieldErrors: {
            captchaToken: "Complete the verification to continue.",
          },
        };
      case "CAPTCHA_INVALID":
      case "CAPTCHA_EXPIRED":
      case "TURNSTILE_VALIDATION_FAILED":
        return {
          generalError: "The security check expired or failed. Please try again.",
          fieldErrors: {
            captchaToken: "Please complete the verification again.",
          },
        };
      default:
        return {
          generalError: message || "We couldn't start password reset right now.",
        };
    }
  }

  if (status !== undefined && status >= 500) {
    return {
      generalError: "Something went wrong on our side. Please try again in a moment.",
    };
  }

  return {
    generalError: "We couldn't start password reset. Check your connection and try again.",
  };
}

function getResetFailureResult(error: unknown): {
  generalError: string | null;
  fieldErrors?: Partial<ResetErrors>;
} {
  const apiError = error as ApiErrorShape | undefined;
  const status = apiError?.status;
  const message = apiError?.body?.error ?? apiError?.message;
  const details = apiError?.body?.details as { retryAfterSeconds?: number } | undefined;

  if (status === 400) {
    return {
      generalError: null,
      fieldErrors: {
        code: message || "Reset code is invalid or has expired.",
      },
    };
  }

  if (status === 409) {
    return {
      generalError: message || "This account is not eligible for password reset.",
    };
  }

  if (status === 429) {
    const retryAfterSeconds = details?.retryAfterSeconds;
    return {
      generalError: retryAfterSeconds
        ? `A reset code was sent recently. Try again in ${retryAfterSeconds} seconds.`
        : message || "A reset code was sent recently. Please wait before retrying.",
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      generalError: "Something went wrong on our side. Please try again in a moment.",
    };
  }

  return {
    generalError: "We couldn't reset your password right now. Check your connection and try again.",
  };
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const { status, setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestErrors, setRequestErrors] = useState<RequestErrors>({});
  const [resetErrors, setResetErrors] = useState<ResetErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [resentMessage, setResentMessage] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [requestComplete, setRequestComplete] = useState(false);
  const [captchaToken, setCaptchaToken, clearCaptchaToken] = useAuthCaptchaToken();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [router, status]);

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateRequest({ email, captchaToken });
    setRequestErrors(nextErrors);
    setGeneralError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setRequestPending(true);

    try {
      await authApi.forgotPassword({
        email: email.trim().toLowerCase(),
        captchaToken,
      });

      setRequestComplete(true);
      setGeneralError(null);
      clearCaptchaToken();
    } catch (error) {
      const failure = getRequestFailureResult(error);
      setGeneralError(failure.generalError);
      setRequestErrors((current) => ({
        ...current,
        ...(failure.fieldErrors ?? {}),
      }));
      clearCaptchaToken();
    } finally {
      setRequestPending(false);
    }
  }

  async function handleResetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateReset({ code, newPassword, confirmPassword });
    setResetErrors(nextErrors);
    setGeneralError(null);
    setResentMessage(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setResetPending(true);

    try {
      const session: AuthResponseBody = await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });

      setSession(session);
      router.replace("/");
    } catch (error) {
      const failure = getResetFailureResult(error);
      setGeneralError(failure.generalError);
      setResetErrors((current) => ({
        ...current,
        ...(failure.fieldErrors ?? {}),
      }));
    } finally {
      setResetPending(false);
    }
  }

  async function handleResend() {
    setGeneralError(null);
    setResetErrors({});
    setResentMessage(null);
    setResending(true);

    try {
      await authApi.resendForgotPassword({
        email: email.trim().toLowerCase(),
      });

      setResentMessage(`If ${email.trim().toLowerCase()} is eligible, a new reset code is on the way.`);
    } catch (error) {
      const failure = getResetFailureResult(error);
      setGeneralError(failure.generalError);
    } finally {
      setResending(false);
    }
  }

  const emailHasValue = useMemo(() => email.trim().length > 0, [email]);
  const newPasswordHasValue = useMemo(() => newPassword.length > 0, [newPassword]);
  const confirmPasswordHasValue = useMemo(() => confirmPassword.length > 0, [confirmPassword]);

  if (status === "loading") {
    return (
      <div className="rounded-full border border-white/70 bg-white/90 px-5 py-3 text-sm font-medium text-slate-600 shadow-lg backdrop-blur">
        Preparing your workspace...
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  if (!requestComplete) {
    return (
      <form className="space-y-5" onSubmit={handleRequestSubmit}>
        {generalError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {generalError}
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`h-14 w-full rounded-2xl border bg-white/90 px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 ${
              requestErrors.email
                ? "border-rose-300 ring-4 ring-rose-100"
                : emailHasValue
                  ? "border-indigo-300 ring-4 ring-indigo-50"
                  : "border-slate-200 hover:border-indigo-200"
            }`}
          />
          {requestErrors.email ? (
            <p className="text-sm text-rose-700">{requestErrors.email}</p>
          ) : (
            <p className="text-sm text-slate-500">
              We will email a reset code if this account can use local password sign-in.
            </p>
          )}
        </div>

        <AuthCaptchaPanel
          token={captchaToken}
          error={requestErrors.captchaToken}
          onChange={setCaptchaToken}
          onReset={clearCaptchaToken}
        />

        <button
          type="submit"
          disabled={requestPending}
          className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)] transition hover:scale-[0.995] hover:shadow-[0_20px_44px_rgba(99,102,241,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {requestPending ? "Sending code..." : "Send reset code"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 px-5 py-4 text-emerald-900">
        <p className="text-sm font-semibold">Check your inbox</p>
        <p className="mt-2 text-sm leading-6">
          If {email.trim().toLowerCase()} is eligible for local password reset, we sent a 6-digit code.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleResetSubmit}>
        {generalError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {generalError}
          </div>
        ) : null}

        {resentMessage ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {resentMessage}
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-medium text-slate-700">
            Reset code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`h-14 w-full rounded-2xl border bg-white/90 px-4 text-center text-[22px] tracking-[0.35em] text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 ${
              resetErrors.code
                ? "border-rose-300 ring-4 ring-rose-100"
                : code.length > 0
                  ? "border-indigo-300 ring-4 ring-indigo-50"
                  : "border-slate-200 hover:border-indigo-200"
            }`}
          />
          {resetErrors.code ? <p className="text-sm text-rose-700">{resetErrors.code}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={`h-14 w-full rounded-2xl border bg-white/90 px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 ${
              resetErrors.newPassword
                ? "border-rose-300 ring-4 ring-rose-100"
                : newPasswordHasValue
                  ? "border-sky-300 ring-4 ring-sky-50"
                  : "border-slate-200 hover:border-sky-200"
            }`}
          />
          {resetErrors.newPassword ? (
            <p className="text-sm text-rose-700">{resetErrors.newPassword}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={`h-14 w-full rounded-2xl border bg-white/90 px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 ${
              resetErrors.confirmPassword
                ? "border-rose-300 ring-4 ring-rose-100"
                : confirmPasswordHasValue
                  ? "border-indigo-300 ring-4 ring-indigo-50"
                  : "border-slate-200 hover:border-indigo-200"
            }`}
          />
          {resetErrors.confirmPassword ? (
            <p className="text-sm text-rose-700">{resetErrors.confirmPassword}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={resetPending}
          className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)] transition hover:scale-[0.995] hover:shadow-[0_20px_44px_rgba(99,102,241,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetPending ? "Resetting password..." : "Reset password"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resending ? "Sending new code..." : "Resend reset code"}
      </button>
    </div>
  );
}
