"use client";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";

interface AuthCaptchaPanelProps {
  token: string;
  error?: string;
  onChange: (token: string) => void;
  onReset: () => void;
  title: string;
  description: string;
}

export function AuthCaptchaPanel({
  token,
  error,
  onChange,
  onReset,
  title,
  description,
}: AuthCaptchaPanelProps) {
  return (
    <div className="rounded-[1.75rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          {title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <TurnstileWidget value={token} onChange={onChange} />

      {token ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <p className="text-sm text-emerald-900">
            Verification is ready and preserved while you move through auth.
          </p>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            Run again
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
