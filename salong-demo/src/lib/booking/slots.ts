/**
 * Pure availability logic. No storage, no clock: everything comes in through
 * `AvailabilityInput`, so it is deterministic and unit-tested.
 */
import { t } from "@/i18n";
import type { Booking, BookingRules, Closure, LocalDate, OpeningHours, Service, StaffMember } from "@/lib/types";
import { holidayOn } from "@/lib/time/holidays";
import { addDays, diffDays, formatClock, parseClock, toZoned, todayLocal, weekdayOf, zonedToUtc } from "@/lib/time/zoned";

const MINUTE = 60_000;

export interface Interval {
  /** Epoch ms, inclusive. */
  start: number;
  /** Epoch ms, exclusive. */
  end: number;
}

export interface AvailabilityInput {
  timeZone: string;
  rules: BookingRules;
  openingHours: OpeningHours;
  staff: StaffMember[];
  services: Service[];
  bookings: Booking[];
  /** Temporary closures. Defaults to `rules.closedDates` as whole-day salon closures. */
  closures?: Closure[];
  /** Current instant, epoch ms. */
  now: number;
}

export interface SlotQuery {
  date: LocalDate;
  serviceIds: string[];
  /** `null` means "Ingen preferanse". */
  staffId: string | null;
  /** Admin override: allow bookings inside the minimum-notice window and beyond the horizon. */
  ignoreNoticeAndHorizon?: boolean;
  /** Ignore this booking when checking conflicts (used when moving a booking). */
  excludeBookingId?: string;
}

export interface Slot {
  /** UTC ISO instant. */
  start: string;
  end: string;
  /** Local "HH:MM" label in the salon's timezone. */
  label: string;
  /** Staff members free for the whole slot, in config order. */
  staffIds: string[];
}

export type DayStatus =
  | { kind: "open"; slots: number }
  | { kind: "full" }
  | { kind: "closed"; reason: string }
  | { kind: "outside" };

/** Two intervals overlap if they share any time, or are closer than `bufferMs`. */
export function overlaps(a: Interval, b: Interval, bufferMs = 0): boolean {
  return a.start < b.end + bufferMs && b.start < a.end + bufferMs;
}

export function bookingInterval(b: Pick<Booking, "start" | "end">): Interval {
  return { start: Date.parse(b.start), end: Date.parse(b.end) };
}

/** Total duration of the selected services, in minutes. Unknown ids are ignored. */
export function totalDurationMin(services: Service[], serviceIds: string[]): number {
  return serviceIds.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.durationMin ?? 0), 0);
}

export function totalPriceNok(services: Service[], serviceIds: string[]): number {
  return serviceIds.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.priceNok ?? 0), 0);
}

/** Staff members who perform every one of the selected services. */
export function qualifiedStaff(staff: StaffMember[], serviceIds: string[]): StaffMember[] {
  if (serviceIds.length === 0) return [];
  return staff.filter((m) => serviceIds.every((id) => m.serviceIds.includes(id)));
}

type ClosureInput = Pick<AvailabilityInput, "rules" | "openingHours" | "closures">;

export function closuresOf(input: Pick<AvailabilityInput, "rules" | "closures">): Closure[] {
  return input.closures ?? input.rules.closedDates.map((d) => ({ id: `config-${d.date}`, date: d.date, reason: d.reason }));
}

export const isWholeDay = (c: Pick<Closure, "start" | "end">) => !c.start || !c.end;

/** Why the whole salon is closed on `date`, or null if it is open. */
export function closureReason(date: LocalDate, input: ClosureInput): string | null {
  const closed = closuresOf(input).find((c) => c.date === date && !c.staffId && isWholeDay(c));
  if (closed) return closed.reason;
  if (input.rules.closeOnPublicHolidays) {
    const holiday = holidayOn(date);
    if (holiday) return holiday.name;
  }
  if (!input.openingHours[weekdayOf(date)]) return t.common.closed;
  return null;
}

/** Time on `date` when a staff member is unavailable because of a closure or absence. */
export function closedIntervals(date: LocalDate, staffId: string, input: AvailabilityInput): Interval[] {
  return closuresOf(input)
    .filter((c) => c.date === date && (!c.staffId || c.staffId === staffId))
    .map((c) =>
      isWholeDay(c)
        ? { start: zonedToUtc(date, 0, input.timeZone), end: zonedToUtc(addDays(date, 1), 0, input.timeZone) }
        : { start: zonedToUtc(date, parseClock(c.start!), input.timeZone), end: zonedToUtc(date, parseClock(c.end!), input.timeZone) },
    );
}

/**
 * The instants a staff member can take customers on `date`: their schedule
 * intersected with the salon's opening hours for that weekday.
 */
