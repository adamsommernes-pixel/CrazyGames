/**
 * The data-access boundary. The UI only talks to these interfaces, so the
 * localStorage implementation can be swapped for a real database (e.g. an
 * HTTP client against an API) without touching any component.
 */
import type { DayStatus, Slot } from "@/lib/booking/slots";
import type {
  Booking,
  BookingRules,
  Closure,
  SalonProfile,
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
  /** Active services only, unless `includeInactive` is set. Deleted services only with `includeArchived`. */
  listServices(opts?: { includeInactive?: boolean; includeArchived?: boolean }): Promise<Service[]>;
  /** Temporary closures and absences, sorted by date. */
  listClosures(): Promise<Closure[]>;
  /** Current staff, unless `includeArchived` is set (for names on past bookings). */
  listStaff(opts?: { includeArchived?: boolean }): Promise<StaffMember[]>;
  getProfile(): Promise<SalonProfile>;
  getRules(): Promise<BookingRules>;
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

export type ServiceInput = Omit<Service, "id" | "archived"> & {
  /** Staff members who perform the service. */
  staffIds: string[];
};

export type StaffInput = Omit<StaffMember, "id" | "archived">;

/** Day-to-day work, available in /staff. */
export interface StaffRepository {
  moveBooking(id: string, input: MoveBookingInput): Promise<Booking>;
  updateStaffSchedule(id: string, schedule: WeeklySchedule): Promise<StaffMember>;
  addClosure(input: Omit<Closure, "id">): Promise<Closure>;
  removeClosure(id: string): Promise<void>;
}

/** Owner settings, available in /admin behind the password. */
export interface AdminRepository {
  createService(input: ServiceInput): Promise<Service>;
  updateService(id: string, patch: Partial<ServiceInput>): Promise<Service>;
  /** Throws `ServiceInUseError` if the service has upcoming bookings. */
  deleteService(id: string): Promise<void>;
  createStaff(input: StaffInput): Promise<StaffMember>;
  updateStaff(id: string, patch: Partial<StaffInput>): Promise<StaffMember>;
  /** Throws `InUseError` if the person has upcoming bookings. */
  deleteStaff(id: string): Promise<void>;
  updateOpeningHours(hours: OpeningHours): Promise<OpeningHours>;
  updateProfile(profile: SalonProfile): Promise<SalonProfile>;
  updateRules(patch: Partial<Omit<BookingRules, "closedDates">>): Promise<BookingRules>;
  verifyAdminPassword(password: string): Promise<boolean>;
  /** Returns false if `current` is wrong. */
  changeAdminPassword(current: string, next: string): Promise<boolean>;
  resetDemoData(): Promise<void>;
}

export interface SalonRepository extends BookingRepository, StaffRepository, AdminRepository {
  /** Called whenever data changes (also from other tabs). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("The selected time is no longer available");
    this.name = "SlotUnavailableError";
  }
}

/** A service or staff member that still has upcoming bookings cannot be deleted. */
export class InUseError extends Error {
  constructor(public readonly upcoming: number) {
    super(`Has ${upcoming} upcoming bookings`);
    this.name = "InUseError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}
