import { t } from "@/i18n";
import { SectionHead } from "@/components/ui/SectionHead";
import { MapPlaceholder } from "@/components/site/MapPlaceholder";
import { OpeningHoursTable } from "@/components/site/OpeningHoursTable";
import { UpcomingClosures } from "@/components/site/UpcomingClosures";
import { EmailLink, PhoneLink, ProfileText } from "@/components/site/Live";

export function Visit() {
  return (
    <section className="page-x py-24 md:py-32">
      <div className="page-grid mx-auto max-w-page gap-y-12">
        <div className="col-span-12 md:col-span-5 lg:col-span-4">
          <SectionHead number="06" label={t.common.address} />
          <h2 className="mt-6 text-d2">{t.home.visitHeading}</h2>
          <address className="mt-8 font-display text-d4 not-italic leading-snug">
            <ProfileText field="street" />
            <br />
            <ProfileText field="postalCity" />
          </address>
          <p className="mt-4 text-small text-muted"><ProfileText field="directions" /></p>
          <p className="mt-6 grid gap-1">
            <PhoneLink className="link w-fit" />
            <EmailLink className="link w-fit" />
          </p>
          <h3 className="label mt-12 text-muted">{t.common.openingHours}</h3>
          <OpeningHoursTable className="mt-3" />
          <UpcomingClosures className="mt-8" />
        </div>
        <div className="col-span-12 md:col-span-7 md:col-start-6 lg:col-span-7 lg:col-start-6">
          <MapPlaceholder className="aspect-[4/5] md:sticky md:top-10 md:aspect-auto md:h-[min(42rem,80vh)]" />
        </div>
      </div>
    </section>
  );
}
