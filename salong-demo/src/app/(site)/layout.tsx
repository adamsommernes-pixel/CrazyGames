import { t } from "@/i18n";
import { MobileBookBar } from "@/components/site/MobileBookBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#innhold"
        className="label fixed left-3 top-3 z-50 -translate-y-24 bg-ink px-4 py-3 text-paper focus:translate-y-0"
      >
        {t.nav.skipToContent}
      </a>
      <SiteHeader />
      <main id="innhold" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
      <MobileBookBar />
    </>
  );
}
