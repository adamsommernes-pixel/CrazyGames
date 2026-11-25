import { salon } from "@config";
import { t } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { cx } from "@/components/ui/cx";
import { PageHeader } from "@/components/site/PageHeader";

/** Alternating wide/narrow pairs, the narrow one dropped, so rows read left to right. */
const LAYOUT = [
  "md:col-span-6 lg:col-span-5",
  "md:col-span-5 md:col-start-8 md:mt-32 lg:col-span-4 lg:col-start-8",
  "md:col-span-5 lg:col-span-4 lg:col-start-2",
  "md:col-span-6 md:col-start-7 md:mt-16 lg:col-span-5 lg:col-start-7",
];

export const metadata = pageMetadata(salon, {
  title: t.gallery.title,
  description: `Klipp, farge, balayage og bryn fra ${salon.name} på ${salon.contact.address.area}.`,
  path: "/galleri",
});

export default function GalleryPage() {
  return (
    <>
      <PageHeader label={t.nav.gallery} title={t.gallery.title} lead={t.gallery.lead} />
      <section className="page-x border-t border-line pb-24 pt-12 md:pt-16" aria-label={t.gallery.title}>
        <ul className="page-grid mx-auto max-w-page items-start gap-y-12 md:gap-y-20">
          {salon.gallery.map((item, i) => (
            <li key={item.id} className={cx("reveal col-span-12", LAYOUT[i % LAYOUT.length])}>
              <figure>
                <ImageSlot image={item} aspect={item.aspect} sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw" />
                <figcaption className="mt-3 flex gap-3 text-small">
                  <span className="label tabular pt-0.5 text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {item.caption}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
