"use client";

import { useState } from "react";
import { authApi } from "@/lib/auth/api";

interface ApiErrorShape {
  status?: number;
  message?: string;
  body?: {
    error?: string;
    code?: string;
    details?: unknown;
  };
}

interface LoginUnlockPanelProps {
  email: string;
  onUnlocked: (message: string) => void;
  onCancel: () => void;
}

function getUnlockFailureResult(error: unknown): {
  generalError: string | null;
  fieldError?: string;
} {
  const apiError = error as ApiErrorShape | undefined;
  const status = apiError?.status;
  const message = apiError?.body?.error ?? apiError?.message;
  const details = apiError?.body?.details as { retryAfterSeconds?: number } | undefined;

  if (status === 400) {
    return {
      generalError: null,
      fieldError: message || "Enter the 6-digit unlock code from your email.",
    };
  }

  if (status === 429) {
    const retryAfterSeconds = details?.retryAfterSeconds;

    return {
      generalError: retryAfterSeconds
        ? `A new unlock code was sent recently. Try again in ${retryAfterSeconds} seconds.`
        : message || "A new unlock code was sent recently. Please wait before retrying.",
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
    generalError: "We couldn't unlock sign-in right now. Check your connection and try again.",
    fieldError: undefined,
  };
}

export function LoginUnlockPanel({ email, onUnlocked, onCancel }: LoginUnlockPanelProps) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resentMessage, setResentMessage] = useState<string | null>(null);

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = code.trim();
    setGeneralError(null);
    setResentMessage(null);

    if (!/^\d{6}$/.test(normalizedCode)) {
      setCodeError("Enter the 6-digit unlock code from your email.");
      return;
    }

    setCodeError(null);
    setPending(true);

    try {
      await authApi.unlockLocalLogin({
        email,
        code: normalizedCode,
      });

      onUnlocked("Sign-in unlocked. Try your password again.");
    } catch (error) {
      const failure = getUnlockFailureResult(error);
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
      await authApi.resendUnlockLocalLogin({ email });
      setResentMessage("If sign-in is locked for this email, a new unlock code is on the way.");
    } catch (error) {
      const failure = getUnlockFailureResult(error);
      setGeneralError(failure.generalError);
      setCodeError(failure.fieldError ?? null);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-amber-200 bg-amber-50/90 px-5 py-4 text-amber-950">
        <p className="text-sm font-semibold">Sign-in temporarily locked</p>
        <p className="mt-2 text-sm leading-6">
          We sent an unlock code to {email}. Enter it below to restore local sign-in.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleUnlock}>
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
          <label htmlFor="unlockCode" className="text-sm font-medium text-slate-700">
            Unlock code
          </label>

          <input
            id="unlockCode"
            name="unlockCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
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
              Enter the 6-digit code from your email to unlock local sign-in.
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)] transition hover:scale-[0.995] hover:shadow-[0_20px_44px_rgba(99,102,241,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Unlocking..." : "Unlock sign-in"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resending ? "Sending new code..." : "Resend unlock code"}
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-12 w-full items-center justify-center text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
      >
        Back to sign in
      </button>
    </div>
  );
}
