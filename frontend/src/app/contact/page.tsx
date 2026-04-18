import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata: Metadata = {
  title: "Contact | Rentify",
  description: "Get in touch with Rentify about your rental brand, pages, and guest experience.",
};

const contactChannels = [
  { label: "General inquiries", value: "hello@rentify.co" },
  { label: "Partnerships", value: "partners@rentify.co" },
  { label: "Studio hours", value: "Mon - Fri, 9:00 AM - 6:00 PM" },
];

export default function ContactPage() {
  return (
    <MarketingPageShell
      eyebrow="Contact"
      title="Tell us what you are building and where the experience needs help."
      description="Use this page to start a conversation around your rental brand, guest journey, or the supporting pages your business still needs."
      accent="rgba(66,109,86,0.24)"
      aside={
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">
            Response window
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
            1 business day
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Ideal for teams who want clarity on pages, structure, visual direction, or
            guest-facing trust content.
          </p>
        </div>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="grid gap-5">
          {contactChannels.map((channel) => (
            <article
              key={channel.label}
              className="rounded-[2rem] border border-white/75 bg-white/75 px-6 py-6 shadow-[0_16px_40px_rgba(79,70,229,0.08)] backdrop-blur"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {channel.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                {channel.value}
              </p>
            </article>
          ))}
        </div>

        <div className="rounded-[2.25rem] border border-white/75 bg-white/78 p-6 shadow-[0_28px_70px_rgba(79,70,229,0.1)] backdrop-blur-xl sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-600">
              Name
              <input
                type="text"
                placeholder="Your name"
                className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white"
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-600">
              Email
              <input
                type="email"
                placeholder="you@example.com"
                className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white"
              />
            </label>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-600">
              Company
              <input
                type="text"
                placeholder="Brand or portfolio name"
                className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white"
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-600">
              Focus area
              <select className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white">
                <option>Home page redesign</option>
                <option>Multi-page website design</option>
                <option>Privacy and legal page refresh</option>
                <option>Full brand experience</option>
              </select>
            </label>
          </div>
          <label className="mt-5 grid gap-2 text-sm text-slate-600">
            Project notes
            <textarea
              rows={6}
              placeholder="Tell us about your property type, audience, and the pages you need."
              className="rounded-[1.5rem] border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white"
            />
          </label>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs leading-6 text-slate-500">
              This form is currently presented as a design-ready contact experience and
              can be connected to your backend or CRM next.
            </p>
            <button
              type="button"
              className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(79,70,229,0.16)] transition hover:bg-slate-800"
            >
              Send inquiry
            </button>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
