import { describe, expect, it } from "vitest";
import type { Booking, BookingRules, OpeningHours, Service, StaffMember, WeeklySchedule } from "@/lib/types";
import { zonedToUtc } from "@/lib/time/zoned";
import {
  assignStaff,
  closureReason,
  dayStatus,
  generateSlots,
  overlaps,
  qualifiedStaff,
  totalDurationMin,
  type AvailabilityInput,
} from "./slots";

const TZ = "Europe/Oslo";
const nine = { start: "09:00", end: "17:00" } as const;

const allWeek = (range: { start: `${number}:${number}`; end: `${number}:${number}` } | null): OpeningHours => ({
  1: range, 2: range, 3: range, 4: range, 5: range, 6: range, 7: range,
});

const scheduleAll = (ranges: WeeklySchedule[1]): WeeklySchedule => ({
  1: ranges, 2: ranges, 3: ranges, 4: ranges, 5: ranges, 6: ranges, 7: ranges,
});

const services: Service[] = [
  { id: "klipp", categoryId: "c", name: "Klipp", description: "", durationMin: 60, priceNok: 900, active: true },
  { id: "toning", categoryId: "c", name: "Toning", description: "", durationMin: 45, priceNok: 700, active: true },
  { id: "bryn", categoryId: "c", name: "Bryn", description: "", durationMin: 20, priceNok: 300, active: true },
];

const staff: StaffMember[] = [
  { id: "anna", name: "Anna", role: "", bio: "", serviceIds: ["klipp", "toning"], schedule: scheduleAll([nine]) },
  { id: "bo", name: "Bo", role: "", bio: "", serviceIds: ["klipp"], schedule: scheduleAll([nine]) },
  { id: "cia", name: "Cia", role: "", bio: "", serviceIds: ["bryn"], schedule: scheduleAll([nine]) },
];

const rules: BookingRules = {
  slotStepMin: 15,
  bufferMin: 0,
  minNoticeMin: 120,
  horizonDays: 60,
  closeOnPublicHolidays: true,
  closedDates: [{ date: "2026-12-24", reason: "Julaften" }],
  cancellationHours: 24,
};

// Wednesday 25 November 2026, 07:00 local: well before opening.
const NOW = zonedToUtc("2026-11-25", 7 * 60, TZ);
const DAY = "2026-11-26"; // Thursday

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timeZone: TZ,
    rules,
    openingHours: allWeek(nine),
    staff,
    services,
    bookings: [],
    now: NOW,
    ...overrides,
  };
}

let seq = 0;
function booking(staffId: string, date: string, from: string, to: string, status: Booking["status"] = "confirmed"): Booking {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  seq += 1;
  return {
    id: `b${seq}`,
    reference: `REF${seq}`,
    serviceIds: ["klipp"],
    staffId,
    start: new Date(zonedToUtc(date, fh! * 60 + fm!, TZ)).toISOString(),
    end: new Date(zonedToUtc(date, th! * 60 + tm!, TZ)).toISOString(),
    customer: { name: "Test", phone: "+47 400 00 000", email: "t@example.no" },
    status,
    source: "online",
    createdAt: new Date(NOW).toISOString(),
  };
}

const labels = (slots: { label: string }[]) => slots.map((s) => s.label);

describe("overlaps", () => {
  it("treats touching intervals as free without a buffer", () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
  });
  it("treats touching intervals as a conflict with a buffer", () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 }, 1)).toBe(true);
  });
  it("detects containment and partial overlap", () => {
    expect(overlaps({ start: 0, end: 100 }, { start: 10, end: 20 })).toBe(true);
    expect(overlaps({ start: 15, end: 25 }, { start: 10, end: 20 })).toBe(true);
    expect(overlaps({ start: 30, end: 40 }, { start: 10, end: 20 }, 9)).toBe(false);
    expect(overlaps({ start: 30, end: 40 }, { start: 10, end: 20 }, 10)).toBe(false);
    expect(overlaps({ start: 30, end: 40 }, { start: 10, end: 20 }, 11)).toBe(true);
  });
});

