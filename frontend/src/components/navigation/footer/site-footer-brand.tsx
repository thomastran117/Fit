import Link from "next/link";
import { SiteHeaderLogo } from "@/components/navigation/header/site-header.shared";
import { theme } from "@/styles/theme";
import { footerSocialLinks } from "./site-footer.shared";

export function SiteFooterBrand() {
  return (
    <div className="max-w-md">
      <Link href="/" className="group inline-flex">
        <SiteHeaderLogo />
      </Link>

      <p className={theme.footer.description}>
        Search, compare, and manage rental postings with a cleaner, faster
        experience.
      </p>

      <div className="mt-5 flex items-center gap-2">
        {footerSocialLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              className={theme.footer.socialLink}
            >
              <Icon size={17} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
