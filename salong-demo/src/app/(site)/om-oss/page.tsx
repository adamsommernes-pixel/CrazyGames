import { salon } from "@config";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { MapPlaceholder } from "@/components/site/MapPlaceholder";
import { OpeningHoursTable } from "@/components/site/OpeningHoursTable";
import { UpcomingClosures } from "@/components/site/UpcomingClosures";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata = pageMetadata(salon, {
  title: t.about.title,
  description: `Adresse, åpningstider, telefon og ofte stilte spørsmål for ${salon.name}, ${salon.contact.address.street} i ${salon.contact.address.city}.`,
  path: "/om-oss",
});

export default function AboutPage() {
  const { address, phone, email, directions } = salon.contact;
  const lead = t.about.lead(address.street, address.area);

  return (
    <>
      <PageHeader label={t.nav.about} title={t.about.title} lead={lead} />

      <section className="page-x border-t border-line py-16 md:py-24" aria-labelledby="kontakt">
        <div className="page-grid mx-auto max-w-page gap-y-12">
          <div className="col-span-12 md:col-span-5 lg:col-span-4">
            <h2 id="kontakt" className="label text-muted">{t.about.findUs}</h2>
            <address className="mt-5 font-display text-d3 not-italic leading-tight">
              {address.street}
              <br />
              {address.postalCode} {address.city}
            </address>
            <p className="mt-5 text-muted">{directions}</p>
            <dl className="mt-10 grid grid-cols-[6rem_1fr] gap-y-3 border-t border-line pt-6">
              <dt className="label pt-1 text-muted">{t.common.phone}</dt>
              <dd><a className="link" href={telHref(phone)}>{phone}</a></dd>
              <dt className="label pt-1 text-muted">{t.common.email}</dt>
              <dd><a className="link break-all" href={`mailto:${email}`}>{email}</a></dd>
              <dt className="label pt-1 text-muted">{t.about.followUs}</dt>
              <dd className="flex flex-wrap gap-x-4">
                {salon.social.map((s) => (
                  <a key={s.href} className="link" href={s.href} rel="noopener">{s.label}</a>
                ))}
              </dd>
            </dl>
            <h2 className="label mt-12 text-muted">{t.common.openingHours}</h2>
            <OpeningHoursTable className="mt-3" />
            <UpcomingClosures className="mt-8" />
            <p className="mt-6 text-small text-muted">
              {t.about.holidaysBody}
            </p>
          </div>
          <div className="col-span-12 md:col-span-7 md:col-start-6 lg:col-span-7 lg:col-start-6">
            <MapPlaceholder className="aspect-square md:aspect-[4/5]" />
          </div>
        </div>
      </section>

      <Section tone="stone" className="page-x py-20 md:py-28" aria-labelledby="historien">
        <div className="page-grid mx-auto max-w-page gap-y-10">
          <div className="col-span-12 md:col-span-6 lg:col-span-5">
            <SectionHead number="01" label={t.about.storyLabel} />
            <h2 id="historien" className="mt-6 text-d2">{salon.about.heading}</h2>
            <div className="mt-8 grid max-w-measure gap-5">
              {salon.about.body.map((p, i) => (
                <p key={p} className={i === 0 ? "text-lead" : "text-muted"}>{p}</p>
              ))}
            </div>
          </div>
          <div className="col-span-12 md:col-span-5 md:col-start-8 md:mt-24">
            <ImageSlot image={salon.introImage} aspect="4/5" sizes="(min-width: 768px) 40vw, 100vw" />
          </div>
        </div>
      </Section>

      <section className="page-x py-20 md:py-28" aria-labelledby="faq">
        <div className="page-grid mx-auto max-w-page gap-y-10">
          <div className="col-span-12 lg:col-span-4">
            <SectionHead number="02" label={t.about.faqLabel} />
            <h2 id="faq" className="mt-6 text-d2">{t.about.faqHeading}</h2>
          </div>
          <div className="col-span-12 lg:col-span-7 lg:col-start-6">
            {salon.faq.map((item) => (
              <details key={item.question} className="group border-b border-line first:border-t">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-d4 leading-snug [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span aria-hidden="true" className="relative h-4 w-4 shrink-0">
                    <span className="absolute left-0 top-1/2 h-px w-4 bg-ink" />
                    <span className="absolute left-1/2 top-0 h-4 w-px bg-ink transition-transform duration-200 group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="max-w-measure pb-6 text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
