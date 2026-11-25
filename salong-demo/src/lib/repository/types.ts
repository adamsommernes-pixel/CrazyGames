/**
 * The data-access boundary. The UI only talks to these interfaces, so the
 * localStorage implementation can be swapped for a real database (e.g. an
 * HTTP client against an API) without touching any component.
 */
import type { DayStatus, Slot } from "@/lib/booking/slots";
import type {
  Booking,
  Customer,
  LocalDate,
  OpeningHours,
  Service,
  ServiceCategory,
  StaffMember,
  WeeklySchedule,
} from "@/lib/types";

export interface AvailabilityQuery {
  serviceIds: string[];
  staffId: string | null;
  date: LocalDate;
}

export interface CreateBookingInput {
  serviceIds: string[];
  /** `null` = no preference; the repository assigns a free staff member. */
  staffId: string | null;
  start: string;
  customer: Customer;
  source?: Booking["source"];
}

export interface MoveBookingInput {
  start: string;
  staffId: string;
}

export interface BookingRepository {
  listCategories(): Promise<ServiceCategory[]>;
  /** Active services only, unless `includeInactive` is set. */
  listServices(opts?: { includeInactive?: boolean }): Promise<Service[]>;
  listStaff(): Promise<StaffMember[]>;
  getOpeningHours(): Promise<OpeningHours>;
  getAvailability(query: AvailabilityQuery, opts?: { admin?: boolean; excludeBookingId?: string }): Promise<Slot[]>;
  getDayStatuses(query: Omit<AvailabilityQuery, "date">, dates: LocalDate[]): Promise<Record<LocalDate, DayStatus>>;
  /** Re-checks availability and throws `SlotUnavailableError` if the slot was taken. */
  createBooking(input: CreateBookingInput): Promise<Booking>;
  getBooking(reference: string): Promise<Booking | null>;
  listBookings(range?: { from: string; to: string }): Promise<Booking[]>;
  /** Customers can cancel until the start time; late cancellations are flagged in the UI. */
  cancelBooking(reference: string, opts?: { admin?: boolean }): Promise<Booking>;
}

export interface AdminRepository {
  moveBooking(id: string, input: MoveBookingInput): Promise<Booking>;
  updateService(id: string, patch: Partial<Pick<Service, "name" | "priceNok" | "durationMin" | "active">>): Promise<Service>;
  updateStaffSchedule(id: string, schedule: WeeklySchedule): Promise<StaffMember>;
  updateOpeningHours(hours: OpeningHours): Promise<OpeningHours>;
  resetDemoData(): Promise<void>;
}

export interface SalonRepository extends BookingRepository, AdminRepository {
  /** Called whenever data changes (also from other tabs). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("The selected time is no longer available");
    this.name = "SlotUnavailableError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}
