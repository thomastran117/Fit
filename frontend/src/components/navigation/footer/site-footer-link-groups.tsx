import Link from "next/link";
import { theme } from "@/styles/theme";
import {
  footerLinkGroups,
  type FooterLinkItem,
} from "./site-footer.shared";

interface FooterLinkGroupProps {
  title: string;
  links: ReadonlyArray<FooterLinkItem>;
}

function FooterLinkGroup({ title, links }: FooterLinkGroupProps) {
  return (
    <div className="min-w-0">
      <p className={theme.footer.sectionTitle}>{title}</p>

      <nav className="mt-3 grid gap-2 sm:mt-4">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={theme.footer.link}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function SiteFooterLinkGroups() {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:justify-items-start">
      {footerLinkGroups.map((group) => (
        <FooterLinkGroup
          key={group.title}
          title={group.title}
          links={group.links}
        />
      ))}
    </div>
  );
}