describe("generateSlots", () => {
  it("never offers a slot that would run past closing time", () => {
    const slots = generateSlots(input(), { date: DAY, serviceIds: ["klipp"], staffId: "anna" });
    expect(slots[0]?.label).toBe("09:00");
    expect(slots.at(-1)?.label).toBe("16:00");
    expect(labels(slots)).not.toContain("16:15");
    for (const s of slots) {
      expect(Date.parse(s.end)).toBeLessThanOrEqual(zonedToUtc(DAY, 17 * 60, TZ));
    }
  });

  it("caps staff hours at the salon's opening hours", () => {
    const late = staff.map((m) => ({ ...m, schedule: scheduleAll([{ start: "08:00", end: "21:00" }]) }));
    const slots = generateSlots(input({ staff: late }), { date: DAY, serviceIds: ["klipp"], staffId: "anna" });
    expect(slots[0]?.label).toBe("09:00");
    expect(slots.at(-1)?.label).toBe("16:00");
  });

  it("sums durations when several services are booked together", () => {
    expect(totalDurationMin(services, ["klipp", "toning"])).toBe(105);
    const slots = generateSlots(input(), { date: DAY, serviceIds: ["klipp", "toning"], staffId: null });
    expect(slots.at(-1)?.label).toBe("15:15");
    expect(Date.parse(slots[0]!.end) - Date.parse(slots[0]!.start)).toBe(105 * 60_000);
    // Only Anna does both services.
    expect(new Set(slots.flatMap((s) => s.staffIds))).toEqual(new Set(["anna"]));
  });

  it("returns nothing when nobody performs all selected services", () => {
    expect(qualifiedStaff(staff, ["klipp", "bryn"])).toEqual([]);
    expect(generateSlots(input(), { date: DAY, serviceIds: ["klipp", "bryn"], staffId: null })).toEqual([]);
  });

  it("allows back-to-back bookings when the buffer is zero", () => {
    const bookings = [booking("anna", DAY, "10:00", "11:00")];
    const slots = labels(generateSlots(input({ bookings }), { date: DAY, serviceIds: ["klipp"], staffId: "anna" }));
    expect(slots).toContain("09:00"); // ends exactly at 10:00
    expect(slots).not.toContain("09:15");
    expect(slots).not.toContain("10:45");
    expect(slots).toContain("11:00"); // starts exactly at 11:00
  });

  it("keeps the configured buffer between appointments", () => {
    const bookings = [booking("anna", DAY, "10:00", "11:00")];
    const withBuffer = input({ bookings, rules: { ...rules, bufferMin: 10 } });
    const slots = labels(generateSlots(withBuffer, { date: DAY, serviceIds: ["klipp"], staffId: "anna" }));
    expect(slots).not.toContain("09:00"); // would end 10:00, inside the buffer
    expect(slots).not.toContain("11:00");
    expect(slots).toContain("11:15");
  });

  it("ignores cancelled bookings and other staff members' bookings", () => {
    const bookings = [booking("anna", DAY, "09:00", "17:00", "cancelled"), booking("bo", DAY, "09:00", "17:00")];
    const slots = generateSlots(input({ bookings }), { date: DAY, serviceIds: ["klipp"], staffId: "anna" });
    expect(slots).toHaveLength(29); // 09:00 … 16:00 every 15 min
  });

  it("with no preference, offers a slot if any qualifying staff member is free", () => {
    const bookings = [booking("anna", DAY, "09:00", "17:00")];
    const slots = generateSlots(input({ bookings }), { date: DAY, serviceIds: ["klipp"], staffId: null });
    expect(slots).toHaveLength(29);
    expect(slots.every((s) => s.staffIds.length === 1 && s.staffIds[0] === "bo")).toBe(true);
  });

  it("returns no slots on a day where all qualifying staff are booked", () => {
    const bookings = [booking("anna", DAY, "09:00", "17:00"), booking("bo", DAY, "09:00", "12:00"), booking("bo", DAY, "12:00", "17:00")];
    const i = input({ bookings });
    expect(generateSlots(i, { date: DAY, serviceIds: ["klipp"], staffId: null })).toEqual([]);
    expect(dayStatus(i, { serviceIds: ["klipp"], staffId: null }, DAY)).toEqual({ kind: "full" });
    // Cia does not do klipp, so her free day does not count, but bryn is still bookable.
    expect(dayStatus(i, { serviceIds: ["bryn"], staffId: null }, DAY).kind).toBe("open");
  });

  it("only offers gaps long enough for the service", () => {
    const bookings = [booking("anna", DAY, "09:00", "11:30"), booking("anna", DAY, "12:15", "17:00")];
    const slots = labels(generateSlots(input({ bookings }), { date: DAY, serviceIds: ["klipp"], staffId: "anna" }));
    expect(slots).toEqual([]); // 45 min gap, 60 min service
    const short = labels(generateSlots(input({ bookings }), { date: DAY, serviceIds: ["toning"], staffId: "anna" }));
    expect(short).toEqual(["11:30"]);
  });

  it("does not let a slot span a lunch break", () => {
    const lunch = staff.map((m) =>
      m.id === "anna" ? { ...m, schedule: scheduleAll([{ start: "09:00", end: "12:00" }, { start: "12:30", end: "17:00" }]) } : m,
    );
    const slots = labels(generateSlots(input({ staff: lunch }), { date: DAY, serviceIds: ["klipp"], staffId: "anna" }));
    expect(slots).toContain("11:00");
    expect(slots).not.toContain("11:15");
    expect(slots).not.toContain("12:15");
    expect(slots).toContain("12:30");
  });

  it("aligns starts to the slot grid even when a shift starts off-grid", () => {
    const odd = staff.map((m) => (m.id === "anna" ? { ...m, schedule: scheduleAll([{ start: "09:10", end: "17:00" }]) } : m));
    const slots = generateSlots(input({ staff: odd }), { date: DAY, serviceIds: ["klipp"], staffId: "anna" });
    expect(slots[0]?.label).toBe("09:15");
  });

  it("respects the minimum notice", () => {
    const now = zonedToUtc(DAY, 10 * 60 + 5, TZ); // 10:05
    const slots = generateSlots(input({ now }), { date: DAY, serviceIds: ["klipp"], staffId: "anna" });
    expect(slots[0]?.label).toBe("12:15");
  });

  it("respects the booking horizon and never offers past dates", () => {
    expect(generateSlots(input(), { date: "2027-01-24", serviceIds: ["klipp"], staffId: "anna" }).length).toBeGreaterThan(0);
    expect(generateSlots(input(), { date: "2027-01-25", serviceIds: ["klipp"], staffId: "anna" })).toEqual([]);
    expect(generateSlots(input(), { date: "2026-11-24", serviceIds: ["klipp"], staffId: "anna" })).toEqual([]);
    expect(dayStatus(input(), { serviceIds: ["klipp"], staffId: null }, "2027-01-25")).toEqual({ kind: "outside" });
  });

  it("lets the admin book inside the notice window and beyond the horizon", () => {
    const now = zonedToUtc(DAY, 10 * 60 + 5, TZ);
    const slots = generateSlots(input({ now }), { date: DAY, serviceIds: ["klipp"], staffId: "anna", ignoreNoticeAndHorizon: true });
    expect(slots[0]?.label).toBe("09:00");
  });

  it("skips weekly closed days, public holidays and configured closed dates", () => {
    const hours = { ...allWeek(nine), 7: null };
    const i = input({ openingHours: hours });
    expect(closureReason("2026-11-29", i)).toBe("Stengt");
    expect(closureReason("2026-12-24", i)).toBe("Julaften");
    expect(closureReason("2026-12-25", i)).toBe("Første juledag");
    expect(closureReason("2027-01-01", i)).toBe("Første nyttårsdag");
    expect(generateSlots(i, { date: "2026-12-25", serviceIds: ["klipp"], staffId: null })).toEqual([]);
    expect(dayStatus(i, { serviceIds: ["klipp"], staffId: null }, "2026-12-26")).toEqual({ kind: "closed", reason: "Andre juledag" });
  });

  it("can keep holidays open if the salon chooses", () => {
    const i = input({ rules: { ...rules, closeOnPublicHolidays: false } });
    expect(generateSlots(i, { date: "2026-12-25", serviceIds: ["klipp"], staffId: "anna" }).length).toBe(29);
  });
});

