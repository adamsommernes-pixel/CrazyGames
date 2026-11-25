"use client";

import Link from "next/link";
import { t } from "@/i18n";
import { useLiveCatalog } from "@/lib/repository/live";
import { cx } from "@/components/ui/cx";
import { ImageSlot } from "@/components/ui/ImageSlot";

/** Staggered portraits on the home page; live, so staff changes in the admin show up. */
export function TeamStrip() {
  const { staff } = useLiveCatalog();
  return (
  <ul
      className="page-x scroll-px-[clamp(1.125rem,0.6rem+2.4vw,3rem)] mx-auto mt-14 flex max-w-page snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-5 md:gap-6 md:overflow-visible md:pb-0"
      aria-label={t.home.teamLabel}
    >
      {staff.map((m, i) => (
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
  );
}
