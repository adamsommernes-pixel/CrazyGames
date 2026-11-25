/**
 * Locale-aware formatting for nb-NO: 24-hour clock, NOK prices, Europe/Oslo.
 */
import { salon } from "@config";
import { t } from "@/i18n";
import type { LocalDate, TimeRange, Weekday } from "@/lib/types";
import { parseLocalDate } from "@/lib/time/zoned";

const { locale, timeZone } = salon;

const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDate = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" });
const longDateYear = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short" });
const monthYear = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" });
const dateOnlyLong = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const dateOnlyShort = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" });

/** 1290 → "1 290 kr", with "fra" when the price varies. */
export function formatPrice(nok: number, from = false): string {
  const value = `${number.format(nok)} kr`;
  return from ? `${t.common.from} ${value}` : value;
}

/** 45 → "45 min", 90 → "1 t 30 min", 120 → "2 t" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} ${t.common.minutes}`;
  if (m === 0) return `${h} ${t.common.hoursShort}`;
  return `${h} ${t.common.hoursShort} ${m} ${t.common.minutes}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Instant → "14:30" in Oslo time. */
export const formatTime = (iso: string) => time.format(new Date(iso));
/** Instant → "Torsdag 26. november" */
export const formatDateLong = (iso: string) => capitalize(longDate.format(new Date(iso)));
export const formatDateLongYear = (iso: string) => capitalize(longDateYear.format(new Date(iso)));
export const formatDateShort = (iso: string) => shortDate.format(new Date(iso));

const localToDate = (date: LocalDate) => {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day));
};
/** Local date → "Torsdag 26. november" */
export const formatLocalDateLong = (date: LocalDate) => capitalize(dateOnlyLong.format(localToDate(date)));
export const formatLocalDateShort = (date: LocalDate) => dateOnlyShort.format(localToDate(date));
export const formatMonthYear = (date: LocalDate) => capitalize(monthYear.format(localToDate(date)));

export const weekdayName = (d: Weekday) => t.weekdays[d - 1]!;
export const weekdayShort = (d: Weekday) => t.weekdaysShort[d - 1]!;

/** "09:00–18:00" */
export const formatRange = (r: TimeRange) => `${r.start}–${r.end}`;

/** "+4722351840" style href for tel: links. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