describe("DST change days", () => {
  const night = { start: "00:00", end: "06:00" } as const;
  const nightStaff = staff.map((m) => ({ ...m, schedule: scheduleAll([night]) }));
  const hourly = { ...rules, slotStepMin: 60, horizonDays: 400 };

  it("spring forward: the missing hour is never offered and slots last real time", () => {
    const i = input({ staff: nightStaff, openingHours: allWeek(night), rules: hourly, now: Date.parse("2026-03-01T00:00:00Z") });
    const slots = generateSlots(i, { date: "2026-03-29", serviceIds: ["klipp"], staffId: "anna" });
    expect(labels(slots)).toEqual(["00:00", "01:00", "03:00", "04:00", "05:00"]);
    for (const s of slots) expect(Date.parse(s.end) - Date.parse(s.start)).toBe(60 * 60_000);
    expect(slots.at(-1)?.end).toBe("2026-03-29T04:00:00.000Z"); // 06:00 CEST
  });

  it("fall back: the repeated hour is offered twice, as two different instants", () => {
    const i = input({ staff: nightStaff, openingHours: allWeek(night), rules: hourly, now: Date.parse("2026-10-01T00:00:00Z") });
    const slots = generateSlots(i, { date: "2026-10-25", serviceIds: ["klipp"], staffId: "anna" });
    expect(labels(slots)).toEqual(["00:00", "01:00", "02:00", "02:00", "03:00", "04:00", "05:00"]);
    expect(new Set(slots.map((s) => s.start)).size).toBe(7);
    expect(slots.at(-1)?.end).toBe("2026-10-25T05:00:00.000Z"); // 06:00 CET
  });

  it("normal opening hours on a DST Sunday map to the right UTC instants", () => {
    const i = input({ rules: { ...rules, horizonDays: 400 }, now: Date.parse("2026-03-01T00:00:00Z") });
    const spring = generateSlots(i, { date: "2026-03-29", serviceIds: ["klipp"], staffId: "anna" });
    expect(spring[0]?.start).toBe("2026-03-29T07:00:00.000Z"); // 09:00 CEST
    const j = input({ rules: { ...rules, horizonDays: 400 }, now: Date.parse("2026-10-01T00:00:00Z") });
    const autumn = generateSlots(j, { date: "2026-10-25", serviceIds: ["klipp"], staffId: "anna" });
    expect(autumn[0]?.start).toBe("2026-10-25T08:00:00.000Z"); // 09:00 CET
    expect(spring).toHaveLength(29);
    expect(autumn).toHaveLength(29);
  });

  it("a booking across the fall-back hour blocks the right real-time span", () => {
    const i = input({ staff: nightStaff, openingHours: allWeek(night), rules: hourly, now: Date.parse("2026-10-01T00:00:00Z") });
    const b: Booking = {
      ...booking("anna", "2026-10-25", "00:00", "01:00"),
      start: "2026-10-25T00:00:00.000Z", // first 02:00 (CEST)
      end: "2026-10-25T01:00:00.000Z", // second 02:00 (CET)
    };
    const slots = generateSlots({ ...i, bookings: [b] }, { date: "2026-10-25", serviceIds: ["klipp"], staffId: "anna" });
    expect(slots.map((s) => s.start)).not.toContain("2026-10-25T00:00:00.000Z");
    expect(slots.map((s) => s.start)).toContain("2026-10-25T01:00:00.000Z");
  });
});

