"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { authApi } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";
import { theme } from "@/styles/theme";
import { SiteHeaderDesktopAccount } from "./site-header-account-panels";
import { SiteHeaderMobileMenu } from "./site-header-mobile-menu";
import { SiteHeaderDesktopNav } from "./site-header-navigation";
import { SiteHeaderSearchForm } from "./site-header-search-form";
import {
  getAccountLinks,
  getDisplayLabel,
  SiteHeaderLogo,
} from "./site-header.shared";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, session, clearSession } = useAuth();
  const [logoutPending, setLogoutPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const accountLinks = getAccountLinks(session?.user.role);
  const displayName = session
    ? getDisplayLabel(session.user.email, session.user.username)
    : "Account";

  const userCanCreatePosting =
    session?.user.role === "owner" || session?.user.role === "admin";
  const mobileCtaHref = userCanCreatePosting ? "/postings/create" : "/signup";
  const mobileCtaLabel = userCanCreatePosting
    ? "Create posting"
    : "List a rental";

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) {
      router.push("/postings");
      return;
    }

    router.push(`/postings?q=${encodeURIComponent(query)}`);
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
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <Link href="/" className="group shrink-0">
            <SiteHeaderLogo />
          </Link>

          <SiteHeaderDesktopNav pathname={pathname} />
        </div>

        <SiteHeaderSearchForm
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSubmit={handleSearch}
          variant="desktop"
        />

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          <SiteHeaderMobileMenu
            pathname={pathname}
            status={status}
            session={session}
            displayName={displayName}
            accountLinks={accountLinks}
            logoutPending={logoutPending}
            onLogout={handleLogout}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearchSubmit={handleSearch}
            mobileCtaHref={mobileCtaHref}
            mobileCtaLabel={mobileCtaLabel}
          />

          <SiteHeaderDesktopAccount
            pathname={pathname}
            status={status}
            session={session}
            displayName={displayName}
            accountLinks={accountLinks}
            logoutPending={logoutPending}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </header>
  );
}
