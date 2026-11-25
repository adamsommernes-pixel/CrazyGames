"use client";

import { t } from "@/i18n";
import { isWholeDay } from "@/lib/booking/slots";
import { formatLocalDateLong } from "@/lib/format";
import { useLiveCatalog, useToday } from "@/lib/repository/live";
import { diffDays } from "@/lib/time/zoned";
import { cx } from "@/components/ui/cx";

/** Salon-wide closures in the coming weeks, as set in the admin. Staff absences stay private. */
export function UpcomingClosures({ className }: { className?: string }) {
  const { closures, rules } = useLiveCatalog();
  const today = useToday();
  if (!today) return null;
  const upcoming = closures.filter((c) => {
    const days = diffDays(today, c.date);
    return !c.staffId && days >= 0 && days <= rules.horizonDays;
  });
  if (upcoming.length === 0) return null;
  return (
    <section aria-labelledby="deviations" className={cx("border-l-2 border-accent pl-4", className)}>
      <h3 id="deviations" className="label text-muted">{t.about.deviations}</h3>
      <ul className="mt-3 grid gap-2 text-small">
        {upcoming.map((c) => (
          <li key={c.id}>
            <span className="font-medium">{formatLocalDateLong(c.date)}</span>:{" "}
            {isWholeDay(c) ? t.about.closedAllDay : t.about.closedBetween(c.start!, c.end!)}
            <span className="text-muted"> ({c.reason})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
