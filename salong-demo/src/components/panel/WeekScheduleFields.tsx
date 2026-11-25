"use client";

import { t } from "@/i18n";
import { weekdayName } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import type { WeeklySchedule } from "@/lib/types";
import { cx } from "@/components/ui/cx";
import { isValidRange, RangeInputs } from "./RangeInputs";

/** One row per weekday with any number of from–to ranges (two ranges = lunch break). */
export function WeekScheduleFields({
  schedule,
  onChange,
  className,
}: {
  schedule: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
  className?: string;
}) {
  return (
      <ul className={cx("border-t border-line", className)}>
        {WEEKDAYS.map((day) => {
          const ranges = schedule[day];
          const setRanges = (next: typeof ranges) => onChange({ ...schedule, [day]: next });
          return (
            <li key={day} className="grid gap-3 border-b border-line py-4 sm:grid-cols-[7rem_1fr]">
              <span className="pt-2.5 font-medium capitalize">{weekdayName(day)}</span>
              <div className="grid gap-3">
                {ranges.length === 0 && <span className="pt-2.5 text-muted">{t.panel.dayOff}</span>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3">
                    <RangeInputs
                      label={`${weekdayName(day)} ${i + 1}`}
                      range={r}
                      onChange={(next) => setRanges(ranges.map((x, j) => (j === i ? next : x)))}
                    />
                    <button
                      type="button"
                      onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
                      className="link min-h-11 text-small"
                    >
                      {t.panel.removeRange}
                    </button>
                    {!isValidRange(r) && <span className="text-small text-accent">{t.panel.endAfterStart}</span>}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRanges([...ranges, ranges.length ? { start: "13:00", end: "17:00" } : { start: "09:00", end: "17:00" }])}
                  className="link min-h-11 w-fit text-small font-medium"
                >
                  + {t.panel.addRange}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
  );
}
