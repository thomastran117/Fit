import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata: Metadata = {
  title: "Services | Rentify",
  description: "Explore Rentify services for rental brand design, guest communication, and policy experiences.",
};

const serviceGroups = [
  {
    name: "Brand and site design",
    description:
      "Home pages, property storytelling, supporting page structure, and visual systems that feel premium and conversion-aware.",
  },
  {
    name: "Guest-facing communication",
    description:
      "Contact experiences, support touchpoints, and information architecture that lowers uncertainty before booking.",
  },
  {
    name: "Trust and compliance pages",
    description:
      "Privacy and terms content presented in a way that is readable, well-organized, and aligned with the rest of the brand.",
  },
  {
    name: "Operational content systems",
    description:
      "Scalable patterns for service pages, frequently asked details, and consistent messaging across your portfolio.",
  },
];

export default function ServicesPage() {
  return (
    <MarketingPageShell
      eyebrow="Services"
      title="Flexible service design for modern rental teams."
      description="Whether you manage one standout property or a growing collection, Rentify helps shape the pages that move visitors from interest to action."
      accent="rgba(37,99,235,0.2)"
      aside={
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-600">
              Typical scope
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Home, about, services, contact, privacy, terms, and supporting trust
              layers for your rental brand.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Best for
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-900">
              Boutique operators, furnished rentals, short-stay brands, and teams who
              want a calmer digital experience.
            </p>
          </div>
        </div>
      }
    >
      <section className="grid gap-5 lg:grid-cols-2">
        {serviceGroups.map((group, index) => (
          <article
            key={group.name}
            className="rounded-[2rem] border border-white/75 bg-white/75 px-6 py-7 shadow-[0_18px_45px_rgba(79,70,229,0.08)] backdrop-blur"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Service 0{index + 1}
            </p>
            <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.04em] text-slate-950">
              {group.name}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">{group.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-14 rounded-[2.5rem] border border-white/75 bg-white/78 px-7 py-9 shadow-[0_28px_70px_rgba(79,70,229,0.1)] backdrop-blur-xl sm:px-9">
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">
              Need a tailored scope
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
              We can shape the experience around your portfolio and workflow.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              If you already know which pages you need, or you want help deciding what
              matters most, we can use the contact page as a starting point.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.16)] transition hover:bg-slate-800"
          >
            Discuss your project
          </Link>
        </div>
      </section>
    </MarketingPageShell>
  );
}
