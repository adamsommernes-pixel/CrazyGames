import { salon } from "@config";
import { t } from "@/i18n";
import { ArrowLink } from "@/components/ui/Button";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { SectionHead } from "@/components/ui/SectionHead";

export function GalleryStrip() {
  const items = salon.gallery.slice(0, 6);
  return (
    <section className="border-t border-line py-20 md:py-28">
      <div className="page-x">
        <div className="mx-auto flex max-w-page flex-wrap items-end justify-between gap-6">
          <div>
            <SectionHead number="04" label="Galleri" />
            <h2 className="mt-6 text-d2">{t.home.galleryHeading}</h2>
          </div>
          <ArrowLink href="/galleri">{t.home.seeGallery}</ArrowLink>
        </div>
      </div>
      <div
        role="region"
        aria-label={t.home.galleryHeading}
        tabIndex={0}
        className="mt-12 overflow-x-auto pb-4 [scrollbar-width:thin]"
      >
        <ul className="page-x flex w-max snap-x gap-4 md:gap-6">
          {items.map((item, i) => (
            <li key={item.id} className="snap-start">
              <figure>
                <ImageSlot
                  image={item}
                  aspect={item.aspect}
                  sizes="(min-width: 768px) 30vw, 70vw"
                  className={i % 3 === 1 ? "h-64 md:h-[22rem]" : "h-80 md:h-[28rem]"}
                />
                <figcaption className="mt-3 flex w-0 min-w-full gap-3 text-small">
                  <span className="label tabular pt-0.5 text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {item.caption}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
