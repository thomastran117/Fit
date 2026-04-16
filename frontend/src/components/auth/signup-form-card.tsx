import Link from "next/link";
import type { ReactNode } from "react";

interface SignupFormCardProps {
  children: ReactNode;
}

export function SignupFormCard({ children }: SignupFormCardProps) {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(79,70,229,0.10)] backdrop-blur-xl sm:p-8">
      <div className="mb-8 space-y-5">
        <div className="inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Start in minutes
        </div>

        <div>
          <p className="text-sm font-medium text-indigo-600">Create your account</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.15rem]">
            Sign up
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            Create your Rentify account to manage listings, bookings, and guest
            conversations from one polished workspace.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
              Secure
            </p>
            <p className="mt-1 text-sm text-slate-700">Protected with email verification.</p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              Organized
            </p>
            <p className="mt-1 text-sm text-slate-700">Keep bookings, listings, and messages together.</p>
          </div>

          <div className="rounded-2xl border border-pink-100 bg-pink-50/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-700">
              Fast setup
            </p>
            <p className="mt-1 text-sm text-slate-700">Get into your workspace with a quick onboarding flow.</p>
          </div>
        </div>
      </div>

      {children}

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          Already registered?
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Link
        href="/login"
        className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40"
      >
        Back to sign in
      </Link>

      <p className="mt-6 text-center text-xs leading-6 text-slate-500">
        Secure account creation for your rental workspace and booking management.
      </p>
    </div>
  );
}
