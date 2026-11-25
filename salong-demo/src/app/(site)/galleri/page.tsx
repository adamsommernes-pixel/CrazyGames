import { salon } from "@config";
import { t } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { PageHeader } from "@/components/site/PageHeader";

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
        <ul className="mx-auto max-w-page columns-1 gap-6 sm:columns-2 lg:columns-3 lg:gap-8">
          {salon.gallery.map((item, i) => (
            <li key={item.id} className="reveal mb-10 break-inside-avoid">
              <figure>
                <ImageSlot image={item} aspect={item.aspect} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" />
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
