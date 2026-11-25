import type { Slot } from "@/lib/booking/slots";
import type { LocalDate } from "@/lib/types";

export const STEPS = ["services", "staff", "date", "time", "details"] as const;
export type StepId = (typeof STEPS)[number];

export interface BookingDraft {
  serviceIds: string[];
  /** undefined = not chosen yet, null = "Ingen preferanse". */
  staffId: string | null | undefined;
  date: LocalDate | null;
  slot: Slot | null;
}
