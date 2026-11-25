import { t } from "@/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="innhold" className="page-x py-24 md:py-36">
        <div className="mx-auto max-w-page">
          <p className="label text-muted">404</p>
          <h1 className="mt-6 max-w-[14ch] text-d1">{t.notFound.title}</h1>
          <p className="mt-6 max-w-measure text-lead text-muted">{t.notFound.body}</p>
          <ButtonLink href="/" size="lg" arrow className="mt-10">
            {t.notFound.home}
          </ButtonLink>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
