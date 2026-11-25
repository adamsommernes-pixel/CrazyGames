/**
 * Small, dependency-free helpers for working with wall-clock times in a
 * named IANA timezone (Europe/Oslo). All instants are epoch milliseconds or
 * Date objects in UTC; all "local" values are calendar dates and minutes of
 * day in the given zone. DST is handled through Intl, never hard-coded.
 */
import type { ClockTime, LocalDate, Weekday } from "@/lib/types";

const MINUTE = 60_000;
const DAY = 86_400_000;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(instant: number, timeZone: string): WallClock {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(new Date(instant))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour!,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Offset of the zone from UTC at the given instant, in minutes (Oslo: 60 or 120). */
export function offsetMinutes(instant: number, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const truncated = instant - (((instant % 1000) + 1000) % 1000);
  return Math.round((asUtc - truncated) / MINUTE);
}

export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "09:30" → 570 */
export function parseClock(time: ClockTime | string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) throw new Error(`Invalid clock time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 570 → "09:30" */
export function formatClock(minutes: number): ClockTime {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as ClockTime;
}

/**
 * Convert a local date + minutes after local midnight to a UTC instant.
 * Times inside a spring-forward gap resolve to the instant just after the gap;
 * ambiguous fall-back times resolve to the first (summer-time) occurrence.
 */
export function zonedToUtc(date: LocalDate, minutesOfDay: number, timeZone: string): number {
  const { year, month, day } = parseLocalDate(date);
  const naive = Date.UTC(year, month - 1, day) + minutesOfDay * MINUTE;
  // Any DST transition near this wall time is covered by the offsets 12 hours either side.
  const before = offsetMinutes(naive - DAY / 2, timeZone);
  const after = offsetMinutes(naive + DAY / 2, timeZone);
  const matches = [...new Set([before, after])]
    .map((offset) => naive - offset * MINUTE)
    .filter((t) => {
      const z = toZoned(t, timeZone);
      return z.date === date && z.minutes === minutesOfDay;
    });
  if (matches.length > 0) return Math.min(...matches);
  // Non-existent local time (spring-forward gap): shift forward by the gap.
  return naive - before * MINUTE;
}

/** Local calendar date and minute-of-day for a UTC instant. */
export function toZoned(instant: number, timeZone: string): { date: LocalDate; minutes: number } {
  const w = wallClock(instant, timeZone);
  return { date: formatLocalDate(w.year, w.month, w.day), minutes: w.hour * 60 + w.minute };
}

export function todayLocal(now: number, timeZone: string): LocalDate {
  return toZoned(now, timeZone).date;
}

/** Calendar arithmetic on local dates (no timezone involved). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function diffDays(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY);
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: LocalDate): Weekday {
  const { year, month, day } = parseLocalDate(date);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (js === 0 ? 7 : js) as Weekday;
}

/** Monday of the ISO week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - weekdayOf(date));
}

export function startOfMonth(date: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(date);
  return formatLocalDate(year, month, 1);
}

export function daysInMonth(date: LocalDate): number {
  const { year, month } = parseLocalDate(date);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const { year, month } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1 + months, 1));
  return formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}
