"use client";

import { t } from "@/i18n";
import type { ClockTime, TimeRange } from "@/lib/types";

const input = "min-h-11 w-[7.5rem] rounded-ctl border border-line-strong bg-paper px-3 text-body hover:border-ink";

/** From/to time inputs for one range, 15-minute steps, 24-hour clock. */
export function RangeInputs({
  range,
  onChange,
  label,
}: {
  range: TimeRange;
  onChange: (range: TimeRange) => void;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="time"
        step={900}
        value={range.start}
        onChange={(e) => e.target.value && onChange({ ...range, start: e.target.value as ClockTime })}
        aria-label={`${label}, ${t.admin.from.toLowerCase()}`}
        className={input}
      />
      <span aria-hidden="true">–</span>
      <input
        type="time"
        step={900}
        value={range.end}
        onChange={(e) => e.target.value && onChange({ ...range, end: e.target.value as ClockTime })}
        aria-label={`${label}, ${t.admin.to.toLowerCase()}`}
        className={input}
      />
    </span>
  );
}

export const isValidRange = (r: TimeRange) => r.start < r.end;
