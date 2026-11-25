import { salon } from "@config";
import { t } from "@/i18n";
import { weekdayShort } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import { pageMetadata } from "@/lib/seo";
import { ArrowLink } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { PageHeader } from "@/components/site/PageHeader";

export const metadata = pageMetadata(salon, {
  title: t.team.title,
  description: `Møt frisørene og bryn- og vippeterapeuten hos ${salon.name}, og bestill time hos den du vil.`,
  path: "/team",
});

export default function TeamPage() {
  return (
    <>
      <PageHeader label={t.nav.team} title={t.team.title} lead={t.team.lead} />
      <ol className="border-t border-line">
        {salon.staff.map((member, i) => {
          const services = salon.services.filter((s) => s.active && member.serviceIds.includes(s.id));
          const days = WEEKDAYS.filter((d) => member.schedule[d].length > 0);
          const flip = i % 2 === 1;
          return (
            <li key={member.id} id={member.id} className="page-x scroll-mt-4 border-b border-line py-14 md:py-20">
              <article className="page-grid mx-auto max-w-page gap-y-8" aria-labelledby={`${member.id}-name`}>
                <div className={cx("col-span-8 sm:col-span-6", flip ? "md:col-span-3 md:col-start-10 md:row-start-1 md:mt-24" : "md:col-span-4")}>
                  <ImageSlot
                    image={member.image ?? { alt: member.name, label: member.name }}
                    aspect="4/5"
                    sizes="(min-width: 768px) 30vw, 66vw"
                  />
                </div>
                <div className={cx("col-span-12 md:col-span-7 md:row-start-1", flip ? "md:col-start-1" : "md:col-start-6")}>
                  <p className="label tabular text-muted">{String(i + 1).padStart(2, "0")} · {member.role}</p>
                  <h2 id={`${member.id}-name`} className="mt-4 text-d2">
                    {member.name}
                  </h2>
                  <p className="mt-6 max-w-measure text-lead">{member.bio}</p>
                  <dl className="mt-10 grid max-w-xl gap-6 border-t border-line pt-6 sm:grid-cols-[8rem_1fr]">
                    <dt className="label pt-1 text-muted">{t.team.does}</dt>
                    <dd>{services.map((s) => s.name).join(" · ")}</dd>
                    <dt className="label pt-1 text-muted">{t.team.works}</dt>
                    <dd className="capitalize">{days.map(weekdayShort).join(", ")}</dd>
                  </dl>
                  <ArrowLink href={`/bestill?frisor=${member.id}`} className="mt-10 text-lead">
                    {t.team.bookWith(member.name)}
                  </ArrowLink>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </>
  );
}
