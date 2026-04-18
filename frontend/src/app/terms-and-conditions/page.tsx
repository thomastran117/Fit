import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata: Metadata = {
  title: "Terms and Conditions | Rentify",
  description: "Review the Rentify terms and conditions for access, use, responsibilities, and limitations.",
};

const termsSections = [
  {
    title: "Use of the site",
    body:
      "By using this site, you agree to use it lawfully, provide accurate information where required, and avoid interfering with the security, performance, or availability of the service.",
  },
  {
    title: "Accounts and responsibilities",
    body:
      "If you create an account, you are responsible for maintaining the confidentiality of your credentials and for activities that occur under your account, subject to applicable law.",
  },
  {
    title: "Listings, content, and availability",
    body:
      "Property, rental, and service information may change over time. Availability, pricing, and operational details should be confirmed through the relevant booking or support process.",
  },
  {
    title: "Limitations and governing terms",
    body:
      "The service may be updated, suspended, or discontinued from time to time. Additional contractual documents, booking rules, or jurisdiction-specific requirements may also apply depending on the rental context.",
  },
];

export default function TermsAndConditionsPage() {
  return (
    <MarketingPageShell
      eyebrow="Terms and conditions"
      title="Clear terms help set expectations before issues appear."
      description="This sample terms page gives you a well-designed foundation for site usage, account expectations, content disclaimers, and basic limitations."
      accent="rgba(212,168,95,0.24)"
      aside={
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-600">
            Guidance
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
            Template content
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Review with legal counsel before publishing, especially if you process
            bookings, payments, or region-specific consumer rights.
          </p>
        </div>
      }
      ctaLabel="Discuss your website"
      ctaHref="/contact"
    >
      <section className="grid gap-5">
        {termsSections.map((section) => (
          <article
            key={section.title}
            className="rounded-[2rem] border border-white/75 bg-white/75 px-6 py-7 shadow-[0_18px_45px_rgba(79,70,229,0.08)] backdrop-blur"
          >
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              {section.title}
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
              {section.body}
            </p>
          </article>
        ))}
      </section>
    </MarketingPageShell>
  );
}
