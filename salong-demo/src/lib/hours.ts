import type { OpeningHours, TimeRange, Weekday } from "@/lib/types";

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export interface HoursGroup {
  from: Weekday;
  to: Weekday;
  range: TimeRange | null;
}

/** Collapse consecutive weekdays with identical hours: Tue–Wed 09:00–19:00. */
export function groupOpeningHours(hours: OpeningHours): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const day of WEEKDAYS) {
    const range = hours[day];
    const last = groups.at(-1);
    if (last && last.range?.start === range?.start && last.range?.end === range?.end) last.to = day;
    else groups.push({ from: day, to: day, range });
  }
  return groups;
}
