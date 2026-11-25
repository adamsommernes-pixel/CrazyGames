import { salon } from "@config";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";
import { ArrowLink, ButtonLink } from "@/components/ui/Button";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { OpenToday } from "@/components/site/OpenToday";

export function Hero() {
  const { hero, heroImage, contact } = salon;
  return (
    <section className="page-x pt-10 md:pt-14 lg:pt-20">
      <div className="page-grid mx-auto max-w-page">
        <div className="col-span-12 lg:col-span-8 lg:pt-8">
          <p className="label flex items-center gap-4 text-muted">
            <span aria-hidden="true" className="h-px w-10 bg-accent" />
            {hero.eyebrow}
          </p>
          <h1 className="mt-6 max-w-[13ch] text-d1 md:mt-8">{hero.heading}</h1>
          <div className="mt-8 grid items-end gap-8 md:mt-12 md:grid-cols-[minmax(0,25rem)_auto] md:gap-10">
            <p className="text-lead">{hero.lead}</p>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
              <ButtonLink href="/bestill" size="lg" arrow>
                {t.nav.book}
              </ButtonLink>
              <ArrowLink href="/tjenester">Se priser</ArrowLink>
            </div>
          </div>
        </div>
        <figure className="col-span-12 -mr-[clamp(1.125rem,0.6rem+2.4vw,3rem)] ml-14 mt-14 sm:ml-32 md:ml-[40%] lg:col-span-4 lg:mr-0 lg:ml-0 lg:mt-0">
          <ImageSlot image={heroImage} aspect="3/4" priority sizes="(min-width: 1024px) 30vw, (min-width: 768px) 60vw, 80vw" />
          <figcaption className="label mt-3 flex justify-between gap-4 pr-[clamp(1.125rem,0.6rem+2.4vw,3rem)] text-muted lg:pr-0">
            <span>{contact.address.street}</span>
            <span>
              {contact.address.area}, {contact.address.city}
            </span>
          </figcaption>
        </figure>
      </div>
      <ul className="mx-auto mt-14 grid max-w-page border-y border-line text-small md:mt-20 md:grid-cols-3">
        <li className="flex min-h-14 items-center gap-3 border-b border-line py-3 md:border-b-0 md:border-r md:pr-6">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          <OpenToday />
        </li>
        <li className="flex min-h-14 items-center border-b border-line py-3 md:border-b-0 md:border-r md:px-6">
          {contact.address.street}, {contact.address.postalCode} {contact.address.city}
        </li>
        <li className="flex min-h-14 items-center py-3 md:px-6">
          <a href={telHref(contact.phone)} className="link">
            {contact.phone}
          </a>
        </li>
      </ul>
    </section>
  );
}
