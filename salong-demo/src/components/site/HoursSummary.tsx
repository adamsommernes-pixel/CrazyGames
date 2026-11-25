"use client";

import { t } from "@/i18n";
import { formatRange, weekdayShort } from "@/lib/format";
import { groupOpeningHours } from "@/lib/hours";
import { useLiveCatalog } from "@/lib/repository/live";

/** Compact opening hours, e.g. "tir–ons 09:00–19:00". */
export function HoursSummary({ className }: { className?: string }) {
  const { openingHours } = useLiveCatalog();
  return (
    <dl className={className}>
      {groupOpeningHours(openingHours).map((g) => (
        <div key={g.from} className="contents">
          <dt className="capitalize">
            {weekdayShort(g.from)}
            {g.to !== g.from && `–${weekdayShort(g.to)}`}
          </dt>
          <dd className={g.range ? "" : "opacity-75"}>{g.range ? formatRange(g.range) : t.common.closed}</dd>
        </div>
      ))}
    </dl>
  );
}
