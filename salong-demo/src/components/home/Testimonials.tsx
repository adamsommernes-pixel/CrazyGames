import { salon } from "@config";
import { t } from "@/i18n";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";

export function Testimonials() {
  const [lead, ...rest] = salon.testimonials;
  if (!lead) return null;
  return (
    <Section tone="ink" className="page-x py-24 md:py-32" aria-labelledby="kunder">
      <div className="page-grid mx-auto max-w-page gap-y-14">
        <div className="col-span-12">
          <SectionHead number="05" label={t.home.testimonialsHeading} inverse />
          <h2 id="kunder" className="sr-only">
            {t.home.testimonialsHeading}
          </h2>
        </div>
        <figure className="reveal col-span-12 lg:col-span-7">
          <blockquote className="font-display text-d3 italic leading-[1.15] lg:-indent-[0.42em]">
            «{lead.quote}»
          </blockquote>
          <figcaption className="mt-8 flex items-center gap-4">
            <span aria-hidden="true" className="h-px w-10 bg-stone/60" />
            <span>
              {lead.name}
              <span className="label ml-3 text-stone">{lead.detail}</span>
            </span>
          </figcaption>
        </figure>
        <div className="col-span-12 lg:col-span-4 lg:col-start-9">
          {rest.map((q) => (
            <figure key={q.name} className="reveal border-t border-paper/20 py-6 first:pt-6 lg:first:border-t-0 lg:first:pt-2">
              <blockquote className="text-body">«{q.quote}»</blockquote>
              <figcaption className="mt-3 text-small">
                {q.name}
                <span className="label ml-3 text-stone">{q.detail}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}
