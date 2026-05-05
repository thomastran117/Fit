"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { authApi } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";

const navigationLinks = [
  { href: "/", label: "Home" },
  { href: "/postings", label: "Browse" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

const accountLinks = [
  { href: "/account", label: "Manage account", description: "Email, security, and login methods" },
  { href: "/profile", label: "Profile", description: "Personal details and public-facing info" },
  { href: "/settings", label: "Settings", description: "Preferences and application settings" },
];

function getInitials(value: string): string {
  return (
    value
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "R"
  );
}

function getDisplayLabel(email: string, username: string): string {
  return username.trim() || email.split("@")[0] || "Account";
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function HeaderLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
        R
      </div>

      <div className="min-w-0">
        <p className="text-xl font-semibold tracking-[-0.04em] text-slate-950">
          Rentify
        </p>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          Modern rentals
        </p>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type AvatarProps = {
  name: string;
  imageUrl?: string | null;
};

function UserAvatar({ name, imageUrl }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${name} avatar`}
        className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white ring-1 ring-black/5">
      {getInitials(name)}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, session, clearSession } = useAuth();

  const [logoutPending, setLogoutPending] = useState(false);

  const displayName = useMemo(() => {
    if (!session) return "Account";
    return getDisplayLabel(session.user.email, session.user.username);
  }, [session]);

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
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[1.9rem] border border-white/70 bg-white/78 px-4 py-3 shadow-[0_22px_55px_rgba(79,70,229,0.08)] backdrop-blur-xl sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="shrink-0">
              <HeaderLogo />
            </Link>

            <nav className="hidden items-center gap-1 rounded-full border border-slate-200/70 bg-white/90 p-1 lg:flex">
              {navigationLinks.map((link) => {
                const active = isRouteActive(pathname, link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-3">
              <details className="group relative lg:hidden">
                <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition hover:bg-slate-50">
                  <MenuIcon />
                </summary>

                <div className="absolute right-0 top-[calc(100%+0.75rem)] w-80 rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
                  <div className="grid gap-2">
                    {navigationLinks.map((link) => {
                      const active = isRouteActive(pathname, link.href);

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                            active
                              ? "bg-slate-950 text-white"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                          }`}
                        >
                          {link.label}
                        </Link>
                      );
                    })}

                    <div className="my-1 h-px bg-slate-200" />

                    {status === "authenticated" && session ? (
                      <>
                        {accountLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="rounded-2xl px-4 py-3 transition hover:bg-slate-100"
                          >
                            <p className="text-sm font-medium text-slate-950">
                              {link.label}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {link.description}
                            </p>
                          </Link>
                        ))}

                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          disabled={logoutPending}
                          className="cursor-pointer rounded-2xl px-4 py-3 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {logoutPending ? "Logging out..." : "Log out"}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                        >
                          Log in
                        </Link>
                        <Link
                          href="/signup"
                          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Sign up
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </details>

              {status === "loading" ? (
                <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 sm:block">
                  Loading...
                </div>
              ) : status === "authenticated" && session ? (
                <details className="group relative">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-slate-200 bg-white px-2.5 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition hover:bg-slate-50">
                    <UserAvatar
                      name={session.user.username || session.user.email}
                      imageUrl={session.user.avatarUrl ?? null}
                    />

                    <div className="hidden min-w-0 text-left sm:block">
                      <p className="max-w-40 truncate text-sm font-semibold text-slate-950">
                        {displayName}
                      </p>
                      <p className="max-w-48 truncate text-xs text-slate-500">
                        {session.user.email}
                      </p>
                    </div>

                    <div className="hidden text-slate-500 sm:block transition group-open:rotate-180">
                      <ChevronDownIcon />
                    </div>
                  </summary>

                  <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[22rem] rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={session.user.username || session.user.email}
                          imageUrl={session.user.avatarUrl ?? null}
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {displayName}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {accountLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="rounded-2xl px-4 py-3 transition hover:bg-slate-100"
                        >
                          <p className="text-sm font-medium text-slate-950">
                            {link.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {link.description}
                          </p>
                        </Link>
                      ))}

                      <div className="my-1 h-px bg-slate-200" />

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
                <div className="hidden items-center gap-2 sm:flex">
                  <Link
                    href="/login"
                    className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      pathname === "/login"
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    Log in
                  </Link>

                  <Link
                    href="/signup"
                    className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.14)] transition hover:bg-slate-800"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
