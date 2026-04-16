"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  Banner,
  Field,
  SubmitButton,
} from "@/components/auth/auth-form-primitives";
import { useAuth } from "@/components/auth/auth-context";
import { authApi } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";

interface VerifyErrors {
  email?: string;
  code?: string;
}

function validateEmail(value: string): string | undefined {
  if (!value.trim()) {
    return "Email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Enter a valid email address.";
  }

  return undefined;
}

function validateVerify(values: { email: string; code: string }): VerifyErrors {
  const errors: VerifyErrors = {};
  const emailError = validateEmail(values.email);

  if (emailError) {
    errors.email = emailError;
  }

  if (!/^\d{6}$/.test(values.code.trim())) {
    errors.code = "Verification code must be 6 digits.";
  }

  return errors;
}

interface VerifyEmailFormProps {
  initialEmail?: string;
}

export function VerifyEmailForm({ initialEmail = "" }: VerifyEmailFormProps) {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<VerifyErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateVerify({ email, code });
    setErrors(nextErrors);
    setGeneralError(null);
    setSuccessMessage(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPending(true);

    try {
      const session = await authApi.verifyEmail({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });

      setSession(session);
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError("Unable to verify this email right now.");
      }
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    const emailError = validateEmail(email);

    setErrors((current) => ({
      ...current,
      email: emailError,
    }));
    setGeneralError(null);
    setSuccessMessage(null);

    if (emailError) {
      return;
    }

    setResendPending(true);

    try {
      const result = await authApi.resendVerificationEmail({
        email: email.trim().toLowerCase(),
      });

      setSuccessMessage(`A fresh verification code was sent to ${result.email}.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError("Unable to resend the verification email right now.");
      }
    } finally {
      setResendPending(false);
    }
  }

  return (
    <AuthGuard mode="anonymous-only">
      <AuthShell
        eyebrow="Verify email"
        title="Confirm your inbox, then step straight into Rentify."
        description="Local sign-in is available once your email has been verified with the 6-digit code we sent."
        footer={
          <p>
            Already verified?{" "}
            <Link
              href="/login"
              className="font-semibold text-slate-950 underline decoration-emerald-500/60 underline-offset-4"
            >
              Return to sign in
            </Link>
          </p>
        }
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Verify your email</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter the 6-digit code from your inbox. If it expired, request a new one.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleVerify}>
            {generalError ? <Banner tone="error">{generalError}</Banner> : null}
            {successMessage ? <Banner tone="success">{successMessage}</Banner> : null}

            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
            />

            <Field
              label="Verification code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              error={errors.code}
            />

            <SubmitButton pending={pending}>Verify and continue</SubmitButton>
          </form>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendPending}
            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendPending ? "Sending..." : "Resend verification email"}
          </button>
        </div>
      </AuthShell>
    </AuthGuard>
  );
}
