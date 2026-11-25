import Link from "next/link";
import { salon } from "@config";
import { t } from "@/i18n";
import { ArrowLink } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { SectionHead } from "@/components/ui/SectionHead";

export function TeamTeaser() {
  return (
    <section className="py-24 md:py-32">
      <div className="page-x">
        <div className="page-grid mx-auto max-w-page gap-y-6">
          <SectionHead number="03" label="Teamet" className="col-span-12" />
          <h2 className="col-span-12 text-d2 lg:col-span-6">{t.home.teamHeading}</h2>
          <div className="col-span-12 self-end lg:col-span-4 lg:col-start-9">
            <p className="text-muted">{t.home.teamLead}</p>
            <ArrowLink href="/team" className="mt-5">
              {t.home.meetTeam}
            </ArrowLink>
          </div>
        </div>
      </div>
      <ul
        className="page-x mx-auto mt-14 flex max-w-page snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-5 md:gap-6 md:overflow-visible md:pb-0"
        aria-label="Teamet"
      >
        {salon.staff.map((m, i) => (
          <li key={m.id} className={cx("w-[62vw] max-w-64 shrink-0 snap-start md:w-auto md:max-w-none", i % 2 === 1 && "md:mt-20")}>
            <Link href={`/team#${m.id}`} className="group block">
              <ImageSlot
                image={m.image ?? { alt: m.name, label: m.name }}
                aspect="3/4"
                sizes="(min-width: 768px) 18vw, 62vw"
                className="transition-opacity duration-300 group-hover:opacity-90"
              />
              <p className="mt-4 font-display text-d4 leading-tight group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                {m.name}
              </p>
              <p className="label mt-1.5 text-muted">{m.role}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
