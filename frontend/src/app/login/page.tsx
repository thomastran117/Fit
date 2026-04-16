"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function readNextPath(): string {
  if (typeof window === "undefined") return "/";
  return new URLSearchParams(window.location.search).get("next") || "/";
}

function EyeOpenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.585 10.587A2 2 0 0 0 12 16a2 2 0 0 0 1.414-.586"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.88 5.09A10.94 10.94 0 0 1 12 5c4.477 0 8.268 2.943 9.542 7a10.96 10.96 0 0 1-4.126 5.169"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.228 6.228A10.958 10.958 0 0 0 2.458 12c1.274 4.057 5.065 7 9.542 7 1.55 0 3.026-.354 4.34-.987"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          d="M7 10.75 12 6l5 4.75V17a1 1 0 0 1-1 1h-2.75v-4.25h-2.5V18H8a1 1 0 0 1-1-1v-6.25Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { status, setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    setNextPath(readNextPath());
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [router, status]);

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

  const emailHasValue = useMemo(() => email.trim().length > 0, [email]);
  const passwordHasValue = useMemo(() => password.length > 0, [password]);

  if (status === "loading") {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8fafc] px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(191,219,254,0.20),_transparent_28%)]" />
        <div className="relative rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Preparing Rentify...
        </div>
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-slate-200/70 lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.45),rgba(255,255,255,0.8)),radial-gradient(circle_at_20%_20%,rgba(125,211,252,0.2),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(196,181,253,0.18),transparent_26%),radial-gradient(circle_at_50%_90%,rgba(226,232,240,0.8),transparent_30%)]" />

          <div className="relative flex w-full flex-col justify-between px-10 py-10 xl:px-14 xl:py-12">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <p className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
                  Rentify
                </p>
                <p className="text-sm text-slate-500">
                  Rental management platform
                </p>
              </div>
            </div>

            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
                Modern rental workspace
              </div>

              <h1 className="max-w-lg text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 xl:text-6xl">
                A calmer, cleaner way to manage bookings.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 xl:text-lg">
                Monitor listings, respond to requests, and stay on top of every
                reservation from one thoughtfully designed dashboard.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                    24/7
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Keep your listings and booking flow active at all times.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                    Fast
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Move from inquiry to confirmation with less friction.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                    Clear
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Focus on what matters with a simplified interface.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500">
              <p>Designed for modern rental operations</p>
              <p>Secure account access</p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),rgba(248,250,252,1)_40%)]" />

          <div className="relative w-full max-w-[520px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark />
              <div>
                <p className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
                  Rentify
                </p>
                <p className="text-sm text-slate-500">
                  Rental management platform
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="mb-8">
                <p className="text-sm font-medium text-slate-500">
                  Welcome back
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.15rem]">
                  Sign in to your account
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Access your bookings, listings, and conversations from one
                  clean workspace.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {generalError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {generalError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <div
                    className={`rounded-2xl border bg-white transition ${
                      errors.email
                        ? "border-rose-300 ring-4 ring-rose-100"
                        : emailHasValue
                          ? "border-slate-300 ring-4 ring-slate-100"
                          : "border-slate-200"
                    }`}
                  >
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-14 w-full rounded-2xl bg-transparent px-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {errors.email ? (
                    <p className="text-sm text-rose-700">{errors.email}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div
                    className={`relative rounded-2xl border bg-white transition ${
                      errors.password
                        ? "border-rose-300 ring-4 ring-rose-100"
                        : passwordHasValue
                          ? "border-slate-300 ring-4 ring-slate-100"
                          : "border-slate-200"
                    }`}
                  >
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-14 w-full rounded-2xl bg-transparent px-4 pr-14 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                    </button>
                  </div>

                  {errors.password ? (
                    <p className="text-sm text-rose-700">{errors.password}</p>
                  ) : null}
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">

                  <TurnstileWidget value={captchaToken} onChange={setCaptchaToken} />

                  {errors.captchaToken ? (
                    <p className="mt-2 text-sm text-rose-700">
                      {errors.captchaToken}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  New here?
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <Link
                href="/signup"
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Create an account
              </Link>

              <p className="mt-6 text-center text-xs leading-6 text-slate-500">
                Secure sign in for your rental workspace and booking management.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}