"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { authApi } from "@/lib/auth/api";
import type { SignupVerificationPendingResult } from "@/lib/auth/types";

interface ApiErrorShape {
  status?: number;
  message?: string;
  body?: {
    error?: string;
    code?: string;
    details?: unknown;
  };
}

type VerificationFailureResult = {
  generalError: string | null;
  fieldError?: string;
};

function getVerificationFailureResult(error: unknown): VerificationFailureResult {
  const apiError = error as ApiErrorShape | undefined;
  const status = apiError?.status;
  const message = apiError?.body?.error ?? apiError?.message;
  const details = apiError?.body?.details as { retryAfterSeconds?: number } | undefined;

  if (status === 400) {
    return {
      generalError: null,
      fieldError: message || "Enter the 6-digit verification code from your email.",
    };
  }

  if (status === 409) {
    return {
      generalError: message || "This email has already been verified. Try signing in instead.",
      fieldError: undefined,
    };
  }

  if (status === 429) {
    const retryAfterSeconds = details?.retryAfterSeconds;

    return {
      generalError: retryAfterSeconds
        ? `A verification code was sent recently. Try again in ${retryAfterSeconds} seconds.`
        : message || "A verification code was sent recently. Please wait before retrying.",
      fieldError: undefined,
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      generalError: "Something went wrong on our side. Please try again in a moment.",
      fieldError: undefined,
    };
  }

  return {
    generalError: "We couldn't verify your email right now. Check your connection and try again.",
    fieldError: undefined,
  };
}

interface SignupVerificationPanelProps {
  result: SignupVerificationPendingResult;
}

export function SignupVerificationPanel({ result }: SignupVerificationPanelProps) {
  const router = useRouter();
  const { setSession } = useAuth();

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resentMessage, setResentMessage] = useState<string | null>(null);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = code.trim();
    setGeneralError(null);
    setResentMessage(null);

    if (!/^\d{6}$/.test(normalizedCode)) {
      setCodeError("Enter the 6-digit verification code from your email.");
      return;
    }

    setCodeError(null);
    setPending(true);

    try {
      const session = await authApi.verifyEmail({
        email: result.email,
        code: normalizedCode,
      });

      setSession(session);
      router.replace("/");
    } catch (error) {
      const failure = getVerificationFailureResult(error);
      setGeneralError(failure.generalError);
      setCodeError(failure.fieldError ?? null);
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    setGeneralError(null);
    setCodeError(null);
    setResentMessage(null);
    setResending(true);

    try {
      await authApi.resendVerificationEmail({
        email: result.email,
      });

      setResentMessage("If this email needs verification, a new code is on the way.");
    } catch (error) {
      const failure = getVerificationFailureResult(error);
      setGeneralError(failure.generalError);
      setCodeError(failure.fieldError ?? null);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 px-5 py-4 text-emerald-900">
        <p className="text-sm font-semibold">Check your inbox</p>
        <p className="mt-2 text-sm leading-6">
          If {result.email} needs verification, we sent a 6-digit code.
        </p>
        <p className="mt-2 text-sm leading-6">
          Verify your email before signing in to your Rentify workspace.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleVerify}>
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
          <label htmlFor="verificationCode" className="text-sm font-medium text-slate-700">
            Verification code
          </label>

          <input
            id="verificationCode"
            name="verificationCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className={`h-14 w-full rounded-2xl border bg-white/90 px-4 text-center text-[22px] tracking-[0.35em] text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 ${
              codeError
                ? "border-rose-300 ring-4 ring-rose-100"
                : code.length > 0
                  ? "border-indigo-300 ring-4 ring-indigo-50"
                  : "border-slate-200 hover:border-indigo-200"
            }`}
          />

          {codeError ? <p className="text-sm text-rose-700">{codeError}</p> : null}
          {!codeError ? (
            <p className="text-sm text-slate-500">
              Enter the 6-digit code from your email to finish creating your account.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)] transition hover:scale-[0.995] hover:shadow-[0_20px_44px_rgba(99,102,241,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Verifying..." : "Verify email"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resending ? "Sending new code..." : "Resend code"}
      </button>

      <Link
        href="/login"
        className="inline-flex h-12 w-full items-center justify-center text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
      >
        Back to sign in
      </Link>
    </div>
  );
}
