import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata: Metadata = {
  title: "Privacy | Rentify",
  description: "Read the Rentify privacy policy and how information is handled across the site.",
};

const privacySections = [
  {
    title: "Information we collect",
    body:
      "We may collect contact details, account details, usage information, device information, and messages you choose to send through the site or account-related flows.",
  },
  {
    title: "How information is used",
    body:
      "Information is used to operate the service, maintain security, support customer communication, improve product experiences, and meet legal or compliance obligations.",
  },
  {
    title: "Sharing and processors",
    body:
      "We may work with infrastructure, analytics, communication, and verification providers who process information on our behalf under appropriate contractual safeguards.",
  },
  {
    title: "Retention and rights",
    body:
      "We retain information for as long as necessary to provide the service, resolve disputes, enforce agreements, and meet regulatory requirements. Users may request access, correction, or deletion where applicable.",
  },
];

export default function PrivacyPage() {
  return (
    <MarketingPageShell
      eyebrow="Privacy policy"
      title="A readable privacy page that supports trust, not confusion."
      description="This sample privacy page is structured to feel clear and calm while still covering the main expectations around collection, use, sharing, and retention."
      accent="rgba(37,99,235,0.18)"
      aside={
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-600">
            Last updated
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
            April 17, 2026
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Replace this content with your finalized legal language before going live.
          </p>
        </div>
      }
      ctaLabel="Contact about privacy"
    >
      <section className="grid gap-5">
        {privacySections.map((section) => (
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
