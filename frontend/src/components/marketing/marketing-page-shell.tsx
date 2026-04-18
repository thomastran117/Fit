import type { ReactNode } from "react";
import Link from "next/link";

interface MarketingPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  children: ReactNode;
  aside?: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
}

export function MarketingPageShell({
  eyebrow,
  title,
  description,
  accent,
  children,
  aside,
  ctaLabel = "Talk to our team",
  ctaHref = "/contact",
}: MarketingPageShellProps) {
  return (
    <main className="relative overflow-hidden bg-[#f8fafc] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,_rgba(99,102,241,0.14),_transparent_22%),radial-gradient(circle_at_82%_18%,_rgba(56,189,248,0.16),_transparent_20%),radial-gradient(circle_at_50%_100%,_rgba(16,185,129,0.1),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#f6f8ff_35%,#eef6ff_100%)]" />
      <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute right-[-6rem] top-20 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />

      <section className="relative isolate border-b border-white/60 px-6 pb-20 pt-14 sm:pb-24 sm:pt-20">
        <div
          className="absolute inset-x-0 top-0 -z-10 h-[28rem]"
          style={{
            backgroundImage: `radial-gradient(circle at top left, ${accent}, transparent 54%)`,
          }}
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_22rem] lg:items-end">
          <div>
            <p className="inline-flex items-center rounded-full border border-indigo-200/60 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 shadow-sm backdrop-blur">
              {eyebrow}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl leading-none font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              {description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={ctaHref}
                className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.16)] transition hover:bg-slate-800"
              >
                {ctaLabel}
              </Link>
              <Link
                href="/services"
                className="rounded-2xl border border-white/80 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                Explore services
              </Link>
            </div>
          </div>

          {aside ? (
            <aside className="rounded-[2rem] border border-white/75 bg-white/78 p-6 shadow-[0_28px_70px_rgba(79,70,229,0.1)] backdrop-blur-xl">
              {aside}
            </aside>
          ) : null}
        </div>
      </section>

      <div className="relative px-6 py-14 sm:py-18">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </main>
  );
}
