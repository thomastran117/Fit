"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { authApi } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";

function getInitials(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "R";
}

function getDisplayLabel(email: string, username: string): string {
  return username.trim() || email.split("@")[0] || "Account";
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, session, clearSession } = useAuth();
  const [logoutPending, setLogoutPending] = useState(false);

  const navigationLinks = [
    { href: "/", label: "Home" },
    { href: "/login", label: "Sign in" },
    { href: "/forgot-password", label: "Reset password" },
  ];

  async function handleLogout() {
    setLogoutPending(true);

    try {
      await authApi.logout();
      clearSession();
      router.push("/login");
    } catch (error) {
      clearSession();

      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        return;
      }

      router.push("/login");
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/50 bg-[rgba(247,241,231,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-ink text-sm font-semibold tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(23,32,51,0.18)]">
                R
              </div>
              <div className="min-w-0">
                <p className="font-serif-display text-xl font-semibold tracking-[-0.04em] text-brand-ink">
                  Rentify
                </p>
                <p className="text-xs uppercase tracking-[0.18em] text-brand-muted">
                  Rental workspace
                </p>
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navigationLinks.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white text-brand-ink shadow-[0_10px_24px_rgba(23,32,51,0.08)]"
                      : "text-brand-muted hover:bg-white/70 hover:text-brand-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {status === "loading" ? (
            <div className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm text-brand-muted">
              Loading...
            </div>
          ) : status === "authenticated" && session ? (
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-white/60 bg-white/85 px-3 py-2 shadow-[0_12px_28px_rgba(23,32,51,0.08)] transition hover:border-brand-gold/40 hover:bg-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-ink text-sm font-semibold text-white">
                  {getInitials(session.user.username || session.user.email)}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="max-w-40 truncate text-sm font-semibold text-brand-ink">
                    {getDisplayLabel(session.user.email, session.user.username)}
                  </p>
                  <p className="max-w-48 truncate text-xs text-brand-muted">
                    {session.user.email}
                  </p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4 text-brand-muted transition group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>

              <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-3xl border border-white/70 bg-white/95 p-3 shadow-[0_28px_80px_rgba(23,32,51,0.16)] backdrop-blur-xl">
                <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(212,168,95,0.18),rgba(37,99,235,0.12))] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-brand-muted">
                    Signed in
                  </p>
                  <p className="mt-1 text-sm font-semibold text-brand-ink">
                    {getDisplayLabel(session.user.email, session.user.username)}
                  </p>
                  <p className="mt-1 truncate text-sm text-brand-muted">{session.user.email}</p>
                </div>

                <div className="mt-3 grid gap-2">
                  <Link
                    href="/"
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-brand-ink transition hover:bg-brand-accent-soft/70"
                  >
                    Profile and account
                  </Link>
                  <Link
                    href="/forgot-password"
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-brand-ink transition hover:bg-brand-accent-soft/70"
                  >
                    Forgot password flow
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={logoutPending}
                    className="cursor-pointer rounded-2xl px-4 py-3 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {logoutPending ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </div>
            </details>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  pathname === "/login"
                    ? "bg-white text-brand-ink shadow-[0_10px_24px_rgba(23,32,51,0.08)]"
                    : "text-brand-muted hover:bg-white/70 hover:text-brand-ink"
                }`}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(23,32,51,0.18)] transition hover:bg-slate-800"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