export function workingIntervals(
  date: LocalDate,
  member: StaffMember,
  openingHours: OpeningHours,
  timeZone: string,
): Interval[] {
  const weekday = weekdayOf(date);
  const open = openingHours[weekday];
  if (!open) return [];
  const openStart = parseClock(open.start);
  const openEnd = parseClock(open.end);
  const result: Interval[] = [];
  for (const range of member.schedule[weekday] ?? []) {
    const start = Math.max(openStart, parseClock(range.start));
    const end = Math.min(openEnd, parseClock(range.end));
    if (end > start) {
      result.push({ start: zonedToUtc(date, start, timeZone), end: zonedToUtc(date, end, timeZone) });
    }
  }
  return result;
}

function isBookable(date: LocalDate, input: AvailabilityInput, query: SlotQuery): boolean {
  if (query.ignoreNoticeAndHorizon) return true;
  const offset = diffDays(todayLocal(input.now, input.timeZone), date);
  return offset >= 0 && offset <= input.rules.horizonDays;
}

function confirmedBookingsFor(input: AvailabilityInput, staffId: string, excludeId?: string): Interval[] {
  return input.bookings
    .filter((b) => b.staffId === staffId && b.status === "confirmed" && b.id !== excludeId)
    .map(bookingInterval);
}

/**
 * Every bookable start time on `date` for the selected services.
 * Starts sit on a `slotStepMin` grid in local wall-clock time; each slot must
 * end before the staff member's working interval ends (and so before closing),
 * respect the buffer around existing bookings, and the minimum notice.
 */
export function generateSlots(input: AvailabilityInput, query: SlotQuery): Slot[] {
  const { rules, timeZone } = input;
  const durationMin = totalDurationMin(input.services, query.serviceIds);
  if (durationMin <= 0) return [];
  if (closureReason(query.date, input)) return [];
  if (!isBookable(query.date, input, query)) return [];

  const candidates = qualifiedStaff(input.staff, query.serviceIds).filter(
    (m) => query.staffId === null || m.id === query.staffId,
  );
  const earliest = query.ignoreNoticeAndHorizon ? -Infinity : input.now + rules.minNoticeMin * MINUTE;
  const duration = durationMin * MINUTE;
  const step = rules.slotStepMin * MINUTE;
  const buffer = rules.bufferMin * MINUTE;

  const byStart = new Map<number, string[]>();
  for (const member of candidates) {
    const busy = confirmedBookingsFor(input, member.id, query.excludeBookingId);
    // Closures block their own time only; the buffer is between appointments.
    const closed = closedIntervals(query.date, member.id, input);
    for (const window of workingIntervals(query.date, member, input.openingHours, timeZone)) {
      const localStart = toZoned(window.start, timeZone).minutes;
      const align = (rules.slotStepMin - (localStart % rules.slotStepMin)) % rules.slotStepMin;
      for (let t = window.start + align * MINUTE; t + duration <= window.end; t += step) {
        if (t < earliest) continue;
        const slot = { start: t, end: t + duration };
        if (busy.some((b) => overlaps(slot, b, buffer))) continue;
        if (closed.some((c) => overlaps(slot, c))) continue;
        const list = byStart.get(t) ?? [];
        list.push(member.id);
        byStart.set(t, list);
      }
    }
  }

  const order = new Map(input.staff.map((m, i) => [m.id, i]));
  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, staffIds]) => ({
      start: new Date(t).toISOString(),
      end: new Date(t + duration).toISOString(),
      label: formatClock(toZoned(t, timeZone).minutes),
      staffIds: staffIds.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
    }));
}

/**
 * Pick a staff member for a "no preference" booking: whoever has the fewest
 * booked minutes that day, so work is spread evenly. Ties go to config order.
 */
export function assignStaff(input: AvailabilityInput, slot: Slot): string {
  const date = toZoned(Date.parse(slot.start), input.timeZone).date;
  const load = (staffId: string) =>
    input.bookings
      .filter(
        (b) =>
          b.staffId === staffId &&
          b.status === "confirmed" &&
          toZoned(Date.parse(b.start), input.timeZone).date === date,
      )
      .reduce((sum, b) => sum + (Date.parse(b.end) - Date.parse(b.start)), 0);
  const [first, ...rest] = slot.staffIds;
  if (!first) throw new Error("Slot has no free staff");
  return rest.reduce((best, id) => (load(id) < load(best) ? id : best), first);
}

/** Status for each date in a range, for the date picker. */
export function dayStatus(input: AvailabilityInput, query: Omit<SlotQuery, "date">, date: LocalDate): DayStatus {
  const offset = diffDays(todayLocal(input.now, input.timeZone), date);
  if (!query.ignoreNoticeAndHorizon && (offset < 0 || offset > input.rules.horizonDays)) {
    return { kind: "outside" };
  }
  const reason = closureReason(date, input);
  if (reason) return { kind: "closed", reason };
  const slots = generateSlots(input, { ...query, date }).length;
  return slots > 0 ? { kind: "open", slots } : { kind: "full" };
}

/** Find the slot that starts at `startIso`, if it is still available. */
export function findSlot(input: AvailabilityInput, query: SlotQuery, startIso: string): Slot | undefined {
  const t = Date.parse(startIso);
  return generateSlots(input, query).find((s) => Date.parse(s.start) === t);
}
