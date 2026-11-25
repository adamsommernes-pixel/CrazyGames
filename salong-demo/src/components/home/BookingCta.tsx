import { salon } from "@config";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

export function BookingCta() {
  return (
    <Section tone="accent" className="page-x py-20 md:py-28">
      <div className="page-grid mx-auto max-w-page gap-y-10">
        <h2 className="col-span-12 max-w-[14ch] text-d1 lg:col-span-8">{t.home.ctaHeading}</h2>
        <div className="col-span-12 self-end lg:col-span-4">
          <p className="max-w-sm">{t.home.ctaBody(2)}</p>
          <ButtonLink href="/bestill" variant="inverse" size="lg" arrow className="mt-7 w-full sm:w-auto">
            {t.nav.book}
          </ButtonLink>
          <p className="mt-5 text-small">
            {t.common.orCall}{" "}
            <a href={telHref(salon.contact.phone)} className="link">
              {salon.contact.phone}
            </a>
          </p>
        </div>
      </div>
    </Section>
  );
}
