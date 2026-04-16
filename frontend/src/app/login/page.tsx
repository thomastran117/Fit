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

function MailIcon() {
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
        d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m5 7 7 5 7-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
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
        d="M7 10V8a5 5 0 0 1 10 0v2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)]" />
        <div className="relative rounded-full border border-white/70 bg-white/90 px-5 py-3 text-sm font-medium text-slate-600 shadow-lg backdrop-blur">
          Preparing your workspace...
        </div>
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(99,102,241,0.14),_transparent_22%),radial-gradient(circle_at_85%_18%,_rgba(56,189,248,0.16),_transparent_20%),radial-gradient(circle_at_50%_100%,_rgba(244,114,182,0.12),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f6f8ff_35%,#eef6ff_100%)]" />
      <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-pink-200/20 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:flex lg:items-center lg:px-14 xl:px-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center rounded-full border border-indigo-200/60 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 shadow-sm backdrop-blur">
              Welcome back
            </div>

            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 xl:text-6xl">
              Sign in to a brighter, cleaner rental workspace.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 xl:text-lg">
              Manage listings, bookings, and conversations from a calm interface
              with soft color, better focus, and less clutter.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-[0_12px_40px_rgba(99,102,241,0.08)] backdrop-blur">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <MailIcon />
                </div>
                <p className="text-sm font-semibold text-slate-900">Fast access</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Quickly reach your booking dashboard.
                </p>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-[0_12px_40px_rgba(56,189,248,0.08)] backdrop-blur">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <LockIcon />
                </div>
                <p className="text-sm font-semibold text-slate-900">Secure flow</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Protected access with verification built in.
                </p>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-[0_12px_40px_rgba(244,114,182,0.08)] backdrop-blur">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12h14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 5v14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-900">Less clutter</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  A softer layout that keeps attention on the essentials.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[540px]">
            <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_30px_80px_rgba(79,70,229,0.10)] backdrop-blur-xl sm:p-8">
              <div className="mb-8">
                <p className="text-sm font-medium text-indigo-600">Account access</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.15rem]">
                  Sign in
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Access your bookings, listings, and messages from one polished
                  workspace.
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
                    className={`relative rounded-2xl border bg-white/90 transition ${
                      errors.email
                        ? "border-rose-300 ring-4 ring-rose-100"
                        : emailHasValue
                          ? "border-indigo-300 ring-4 ring-indigo-50"
                          : "border-slate-200 hover:border-indigo-200"
                    }`}
                  >
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">
                      <MailIcon />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-14 w-full rounded-2xl bg-transparent pl-12 pr-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
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
                      className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div
                    className={`relative rounded-2xl border bg-white/90 transition ${
                      errors.password
                        ? "border-rose-300 ring-4 ring-rose-100"
                        : passwordHasValue
                          ? "border-sky-300 ring-4 ring-sky-50"
                          : "border-slate-200 hover:border-sky-200"
                    }`}
                  >
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sky-500">
                      <LockIcon />
                    </div>

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-14 w-full rounded-2xl bg-transparent pl-12 pr-14 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
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

                <div className="rounded-[1.5rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4">
                  
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
                  className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)] transition hover:scale-[0.995] hover:shadow-[0_20px_44px_rgba(99,102,241,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
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
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40"
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