/**
 * Norwegian public holidays (helligdager). Computed, so they never need to be
 * maintained by hand. Christmas Eve and New Year's Eve are not public holidays;
 * salons that close those days list them in `booking.closedDates` in the config.
 */
import type { LocalDate } from "@/lib/types";
import { addDays, formatLocalDate } from "./zoned";

export interface Holiday {
  date: LocalDate;
  name: string;
}

/** Easter Sunday, Gregorian calendar (Anonymous Gregorian algorithm). */
export function easterSunday(year: number): LocalDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatLocalDate(year, month, day);
}

const cache = new Map<number, Holiday[]>();

export function norwegianHolidays(year: number): Holiday[] {
  const cached = cache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: formatLocalDate(year, 1, 1), name: "Første nyttårsdag" },
    { date: addDays(easter, -3), name: "Skjærtorsdag" },
    { date: addDays(easter, -2), name: "Langfredag" },
    { date: easter, name: "Første påskedag" },
    { date: addDays(easter, 1), name: "Andre påskedag" },
    { date: formatLocalDate(year, 5, 1), name: "Arbeidernes dag" },
    { date: formatLocalDate(year, 5, 17), name: "Grunnlovsdag" },
    { date: addDays(easter, 39), name: "Kristi himmelfartsdag" },
    { date: addDays(easter, 49), name: "Første pinsedag" },
    { date: addDays(easter, 50), name: "Andre pinsedag" },
    { date: formatLocalDate(year, 12, 25), name: "Første juledag" },
    { date: formatLocalDate(year, 12, 26), name: "Andre juledag" },
  ].sort((x, y) => x.date.localeCompare(y.date));
  cache.set(year, list);
  return list;
}

export function holidayOn(date: LocalDate): Holiday | undefined {
  const year = Number(date.slice(0, 4));
  return norwegianHolidays(year).find((h) => h.date === date);
}
