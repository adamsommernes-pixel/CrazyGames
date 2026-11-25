import type { Booking, BookingRules } from "@/lib/types";

const HOUR = 3_600_000;

/** Customers can cancel online until the appointment starts. */
export function canCustomerCancel(booking: Pick<Booking, "start" | "status">, now: number): boolean {
  return booking.status === "confirmed" && Date.parse(booking.start) > now;
}

/** Inside the salon's free-cancellation window, a fee may apply (see FAQ). */
export function isLateCancellation(booking: Pick<Booking, "start">, now: number, rules: BookingRules): boolean {
  return Date.parse(booking.start) - now < rules.cancellationHours * HOUR;
}
