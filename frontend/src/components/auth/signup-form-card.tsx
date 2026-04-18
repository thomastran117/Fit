import Link from "next/link";
import type { ReactNode } from "react";

interface SignupFormCardProps {
  children: ReactNode;
}

export function SignupFormCard({ children }: SignupFormCardProps) {
  return (
    <div className="rounded-[2rem] border border-white/80 bg-white/84 p-5 shadow-[0_28px_70px_rgba(79,70,229,0.10)] backdrop-blur-xl sm:p-7">
      <div className="mb-5 space-y-3">
        <div className="inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Start in minutes
        </div>

        <div>
          <p className="text-sm font-medium text-indigo-600">Create your account</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.1rem]">
            Sign up
          </h2>
        </div>
      </div>

      {children}

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          Already registered?
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Link
        href="/login"
        className="mt-5 inline-flex h-[3.25rem] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40"
      >
        Back to sign in
      </Link>

    </div>
  );
}
