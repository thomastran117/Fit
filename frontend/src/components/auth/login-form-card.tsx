import Link from "next/link";
import type { ReactNode } from "react";

interface LoginFormCardProps {
  children: ReactNode;
}

export function LoginFormCard({ children }: LoginFormCardProps) {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_30px_80px_rgba(79,70,229,0.10)] backdrop-blur-xl sm:p-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-indigo-600">Account access</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.15rem]">
          Sign in
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
          Access your bookings, listings, and messages from one polished workspace.
        </p>
      </div>

      {children}

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
  );
}
