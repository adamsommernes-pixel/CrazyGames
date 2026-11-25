import { t } from "@/i18n";
import { ArrowLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { PriceList } from "@/components/site/PriceList";

export function Popular() {
  return (
    <Section tone="stone" className="page-x py-20 md:py-28">
      <div className="page-grid mx-auto max-w-page gap-y-10">
        <div className="col-span-12 lg:col-span-4">
          <div className="lg:sticky lg:top-10">
            <SectionHead number="02" label="Priser" />
            <h2 className="mt-6 text-d2">{t.home.popularHeading}</h2>
            <p className="mt-5 max-w-xs text-muted">Alle priser inkluderer mva. Klipp inkluderer vask og føn.</p>
            <ArrowLink href="/tjenester" className="mt-8">
              {t.home.allServices}
            </ArrowLink>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-7 lg:col-start-6">
          <PriceList popularOnly />
        </div>
      </div>
    </Section>
  );
}
