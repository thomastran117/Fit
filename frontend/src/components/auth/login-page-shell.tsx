import type { ReactNode } from "react";

function MailIcon() {
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
        d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m5 7 7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M7 10V8a5 5 0 0 1 10 0v2" strokeLinecap="round" strokeLinejoin="round" />
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5v14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface FeatureCardProps {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
  shadowClassName: string;
}

function FeatureCard({
  icon,
  iconClassName,
  title,
  description,
  shadowClassName,
}: FeatureCardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/70 bg-white/70 p-5 backdrop-blur ${shadowClassName}`}
    >
      <div
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName}`}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

interface LoginPageShellProps {
  children: ReactNode;
}

export function LoginPageShell({ children }: LoginPageShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(99,102,241,0.14),_transparent_22%),radial-gradient(circle_at_85%_18%,_rgba(56,189,248,0.16),_transparent_20%),radial-gradient(circle_at_50%_100%,_rgba(244,114,182,0.12),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f6f8ff_35%,#eef6ff_100%)]" />
      <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-pink-200/20 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:flex lg:items-center lg:px-14 xl:px-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center rounded-full border border-indigo-200/60 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 shadow-sm backdrop-blur">
              Welcome back
            </div>

            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 xl:text-6xl">
              Sign in to a brighter, cleaner rental workspace.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 xl:text-lg">
              Manage listings, bookings, and conversations from a calm interface with soft
              color, better focus, and less clutter.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <FeatureCard
                icon={<MailIcon />}
                iconClassName="bg-indigo-50 text-indigo-600"
                title="Fast access"
                description="Quickly reach your booking dashboard."
                shadowClassName="shadow-[0_12px_40px_rgba(99,102,241,0.08)]"
              />
              <FeatureCard
                icon={<LockIcon />}
                iconClassName="bg-sky-50 text-sky-600"
                title="Secure flow"
                description="Protected access with verification built in."
                shadowClassName="shadow-[0_12px_40px_rgba(56,189,248,0.08)]"
              />
              <FeatureCard
                icon={<PlusIcon />}
                iconClassName="bg-pink-50 text-pink-600"
                title="Less clutter"
                description="A softer layout that keeps attention on the essentials."
                shadowClassName="shadow-[0_12px_40px_rgba(244,114,182,0.08)]"
              />
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[540px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
