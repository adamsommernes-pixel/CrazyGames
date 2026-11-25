import { salon } from "@config";
import { t } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/site/PageHeader";
import { PriceList } from "@/components/site/PriceList";

export const metadata = pageMetadata(salon, {
  title: t.services.title,
  description: `Priser og varighet for klipp, farge, balayage, styling, bryn og vipper hos ${salon.name}. Bestill time direkte fra prislisten.`,
  path: "/tjenester",
});

export default function ServicesPage() {
  return (
    <>
      <PageHeader label={t.nav.servicesShort} title={t.services.title} lead={t.services.lead}>
        <nav aria-label={t.common.categories} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {salon.categories.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="inline-flex min-h-11 items-center rounded-ctl border border-line-strong px-4 text-small transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      {salon.categories.map((category, i) => (
        <Section
          key={category.id}
          id={category.id}
          tone={i % 2 === 0 ? "stone" : "plain"}
          className="page-x scroll-mt-4 py-16 md:py-24"
          aria-labelledby={`${category.id}-heading`}
        >
          <div className="page-grid mx-auto max-w-page gap-y-8">
            <div className="col-span-12 md:col-span-4">
              <p className="label tabular text-muted">{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`${category.id}-heading`} className="mt-3 text-d2">
                {category.name}
              </h2>
              <p className="mt-4 max-w-xs text-muted">{category.description}</p>
            </div>
            <div className="col-span-12 md:col-span-8 lg:col-span-7 lg:col-start-6">
              <PriceList categoryId={category.id} />
            </div>
          </div>
        </Section>
      ))}

      <section className="page-x border-t border-line py-16 md:py-20">
        <div className="page-grid mx-auto max-w-page gap-y-8">
          <p className="col-span-12 max-w-measure text-small text-muted md:col-span-6">{t.services.fromNote}</p>
          <div className="col-span-12 md:col-span-4 md:col-start-9 md:justify-self-end">
            <ButtonLink href="/bestill" size="lg" arrow>
              {t.nav.book}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
