import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { SectionHeading } from "@/components/marketing/section-heading";

export const metadata: Metadata = {
  title: "About | Rentify",
  description: "Learn how Rentify approaches rental websites, guest trust, and digital operations.",
};

const values = [
  {
    title: "Clarity first",
    description:
      "We simplify the path from curiosity to confidence so renters know what matters, when it matters.",
  },
  {
    title: "Hospitality in the details",
    description:
      "The best rental experiences feel considered long before check-in, from copy to contact flows to policy language.",
  },
  {
    title: "Systems that scale",
    description:
      "We design with growth in mind so one strong property can become a strong portfolio without rebuilding the experience from scratch.",
  },
];

const process = [
  "Understand the tone, property mix, and audience you are serving.",
  "Structure the site so key questions are answered before friction builds.",
  "Pair design language with practical support and compliance pages.",
];

export default function AboutPage() {
  return (
    <MarketingPageShell
      eyebrow="About Rentify"
      title="We design rental experiences that feel both polished and practical."
      description="Rentify exists to help rental operators present their offering beautifully while keeping the everyday business side easier to manage."
      accent="rgba(212,168,95,0.26)"
      aside={
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">
            Our focus
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
            Trust, clarity, and momentum.
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            We bring together strong storytelling, confident visual design, and the
            operational pages renters actually need.
          </p>
        </div>
      }
    >
      <section>
        <SectionHeading
          eyebrow="What drives us"
          title="A better rental site should make life easier for both sides."
          description="That means sharper presentation for your brand and fewer moments of confusion for the people trying to rent from you."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {values.map((value) => (
            <article
              key={value.title}
              className="rounded-[2rem] border border-white/75 bg-white/75 px-6 py-7 shadow-[0_18px_45px_rgba(79,70,229,0.08)] backdrop-blur"
            >
              <h2 className="text-3xl leading-tight font-semibold tracking-[-0.04em] text-slate-950">
                {value.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 rounded-[2.5rem] border border-white/75 bg-white/72 px-7 py-8 shadow-[0_20px_55px_rgba(79,70,229,0.08)] backdrop-blur lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">
            How we work
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
            Thoughtful structure before visual flourishes.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            Great rental pages are persuasive because they are coherent. We build around
            the questions, concerns, and decisions your visitors are already carrying.
          </p>
        </div>
        <div className="grid gap-4">
          {process.map((item, index) => (
            <div
              key={item}
              className="rounded-[1.75rem] border border-white/80 bg-white/90 px-5 py-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Step 0{index + 1}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-900">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}
