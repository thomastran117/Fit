import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  footer,
  children,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(243,190,116,0.32),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(66,109,86,0.28),_transparent_32%),linear-gradient(180deg,_#f8f2e8_0%,_#f3efe6_48%,_#ede7dc_100%)] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.38)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.38)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-sm font-semibold tracking-[0.28em] text-slate-700 uppercase"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/80 text-lg text-emerald-800 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.55)]">
              R
            </span>
            Rentify
          </Link>
          <p className="hidden text-sm text-slate-600 md:block">
            Trusted rentals for homes, rooms, tools, and more.
          </p>
        </header>

        <main className="flex flex-1 items-center py-8 lg:py-12">
          <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
            <section className="flex flex-col justify-between rounded-[2rem] border border-white/70 bg-white/58 p-7 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur xl:p-10">
              <div className="space-y-6">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-800/90">
                  {eyebrow}
                </p>
                <div className="space-y-4">
                  <h1 className="max-w-xl font-serif-display text-5xl leading-none tracking-tight text-slate-950 sm:text-6xl">
                    {title}
                  </h1>
                  <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                    {description}
                  </p>
                </div>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/70 bg-white/72 p-5">
                  <p className="text-sm font-semibold text-slate-900">Verified accounts</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Email verification keeps marketplace conversations more trustworthy.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/72 p-5">
                  <p className="text-sm font-semibold text-slate-900">Device-aware sign-in</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Session responses already include device details for safer future flows.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/72 p-5">
                  <p className="text-sm font-semibold text-slate-900">Built for mobile</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    The full auth flow is responsive from the first pass.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200/80 bg-[rgba(249,247,243,0.92)] p-5 shadow-[0_28px_110px_-48px_rgba(15,23,42,0.45)] backdrop-blur sm:p-7 lg:p-9">
              {children}
              <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">
                {footer}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
