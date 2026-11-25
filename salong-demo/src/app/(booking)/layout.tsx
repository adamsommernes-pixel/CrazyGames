import { t } from "@/i18n";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#innhold"
        className="label fixed left-3 top-3 z-50 -translate-y-24 bg-ink px-4 py-3 text-paper focus:translate-y-0"
      >
        {t.nav.skipToContent}
      </a>
      <SiteHeader showBook={false} />
      <main id="innhold" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </>
  );
}
