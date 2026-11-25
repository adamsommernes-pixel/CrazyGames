import { salon } from "@config";
import { t } from "@/i18n";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { SectionHead } from "@/components/ui/SectionHead";

export function Intro() {
  const { intro, introImage, founded, staff, services } = salon;
  const [first, ...rest] = intro.body;
  const facts = [
    { value: String(founded), label: t.home.facts.founded },
    { value: String(staff.length), label: t.home.facts.staff },
    { value: String(services.filter((s) => s.active).length), label: t.home.facts.services },
  ];
  return (
    <section className="page-x py-24 md:py-32">
      <div className="page-grid mx-auto max-w-page">
        <SectionHead number="01" label={t.home.introLabel} className="col-span-12" />
        <h2 className="reveal col-span-12 mt-8 text-d2 md:col-span-10 lg:col-span-8">{intro.heading}</h2>

        <div className="reveal col-span-12 mt-12 md:col-span-6 md:mt-16 lg:col-span-6">
          <ImageSlot image={introImage} aspect="4/3" sizes="(min-width: 768px) 50vw, 100vw" />
        </div>

        <div className="reveal col-span-12 mt-10 md:col-span-5 md:col-start-8 md:mt-40 lg:col-span-4 lg:col-start-8">
          <p className="text-lead first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-display first-letter:text-[3.6em] first-letter:leading-[0.8] first-letter:text-accent">
            {first}
          </p>
          {rest.map((p) => (
            <p key={p} className="mt-5 text-muted">
              {p}
            </p>
          ))}
          <dl className="mt-10 grid grid-cols-3 border-t border-line pt-5">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="label text-muted">{f.label}</dt>
                <dd className="tabular mt-1 font-display text-d3">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
