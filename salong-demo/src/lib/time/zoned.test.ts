import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  formatClock,
  offsetMinutes,
  parseClock,
  startOfWeek,
  toZoned,
  weekdayOf,
  zonedToUtc,
} from "./zoned";
import { easterSunday, holidayOn, norwegianHolidays } from "./holidays";

const TZ = "Europe/Oslo";

describe("zonedToUtc / toZoned", () => {
  it("converts winter time (UTC+1)", () => {
    const t = zonedToUtc("2026-11-25", 9 * 60, TZ);
    expect(new Date(t).toISOString()).toBe("2026-11-25T08:00:00.000Z");
    expect(toZoned(t, TZ)).toEqual({ date: "2026-11-25", minutes: 540 });
  });

  it("converts summer time (UTC+2)", () => {
    const t = zonedToUtc("2026-06-15", 9 * 60, TZ);
    expect(new Date(t).toISOString()).toBe("2026-06-15T07:00:00.000Z");
  });

  it("handles the spring-forward gap (29 March 2026, 02:00 → 03:00)", () => {
    expect(new Date(zonedToUtc("2026-03-29", 60, TZ)).toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(new Date(zonedToUtc("2026-03-29", 180, TZ)).toISOString()).toBe("2026-03-29T01:00:00.000Z");
    // 02:30 does not exist; it resolves to 03:30 CEST.
    expect(new Date(zonedToUtc("2026-03-29", 150, TZ)).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("handles the fall-back overlap (25 October 2026, 03:00 → 02:00)", () => {
    // 02:30 happens twice; we pick the first (CEST) occurrence.
    expect(new Date(zonedToUtc("2026-10-25", 150, TZ)).toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(new Date(zonedToUtc("2026-10-25", 240, TZ)).toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("reports offsets", () => {
    expect(offsetMinutes(Date.parse("2026-01-10T12:00:00Z"), TZ)).toBe(60);
    expect(offsetMinutes(Date.parse("2026-07-10T12:00:00Z"), TZ)).toBe(120);
  });
});

describe("calendar helpers", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(diffDays("2026-11-25", "2027-01-24")).toBe(60);
  });

  it("knows ISO weekdays", () => {
    expect(weekdayOf("2026-11-25")).toBe(3); // Wednesday
    expect(weekdayOf("2026-11-29")).toBe(7); // Sunday
    expect(startOfWeek("2026-11-29")).toBe("2026-11-23");
  });

  it("parses and formats clock times", () => {
    expect(parseClock("09:30")).toBe(570);
    expect(formatClock(570)).toBe("09:30");
    expect(formatClock(1200)).toBe("20:00");
  });
});

describe("Norwegian public holidays", () => {
  it("computes Easter", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("lists the twelve helligdager", () => {
    const days = norwegianHolidays(2027).map((h) => h.date);
    expect(days).toHaveLength(12);
    expect(days).toContain("2027-03-25"); // Skjærtorsdag
    expect(days).toContain("2027-05-06"); // Kristi himmelfart
    expect(days).toContain("2027-05-17");
    expect(holidayOn("2026-12-25")?.name).toBe("Første juledag");
    expect(holidayOn("2026-12-24")).toBeUndefined();
  });
});
