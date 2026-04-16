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
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { useAuth } from "@/components/auth/auth-context";
import { authApi } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";

interface LoginErrors {
  email?: string;
  password?: string;
  captchaToken?: string;
}

function validateLogin(values: {
  email: string;
  password: string;
  captchaToken: string;
}): LoginErrors {
  const errors: LoginErrors = {};

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  }

  if (!values.captchaToken.trim()) {
    errors.captchaToken = "Complete the captcha before signing in.";
  }

  return errors;
}

interface LoginFormProps {
  nextPath?: string;
}

export function LoginForm({ nextPath = "/" }: LoginFormProps) {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [pending, setPending] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateLogin({ email, password, captchaToken });
    setErrors(nextErrors);
    setGeneralError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPending(true);

    try {
      const session = await authApi.login({
        email: email.trim().toLowerCase(),
        password,
        captchaToken,
      });

      setSession(session);
      router.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError("Unable to sign in right now.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthGuard mode="anonymous-only">
      <AuthShell
        eyebrow="Welcome back"
        title="Sign in and pick up where the next booking starts."
        description="Access your listings, messages, and pending booking requests in one place."
        footer={
          <p>
            New to Rentify?{" "}
            <Link
              href="/signup"
              className="font-semibold text-slate-950 underline decoration-emerald-500/60 underline-offset-4"
            >
              Create your account
            </Link>
          </p>
        }
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the email you registered with. Verified accounts can sign in immediately.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled
              className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-400"
            >
              Google soon
            </button>
            <button
              type="button"
              disabled
              className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-400"
            >
              Microsoft soon
            </button>
            <button
              type="button"
              disabled
              className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-400"
            >
              Apple soon
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {generalError ? <Banner tone="error">{generalError}</Banner> : null}

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
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
            />

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Captcha</p>
              <TurnstileWidget value={captchaToken} onChange={setCaptchaToken} />
              {errors.captchaToken ? (
                <p className="text-sm text-rose-700">{errors.captchaToken}</p>
              ) : null}
            </div>

            <SubmitButton pending={pending}>Sign in to Rentify</SubmitButton>
          </form>
        </div>
      </AuthShell>
    </AuthGuard>
  );
}
