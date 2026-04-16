"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

interface AuthGuardProps {
  mode: "anonymous-only" | "authenticated-only";
  children: ReactNode;
}

export function AuthGuard({ mode, children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (mode === "anonymous-only" && status === "authenticated") {
      router.replace("/");
      return;
    }

    if (mode === "authenticated-only" && status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [mode, pathname, router, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream px-6">
        <div className="rounded-full border border-white/80 bg-white/80 px-5 py-3 text-sm text-slate-600 shadow-lg backdrop-blur">
          Preparing Rentify...
        </div>
      </div>
    );
  }

  if (mode === "anonymous-only" && status === "authenticated") {
    return null;
  }

  if (mode === "authenticated-only" && status === "anonymous") {
    return null;
  }

  return <>{children}</>;
}
