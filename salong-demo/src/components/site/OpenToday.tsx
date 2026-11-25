"use client";

import { t } from "@/i18n";
import { closureReason } from "@/lib/booking/slots";
import { formatRange, weekdayName } from "@/lib/format";
import { useLiveCatalog, useToday } from "@/lib/repository/live";
import { addDays, weekdayOf } from "@/lib/time/zoned";

/** "Åpent i dag 09:00–19:00" or the next opening day. Falls back to a neutral label on the server. */
export function OpenToday() {
  const { openingHours, closures, rules: bookingRules } = useLiveCatalog();
  const today = useToday();
  if (!today) return <span>{t.common.openingHours}</span>;

  const rules = { rules: bookingRules, openingHours, closures };
  const todayRange = openingHours[weekdayOf(today)];
  if (!closureReason(today, rules) && todayRange) {
    return <span>{t.home.openToday(formatRange(todayRange))}</span>;
  }
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i);
    const range = openingHours[weekdayOf(date)];
    if (!closureReason(date, rules) && range) {
      return <span>{t.home.closedToday(i === 1 ? t.home.tomorrowLower : weekdayName(weekdayOf(date)), range.start)}</span>;
    }
  }
  return <span>{t.common.closed}</span>;
}
