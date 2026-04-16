"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/components/auth/auth-context";

export function AuthenticatedHome() {
  const { session, clearSession } = useAuth();

  return (
    <AuthGuard mode="authenticated-only">
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(243,190,116,0.22),_transparent_22%),linear-gradient(180deg,_#f7f1e6_0%,_#f2ede4_55%,_#ebe3d8_100%)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="rounded-[2rem] border border-white/80 bg-white/75 p-8 shadow-[0_30px_110px_-45px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-800">
                  Signed in
                </p>
                <h1 className="font-serif-display text-5xl leading-none tracking-tight text-slate-950">
                  Welcome back, {session?.user.username}.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600">
                  Your account session is now wired into the web client. This is a strong base for
                  listings, messaging, booking requests, and the rest of the authenticated product.
                </p>
              </div>
              <button
                type="button"
                onClick={clearSession}
                className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Clear local session
              </button>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-3">
            <article className="rounded-[1.75rem] border border-white/75 bg-white/70 p-6">
              <p className="text-sm font-semibold text-slate-900">User email</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{session?.user.email}</p>
            </article>
            <article className="rounded-[1.75rem] border border-white/75 bg-white/70 p-6">
              <p className="text-sm font-semibold text-slate-900">Access token</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Stored in the frontend session layer for future authenticated API calls.
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-white/75 bg-white/70 p-6">
              <p className="text-sm font-semibold text-slate-900">Next step</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Extend this shell into the real dashboard routes as the marketplace grows.
              </p>
            </article>
          </section>

          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/login" className="rounded-full border border-slate-300 px-4 py-2 text-slate-700">
              Login page
            </Link>
            <Link href="/signup" className="rounded-full border border-slate-300 px-4 py-2 text-slate-700">
              Signup page
            </Link>
            <Link
              href="/verify-email"
              className="rounded-full border border-slate-300 px-4 py-2 text-slate-700"
            >
              Verify email page
            </Link>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
