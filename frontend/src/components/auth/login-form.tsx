"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCaptchaPanel } from "@/components/auth/auth-captcha-panel";
import { LoginUnlockPanel } from "@/components/auth/login-unlock-panel";
import { AuthOAuthButtons } from "@/components/auth/oauth-buttons";
import { useAuth } from "@/components/auth/auth-context";
import { useAuthCaptchaToken } from "@/lib/auth/captcha-store";
import { authApi } from "@/lib/auth/api";
import type { AuthResponseBody } from "@/lib/auth/types";

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

interface ApiErrorShape {
  status?: number;
  message?: string;
  body?: {
    error?: string;
    code?: string;
    details?: unknown;
  };
}

type LoginFailureResult = {
  generalError: string | null;
  fieldErrors?: Partial<LoginErrors>;
  unlockRequired?: boolean;
};

function getLoginFailureResult(error: unknown): LoginFailureResult {
  const apiError = error as ApiErrorShape | undefined;
  const status = apiError?.status;
  const code = apiError?.body?.code;
  const message = apiError?.body?.error ?? apiError?.message;

  if (status === 400) {
    switch (code) {
      case "CAPTCHA_REQUIRED":
      case "CAPTCHA_MISSING":
        return {
          generalError: "Please complete the security check before signing in.",
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

      case "VALIDATION_ERROR":
      case "INVALID_REQUEST":
        return {
          generalError: message || "Please review the form and try again.",
        };

      default:
        return {
          generalError: message || "Your sign-in request was invalid. Please try again.",
        };
    }
  }

  if (status === 401) {
    switch (code) {
      case "INVALID_CREDENTIALS":
      case "INVALID_EMAIL_OR_PASSWORD":
      case "AUTHENTICATION_FAILED":
      default:
        return {
          generalError: "The email or password you entered is incorrect.",
        };
    }
  }

  if (status === 409) {
    switch (code) {
      case "EMAIL_NOT_VERIFIED":
      case "ACCOUNT_NOT_VERIFIED":
        return {
          generalError:
            "Your account has not been verified yet. Please verify your email before signing in.",
        };

      case "AUTH_PROVIDER_MISMATCH":
        return {
          generalError:
            "This account uses a different sign-in method. Use the original provider you signed up with.",
        };

      case "ACCOUNT_DISABLED":
      case "ACCOUNT_LOCKED":
      case "ACCOUNT_SUSPENDED":
        return {
          generalError:
            "This account is currently unavailable. Please contact support if you believe this is a mistake.",
        };

      default:
        return {
          generalError: message || "There is a problem with this account.",
        };
    }
  }

  if (status === 423) {
    return {
      generalError:
        message || "This sign-in is locked. Use the code from your email to unlock it.",
      unlockRequired: true,
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      generalError: "Something went wrong on our side. Please try again in a moment.",
    };
  }

  return {
    generalError: "We couldn't complete sign in. Check your connection and try again.",
  };
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
      <path d="m5 7 7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
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
      <path d="M7 10V8a5 5 0 0 1 10 0v2" strokeLinecap="round" strokeLinejoin="round" />
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

interface LoginFieldProps {
  id: string;
  label: string;
  error?: string;
  hasValue: boolean;
  icon: React.ReactNode;
  iconClassName: string;
  children: React.ReactNode;
}

function LoginField({
  id,
  label,
  error,
  hasValue,
  icon,
  iconClassName,
  children,
}: LoginFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>

      <div
        className={`relative rounded-2xl border bg-white/90 transition ${
          error
            ? "border-rose-300 ring-4 ring-rose-100"
            : hasValue
              ? iconClassName
              : "border-slate-200 hover:border-indigo-200"
        }`}
      >
        {icon}
        {children}
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

interface LoginFormProps {
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const { status, setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken, clearCaptchaToken] = useAuthCaptchaToken();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  function handleOAuthSuccess(session: AuthResponseBody) {
    setGeneralError(null);
    setUnlockEmail(null);
    setSession(session);
    router.replace(nextPath);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateLogin({ email, password, captchaToken });
    setErrors(nextErrors);
    setGeneralError(null);
    setUnlockEmail(null);

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

      clearCaptchaToken();
      setSession(session);
      router.replace(nextPath);
    } catch (error) {
      const failure = getLoginFailureResult(error);

      setGeneralError(failure.generalError);
      setUnlockEmail(failure.unlockRequired ? email.trim().toLowerCase() : null);
      setErrors((current) => ({
        ...current,
        ...(failure.fieldErrors ?? {}),
      }));
      clearCaptchaToken();
    } finally {
      setPending(false);
    }
  }

  const emailHasValue = useMemo(() => email.trim().length > 0, [email]);
  const passwordHasValue = useMemo(() => password.length > 0, [password]);

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

  if (unlockEmail) {
    return (
      <LoginUnlockPanel
        email={unlockEmail}
        onUnlocked={(message) => {
          setUnlockEmail(null);
          setGeneralError(message);
        }}
        onCancel={() => {
          setUnlockEmail(null);
          setGeneralError(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <AuthOAuthButtons onSuccess={handleOAuthSuccess} onError={setGeneralError} />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          Or use email
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {generalError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {generalError}
          </div>
        ) : null}

        <LoginField
          id="email"
          label="Email"
          error={errors.email}
          hasValue={emailHasValue}
          iconClassName="border-indigo-300 ring-4 ring-indigo-50"
          icon={
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">
              <MailIcon />
            </div>
          }
        >
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
        </LoginField>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
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
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
            </button>
          </div>

          {errors.password ? <p className="text-sm text-rose-700">{errors.password}</p> : null}
        </div>

        <AuthCaptchaPanel
          token={captchaToken}
          error={errors.captchaToken}
          onChange={setCaptchaToken}
          onReset={clearCaptchaToken}
        />

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)] transition hover:scale-[0.995] hover:shadow-[0_20px_44px_rgba(99,102,241,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
