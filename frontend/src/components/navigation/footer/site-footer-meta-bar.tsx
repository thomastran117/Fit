import Link from "next/link";
import { theme } from "@/styles/theme";

interface SiteFooterMetaBarProps {
  currentYear: number;
}

export function SiteFooterMetaBar({
  currentYear,
}: SiteFooterMetaBarProps) {
  return (
    <div className={theme.footer.metaBar}>
      <p>&copy; {currentYear} Rentify. All rights reserved.</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/privacy" className={theme.footer.legalLink}>
          Privacy
        </Link>
        <Link href="/terms" className={theme.footer.legalLink}>
          Terms
        </Link>
        <Link href="/accessibility" className={theme.footer.legalLink}>
          Accessibility
        </Link>
      </div>
    </div>
  );
}
