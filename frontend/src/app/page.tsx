import Link from "next/link";

const highlights = [
  { label: "Listings launched", value: "4.2k+" },
  { label: "Avg. guest response", value: "< 7 min" },
  { label: "Cities supported", value: "58" },
];

const serviceCards = [
  {
    title: "Beautiful presentation",
    description:
      "Show homes, rooms, and stays with a cleaner structure that feels premium without overwhelming visitors.",
    accent: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "Guest-ready support",
    description:
      "Bring inquiries, contact details, and expectation-setting into one softer, easier-to-follow experience.",
    accent: "bg-sky-50 text-sky-600",
  },
  {
    title: "Clear trust pages",
    description:
      "Privacy and terms pages stay readable and aligned with the rest of the site instead of feeling bolted on.",
    accent: "bg-emerald-50 text-emerald-600",
  },
];

const pillars = [
  {
    title: "Calmer first impressions",
    description:
      "The visual style reduces clutter and brings attention to the actions that matter most.",
  },
  {
    title: "Better page continuity",
    description:
      "Home, about, services, contact, and legal pages now feel like one product family.",
  },
  {
    title: "Ready for real content",
    description:
      "The structure is polished enough to present now and flexible enough to connect to live data later.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-[calc(100vh-5.5rem)] overflow-hidden bg-[#f8fafc] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(99,102,241,0.14),_transparent_22%),radial-gradient(circle_at_85%_18%,_rgba(56,189,248,0.16),_transparent_20%),radial-gradient(circle_at_50%_100%,_rgba(16,185,129,0.1),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f6f8ff_35%,#eef6ff_100%)]" />
      <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />

      <section className="relative px-6 pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-indigo-200/60 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 shadow-sm backdrop-blur">
              Rental workspace
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-6xl">
              A home page system that looks like it belongs with your auth flow.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Rentify now carries the same soft gradients, glassy cards, and cleaner
              structure from login and signup into the rest of the website.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/contact"
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.16)] transition hover:bg-slate-800"
              >
                Start a project
              </Link>
              <Link
                href="/services"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/80 bg-white/80 px-6 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                View services
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/75 bg-white/75 p-5 shadow-[0_18px_45px_rgba(79,70,229,0.08)] backdrop-blur"
                >
                  <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/75 bg-white/78 p-6 shadow-[0_28px_70px_rgba(79,70,229,0.1)] backdrop-blur-xl sm:p-8">
            <div className="rounded-[1.75rem] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-600">Featured experience</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                    Shoreline House
                  </h2>
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Available
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(99,102,241,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Occupancy lift
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                    31%
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Clearer presentation and stronger trust pages help guests decide faster.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(56,189,248,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Experience details
                  </p>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                    <li>Fast answers before booking</li>
                    <li>Clear terms before arrival</li>
                    <li>One place for support details</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-6 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-indigo-600">What this covers</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.6rem]">
              The full site now follows the softer auth aesthetic.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Instead of a separate marketing style, these pages now inherit the same
              polished workspace feel as login and signup.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {serviceCards.map((card) => (
              <article
                key={card.title}
                className="rounded-3xl border border-white/75 bg-white/75 p-5 shadow-[0_18px_45px_rgba(79,70,229,0.08)] backdrop-blur"
              >
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${card.accent}`}>
                  <span className="text-sm font-semibold">R</span>
                </div>
                <h3 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-6 py-10 sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-3xl border border-white/75 bg-white/75 p-6 shadow-[0_18px_45px_rgba(79,70,229,0.08)] backdrop-blur"
            >
              <h3 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {pillar.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