describe("assignStaff", () => {
  it("assigns the free staff member with the least booked time that day", () => {
    const bookings = [booking("anna", DAY, "09:00", "10:00"), booking("anna", DAY, "13:00", "14:00"), booking("bo", DAY, "15:00", "16:00")];
    const i = input({ bookings });
    const slot = generateSlots(i, { date: DAY, serviceIds: ["klipp"], staffId: null }).find((s) => s.label === "11:00")!;
    expect(slot.staffIds).toEqual(["anna", "bo"]);
    expect(assignStaff(i, slot)).toBe("bo");
  });

  it("falls back to config order on a tie", () => {
    const i = input();
    const slot = generateSlots(i, { date: DAY, serviceIds: ["klipp"], staffId: null })[0]!;
    expect(assignStaff(i, slot)).toBe("anna");
  });
});

describe("temporary closures", () => {
  it("a whole-day salon closure closes the day", () => {
    const i = input({ closures: [{ id: "c1", date: DAY, reason: "Kurs" }] });
    expect(closureReason(DAY, i)).toBe("Kurs");
    expect(generateSlots(i, { date: DAY, serviceIds: ["klipp"], staffId: null })).toEqual([]);
    expect(dayStatus(i, { serviceIds: ["klipp"], staffId: null }, DAY)).toEqual({ kind: "closed", reason: "Kurs" });
  });

  it("a partial closure blocks only its own time, without the buffer", () => {
    const i = input({
      rules: { ...rules, bufferMin: 10 },
      closures: [{ id: "c1", date: DAY, start: "12:00", end: "14:00", reason: "Personalmøte" }],
    });
    expect(closureReason(DAY, i)).toBeNull();
    const slots = labels(generateSlots(i, { date: DAY, serviceIds: ["klipp"], staffId: "anna" }));
    expect(slots).toContain("11:00"); // ends exactly 12:00
    expect(slots).not.toContain("11:15");
    expect(slots).not.toContain("13:45");
    expect(slots).toContain("14:00");
  });

  it("a staff absence removes that person only", () => {
    const i = input({ closures: [{ id: "c1", date: DAY, staffId: "anna", reason: "Syk" }] });
    expect(closureReason(DAY, i)).toBeNull();
    expect(generateSlots(i, { date: DAY, serviceIds: ["klipp"], staffId: "anna" })).toEqual([]);
    const any = generateSlots(i, { date: DAY, serviceIds: ["klipp"], staffId: null });
    expect(any).toHaveLength(29);
    expect(any.every((s) => s.staffIds.join() === "bo")).toBe(true);
  });

  it("defaults to the config's closed dates when no closures are given", () => {
    expect(closureReason("2026-12-24", input())).toBe("Julaften");
    expect(closureReason("2026-12-24", input({ closures: [] }))).toBeNull();
  });
});
