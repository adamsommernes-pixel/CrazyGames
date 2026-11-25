"use client";

import { t } from "@/i18n";
import { formatRange, weekdayName } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import { useLiveCatalog, useToday } from "@/lib/repository/live";
import { weekdayOf } from "@/lib/time/zoned";
import { cx } from "@/components/ui/cx";

/** Opening hours per weekday, with today marked in text (not only by colour). */
export function OpeningHoursTable({ className, inverse }: { className?: string; inverse?: boolean }) {
  const { openingHours } = useLiveCatalog();
  const today = useToday();
  const todayWeekday = today ? weekdayOf(today) : null;

  return (
    <table className={cx("w-full border-collapse text-body", className)}>
      <caption className="sr-only">{t.common.openingHours}</caption>
      <tbody>
        {WEEKDAYS.map((day) => {
          const range = openingHours[day];
          const isToday = day === todayWeekday;
          return (
            <tr
              key={day}
              className={cx("border-b", inverse ? "border-paper/20" : "border-line", isToday && "font-medium")}
            >
              <th scope="row" className="py-2.5 pr-4 text-left font-[inherit] capitalize [font-weight:inherit]">
                {weekdayName(day)}
                {isToday && (
                  <span className={cx("label ml-3 align-middle", inverse ? "text-stone" : "text-accent")}>
                    {t.common.today}
                  </span>
                )}
              </th>
              <td className={cx("tabular py-2.5 text-right", !range && (inverse ? "text-stone" : "text-muted"))}>
                {range ? formatRange(range) : t.common.closed}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
