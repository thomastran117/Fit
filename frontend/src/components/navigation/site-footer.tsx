import { SiteFooterBrand } from "@/components/navigation/footer/site-footer-brand";
import { SiteFooterLinkGroups } from "@/components/navigation/footer/site-footer-link-groups";
import { SiteFooterMetaBar } from "@/components/navigation/footer/site-footer-meta-bar";
import { theme } from "@/styles/theme";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={theme.footer.shell}>
      <div className={theme.footer.container}>
        <div className={theme.footer.topGrid}>
          <SiteFooterBrand />
          <SiteFooterLinkGroups />
        </div>

        <SiteFooterMetaBar currentYear={currentYear} />
      </div>
    </footer>
  );
}
