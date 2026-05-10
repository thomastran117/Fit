"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { authApi } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";
import { theme } from "@/styles/theme";

const navigationLinks = [
  { href: "/", label: "Home" },
  { href: "/postings", label: "Browse" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

function getAccountLinks(role?: "user" | "owner" | "admin") {
  return [
    ...(role && role !== "user"
      ? [
          {
            href: "/dashboard",
            label: "Dashboard",
            description: "Manage listings, bookings, and performance",
          },
          {
            href: "/postings/create",
            label: "Create posting",
            description: "List a rental for others to discover",
          },
        ]
      : []),
    {
      href: "/account",
      label: "Manage account",
      description: "Email, security, and login methods",
    },
    {
      href: "/profile",
      label: "Profile",
      description: "Personal details and public-facing info",
    },
    {
      href: "/settings",
      label: "Settings",
      description: "Preferences and application settings",
    },
  ];
}

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
      <div className={theme.header.logoMark}>R</div>

      <div className="min-w-0">
        <p className="text-lg font-semibold tracking-[-0.04em] text-slate-950">
          Rentify
        </p>
        <p className="hidden text-xs font-medium text-slate-500 sm:block">
          Find rentals faster
        </p>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
        className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white ring-1 ring-slate-200">
      {getInitials(name)}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, session, clearSession } = useAuth();

  const accountLinks = useMemo(
    () => getAccountLinks(session?.user.role),
    [session?.user.role],
  );

  const [logoutPending, setLogoutPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const displayName = useMemo(() => {
    if (!session) return "Account";
    return getDisplayLabel(session.user.email, session.user.username);
  }, [session]);

  const userCanCreatePosting =
    session?.user.role === "owner" || session?.user.role === "admin";

  const mobileCtaHref = userCanCreatePosting ? "/postings/create" : "/signup";
  const mobileCtaLabel = userCanCreatePosting ? "Create posting" : "List a rental";

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) {
      router.push("/postings");
      return;
    }

    router.push(`/postings?query=${encodeURIComponent(query)}`);
  }

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
    <header className={theme.header.shell}>
      <div className={theme.header.container}>
        <Link href="/" className="shrink-0">
          <HeaderLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navigationLinks.map((link) => {
            const active = isRouteActive(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? theme.header.navLinkActive : theme.header.navLink}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <form
          onSubmit={handleSearch}
          className="hidden min-w-0 flex-1 justify-center xl:flex"
        >
          <div className={theme.header.searchWrapper}>
            <div className={theme.header.searchIcon}>
              <SearchIcon />
            </div>

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search rentals, equipment, spaces..."
              className={theme.header.searchInput}
            />

            <button type="submit" className={theme.header.searchButton}>
              Search
            </button>
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <details className="group relative md:hidden">
            <summary className={theme.header.menuButton}>
              <MenuIcon />
            </summary>

            <div className="fixed left-0 right-0 top-16 z-50 border-b border-slate-200 bg-white shadow-xl shadow-slate-950/10">
              <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
                <form onSubmit={handleSearch} className="pb-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition focus-within:border-violet-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
                    <div className="text-slate-400">
                      <SearchIcon />
                    </div>

                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search rentals, equipment, spaces..."
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />

                    <button
                      type="submit"
                      className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                    >
                      Search
                    </button>
                  </div>
                </form>

                <div className="border-t border-slate-200 py-3">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Explore
                  </p>

                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
                    {navigationLinks.map((link) => {
                      const active = isRouteActive(pathname, link.href);

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={
                            active
                              ? "rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 transition"
                              : "rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                          }
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-200 py-3">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Rentals
                  </p>

                  <Link
                    href={mobileCtaHref}
                    className="flex items-center justify-between rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    <span>{mobileCtaLabel}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  {status === "authenticated" && session ? (
                    <>
                      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-3">
                        <UserAvatar
                          name={session.user.username || session.user.email}
                          imageUrl={session.user.avatarUrl ?? null}
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {displayName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {session.user.email}
                          </p>
                        </div>
                      </div>

                      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Account
                      </p>

                      <div className="grid gap-1 sm:grid-cols-2">
                        {accountLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className={theme.header.dropdownItem}
                          >
                            <p className="text-sm font-medium text-slate-950">
                              {link.label}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {link.description}
                            </p>
                          </Link>
                        ))}

                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          disabled={logoutPending}
                          className={theme.header.logoutButton}
                        >
                          {logoutPending ? "Logging out..." : "Log out"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Account
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href="/login"
                          className="rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Log in
                        </Link>

                        <Link
                          href="/signup"
                          className="rounded-xl bg-slate-950 px-3 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Sign up
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </details>

          {status === "loading" ? (
            <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 sm:block">
              Loading...
            </div>
          ) : status === "authenticated" && session ? (
              <details className="group relative hidden md:block">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm transition hover:bg-slate-50">
                  <UserAvatar
                    name={session.user.username || session.user.email}
                    imageUrl={session.user.avatarUrl ?? null}
                  />

                <div className="hidden min-w-0 text-left sm:block">
                  <p className="max-w-32 truncate text-sm font-medium text-slate-950">
                    {displayName}
                  </p>
                </div>

                <div className="hidden text-slate-500 transition group-open:rotate-180 sm:block">
                  <ChevronDownIcon />
                </div>
              </summary>

              <div className={theme.header.dropdown}>
                <div className={theme.header.dropdownHighlight}>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={session.user.username || session.user.email}
                      imageUrl={session.user.avatarUrl ?? null}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid gap-1">
                  {accountLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={theme.header.dropdownItem}
                    >
                      <p className="text-sm font-medium text-slate-950">
                        {link.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        {link.description}
                      </p>
                    </Link>
                  ))}

                  <div className="my-2 h-px bg-slate-200" />

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={logoutPending}
                    className={theme.header.logoutButton}
                  >
                    {logoutPending ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </div>
            </details>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname === "/login"
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                Log in
              </Link>

              <Link href="/signup" className={theme.header.secondaryAction}>
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}