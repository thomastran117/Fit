import type { ReactNode } from "react";

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5.64 5.64 2.83 2.83" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m15.53 15.53 2.83 2.83" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 12h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5.64 18.36 2.83-2.83" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m15.53 8.47 2.83-2.83" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M12 3c2.49 1.91 5.55 2.97 8.69 3v5.54c0 5.02-3.3 9.48-8.12 10.96L12 22.66l-.57-.16C6.61 21.02 3.31 16.56 3.31 11.54V6C6.45 5.97 9.51 4.91 12 3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 7h9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 7 9 3m4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SignupPageLayoutProps {
  children: ReactNode;
}

export function SignupPageLayout({ children }: SignupPageLayoutProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,_rgba(16,185,129,0.14),_transparent_22%),radial-gradient(circle_at_82%_18%,_rgba(56,189,248,0.16),_transparent_20%),radial-gradient(circle_at_50%_100%,_rgba(99,102,241,0.12),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#f4fbf9_36%,#eef6ff_100%)]" />
      <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="absolute right-[-6rem] top-20 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-200/20 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden lg:flex lg:items-center lg:px-14 xl:px-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center rounded-full border border-emerald-200/70 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm backdrop-blur">
              Build your workspace
            </div>

            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 xl:text-6xl">
              Start a calmer rental workflow without the setup drag.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 xl:text-lg">
              Create an account, verify your email, and step straight into a cleaner dashboard
              for listings, bookings, and conversations.
            </p>

            <div className="mt-10 grid gap-4">
              <div className="rounded-3xl border border-white/75 bg-white/75 p-5 shadow-[0_18px_45px_rgba(16,185,129,0.08)] backdrop-blur">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <SparkIcon />
                </div>
                <p className="text-sm font-semibold text-slate-900">Fast onboarding</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Create your account in one pass and keep your verification ready as you move.
                </p>
              </div>

              <div className="rounded-3xl border border-white/75 bg-white/75 p-5 shadow-[0_18px_45px_rgba(56,189,248,0.08)] backdrop-blur">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <ShieldIcon />
                </div>
                <p className="text-sm font-semibold text-slate-900">Protected setup</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Security checks and email verification are built into the flow from the start.
                </p>
              </div>

              <div className="rounded-3xl border border-white/75 bg-white/75 p-5 shadow-[0_18px_45px_rgba(99,102,241,0.08)] backdrop-blur">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <FlowIcon />
                </div>
                <p className="text-sm font-semibold text-slate-900">Cleaner next step</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Land in an organized workspace instead of juggling separate admin tools.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 sm:px-8 lg:px-10 xl:px-14">
          <div className="w-full max-w-[660px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
