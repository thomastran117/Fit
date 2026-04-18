import Link from "next/link";
import { AtSign, ExternalLink, Globe, MessageCircle } from "lucide-react";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms-and-conditions", label: "Terms" },
];

const socials = [
  { href: "#", icon: Globe, label: "Website" },
  { href: "#", icon: MessageCircle, label: "Message" },
  { href: "#", icon: AtSign, label: "Email" },
  { href: "#", icon: ExternalLink, label: "External link" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                R
              </div>

              <div>
                <p className="text-xl font-semibold text-slate-950">Rentify</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Modern rentals
                </p>
              </div>
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-500">
              Rentify helps rental businesses create cleaner, more trustworthy customer
              experiences online.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-950">Navigation</p>

            <nav className="mt-4 grid gap-3 text-sm">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-slate-500 transition hover:text-slate-950"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-950">Connect</p>

            <a
              href="mailto:hello@rentify.co"
              className="mt-4 block text-sm text-slate-500 hover:text-slate-950"
            >
              hello@rentify.co
            </a>

            <div className="mt-5 flex items-center gap-3">
              {socials.map((social, index) => {
                const Icon = social.icon;

                return (
                  <a
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Rentify. All rights reserved.</p>

          <div className="flex gap-4">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-950">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
