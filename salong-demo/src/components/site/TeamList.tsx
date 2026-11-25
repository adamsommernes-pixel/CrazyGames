"use client";

import { t } from "@/i18n";
import { useLiveCatalog } from "@/lib/repository/live";
import { ArrowLink } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { StaffFacts } from "./StaffFacts";

/** The team page list. Live, so staff added or removed in the admin show up. */
export function TeamList() {
  const { staff, services } = useLiveCatalog();
  return (
    <ol className="border-t border-line">
      {staff.map((member, i) => {
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
                <StaffFacts member={member} services={services} className="mt-10 grid max-w-xl gap-6 border-t border-line pt-6 sm:grid-cols-[8rem_1fr]" />
                <ArrowLink href={`/bestill?frisor=${member.id}`} className="mt-10 text-lead">
                  {t.team.bookWith(member.name)}
                </ArrowLink>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
