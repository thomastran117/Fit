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
import { authApi } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";

interface SignupErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  captchaToken?: string;
}

function validateSignup(values: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  captchaToken: string;
}): SignupErrors {
  const errors: SignupErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  }

  if (!values.captchaToken.trim()) {
    errors.captchaToken = "Complete the captcha before creating an account.";
  }

  return errors;
}

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [pending, setPending] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateSignup({
      firstName,
      lastName,
      email,
      password,
      captchaToken,
    });

    setErrors(nextErrors);
    setGeneralError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPending(true);

    try {
      const result = await authApi.signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        captchaToken,
      });

      router.replace(`/verify-email?email=${encodeURIComponent(result.email)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError("Unable to create your account right now.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthGuard mode="anonymous-only">
      <AuthShell
        eyebrow="Create account"
        title="Join Rentify and get your first trusted rental flow moving."
        description="Create an account to list spaces, rent equipment, and keep every booking conversation organized."
        footer={
          <p>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-slate-950 underline decoration-emerald-500/60 underline-offset-4"
            >
              Sign in instead
            </Link>
          </p>
        }
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Create your account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              We will send a verification code before you can sign in for the first time.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {generalError ? <Banner tone="error">{generalError}</Banner> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                name="firstName"
                autoComplete="given-name"
                placeholder="Taylor"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                error={errors.firstName}
              />
              <Field
                label="Last name"
                name="lastName"
                autoComplete="family-name"
                placeholder="Morgan"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                error={errors.lastName}
              />
            </div>

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
              autoComplete="new-password"
              placeholder="At least 8 characters"
              hint="Use at least 8 characters to match the current backend policy."
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

            <SubmitButton pending={pending}>Create account</SubmitButton>
          </form>
        </div>
      </AuthShell>
    </AuthGuard>
  );
}
