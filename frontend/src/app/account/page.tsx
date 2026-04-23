"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Link2, ShieldCheck, Unlink } from "lucide-react";
import { AuthOAuthButtons, type OAuthProvider } from "@/components/auth/oauth-buttons";
import { useAuth } from "@/components/auth/auth-context";
import { HomePasswordPanel } from "@/components/home/home-password-panel";
import { authApi } from "@/lib/auth/api";
import {
  ApiError,
  type LinkedOAuthProvidersResult,
  type OAuthProvider as LinkedOAuthProvider,
} from "@/lib/auth/types";

const providerLabels: Record<LinkedOAuthProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple",
};

function formatLinkedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function AccountPage() {
  const { status, session } = useAuth();
  const [providers, setProviders] = useState<LinkedOAuthProvidersResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<LinkedOAuthProvider | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let active = true;

    authApi
      .linkedOAuthProviders()
      .then((result) => {
        if (active) {
          setProviders(result);
        }
      })
      .catch(() => {
        if (active) {
          setMessage("Connected providers could not be loaded.");
        }
      });

    return () => {
      active = false;
    };
  }, [status]);

  const linkedProviderNames = useMemo(
    () => new Set(providers?.providers.map((provider) => provider.provider) ?? []),
    [providers],
  );

  const canUnlinkProvider = Boolean(
    providers && (providers.hasPassword || providers.providers.length > 1),
  );

  async function handleUnlink(provider: LinkedOAuthProvider) {
    setPendingUnlink(provider);
    setMessage(null);

    try {
      const result = await authApi.unlinkOAuthProvider(provider);
      setProviders(result);
      setMessage(`${providerLabels[provider]} was unlinked.`);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Provider could not be unlinked right now.",
      );
    } finally {
      setPendingUnlink(null);
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-[calc(100vh-5.5rem)] bg-slate-50 px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl text-sm font-medium text-slate-500">
          Loading account...
        </div>
      </main>
    );
  }

  if (status !== "authenticated" || !session) {
    return (
      <main className="min-h-[calc(100vh-5.5rem)] bg-slate-50 px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-semibold text-slate-950">Account</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in to manage login methods and connected providers.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-5.5rem)] bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">Account</h1>
              <p className="mt-1 text-sm text-slate-600">{session.user.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-slate-600">Password</span>
              <span className="font-medium text-slate-950">
                {providers?.hasPassword ? "Enabled" : "Not enabled"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-slate-600">Connected providers</span>
              <span className="font-medium text-slate-950">
                {providers ? providers.providers.length : "..."}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Login methods</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Manage Google and Microsoft sign-in for this account.
              </p>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {providers?.providers.map((provider) => (
              <div
                key={provider.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-950">
                    {providerLabels[provider.provider]}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {provider.providerEmail ?? "Provider email hidden"} - linked{" "}
                    {formatLinkedAt(provider.linkedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleUnlink(provider.provider)}
                  disabled={!canUnlinkProvider || pendingUnlink === provider.provider}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    canUnlinkProvider
                      ? `Unlink ${providerLabels[provider.provider]}`
                      : "Add another sign-in method before unlinking"
                  }
                >
                  <Unlink className="h-4 w-4" aria-hidden="true" />
                  {pendingUnlink === provider.provider ? "Unlinking..." : "Unlink"}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <AuthOAuthButtons
              mode="link"
              disabledProviders={Array.from(linkedProviderNames) as OAuthProvider[]}
              onLinked={(result) => {
                setProviders(result);
                setMessage("Provider linked.");
              }}
              onError={setMessage}
            />
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3 text-slate-700">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-slate-950">Password</h2>
          </div>
          <HomePasswordPanel />
        </section>
      </div>
    </main>
  );
}
