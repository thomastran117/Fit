import { SiteFooterBrand } from "@/components/navigation/footer/site-footer-brand";
import { SiteFooterLinkGroups } from "@/components/navigation/footer/site-footer-link-groups";
import { SiteFooterMetaBar } from "@/components/navigation/footer/site-footer-meta-bar";
import { theme } from "@/styles/theme";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={theme.footer.shell}>
      <div className={theme.footer.container}>
        <div className="grid gap-8 border-b border-slate-200 pb-8 sm:gap-10 sm:pb-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          <SiteFooterBrand />
          <SiteFooterLinkGroups />
        </div>

        <SiteFooterMetaBar currentYear={currentYear} />
      </div>
    </footer>
  );
}
