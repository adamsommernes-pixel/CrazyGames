import { salon } from "@config";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";
import { SectionHead } from "@/components/ui/SectionHead";
import { MapPlaceholder } from "@/components/site/MapPlaceholder";
import { OpeningHoursTable } from "@/components/site/OpeningHoursTable";

export function Visit() {
  const { address, phone, email, directions } = salon.contact;
  return (
    <section className="page-x py-24 md:py-32">
      <div className="page-grid mx-auto max-w-page gap-y-12">
        <div className="col-span-12 md:col-span-5 lg:col-span-4">
          <SectionHead number="06" label={t.common.address} />
          <h2 className="mt-6 text-d2">{t.home.visitHeading}</h2>
          <address className="mt-8 font-display text-d4 not-italic leading-snug">
            {address.street}
            <br />
            {address.postalCode} {address.city}
          </address>
          <p className="mt-4 text-small text-muted">{directions}</p>
          <p className="mt-6 grid gap-1">
            <a href={telHref(phone)} className="link w-fit">{phone}</a>
            <a href={`mailto:${email}`} className="link w-fit">{email}</a>
          </p>
          <h3 className="label mt-12 text-muted">{t.common.openingHours}</h3>
          <OpeningHoursTable className="mt-3" />
        </div>
        <div className="col-span-12 md:col-span-7 md:col-start-6 lg:col-span-7 lg:col-start-6">
          <MapPlaceholder className="aspect-[4/5] md:sticky md:top-10 md:aspect-auto md:h-[min(42rem,80vh)]" />
        </div>
      </div>
    </section>
  );
}
