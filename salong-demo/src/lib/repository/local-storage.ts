/**
 * BookingRepository backed by localStorage, seeded from salon.config.ts.
 * Every call reads fresh state from storage, so two tabs (e.g. the admin and
 * the public booking page) always see each other's changes.
 */
import type { Booking, OpeningHours, SalonConfig, Service, StaffMember } from "@/lib/types";
import {
  assignStaff,
  dayStatus,
  findSlot,
  generateSlots,
  type AvailabilityInput,
  type DayStatus,
} from "@/lib/booking/slots";
import { canCustomerCancel } from "@/lib/booking/policy";
import { createReference, normalizeReference } from "@/lib/booking/reference";
import { validateCustomer } from "@/lib/booking/validation";
import { toZoned } from "@/lib/time/zoned";
import { createSeedBookings } from "./seed";
import {
  NotFoundError,
  SlotUnavailableError,
  type AvailabilityQuery,
  type CreateBookingInput,
  type SalonRepository,
} from "./types";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface DemoState {
  version: 1;
  fingerprint: string;
  services: Service[];
  staff: StaffMember[];
  openingHours: OpeningHours;
  bookings: Booking[];
}

export class ValidationError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Invalid fields: ${fields.join(", ")}`);
    this.name = "ValidationError";
  }
}

export class CancellationTooLateError extends Error {
  constructor() {
    super("The appointment has already started");
    this.name = "CancellationTooLateError";
  }
}

/** Cheap stable hash, so a changed config replaces stale demo data automatically. */
function fingerprint(config: SalonConfig): string {
  const source = JSON.stringify([config.services, config.staff, config.openingHours, config.booking]);
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = ((h * 33) ^ source.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export interface LocalRepositoryOptions {
  config: SalonConfig;
  store: KeyValueStore;
  now?: () => number;
  key?: string;
  /** Seed believable demo bookings on first run. Off in tests. */
  seedBookings?: boolean;
}

export function createLocalRepository(options: LocalRepositoryOptions): SalonRepository {
  const { config, store } = options;
  const now = options.now ?? Date.now;
  const key = options.key ?? `salong-demo:${config.shortName.toLowerCase()}`;
  const seed = options.seedBookings ?? true;
  const listeners = new Set<() => void>();
  const print = fingerprint(config);

  function freshState(): DemoState {
    const base = {
      services: clone(config.services),
      staff: clone(config.staff),
      openingHours: clone(config.openingHours),
    };
    return {
      version: 1,
      fingerprint: print,
      ...base,
      bookings: seed ? createSeedBookings({ ...config, ...base }, now()) : [],
    };
  }

  function load(): DemoState {
    const raw = store.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === 1 && parsed.fingerprint === print) return parsed;
      } catch {
        // Corrupt data: fall through and reseed.
      }
    }
    const state = freshState();
    store.setItem(key, JSON.stringify(state));
    return state;
  }

  function save(state: DemoState) {
    store.setItem(key, JSON.stringify(state));
    for (const l of listeners) l();
  }

  function availabilityInput(state: DemoState, includeInactive = false): AvailabilityInput {
    return {
      timeZone: config.timeZone,
      rules: config.booking,
      openingHours: state.openingHours,
      staff: state.staff,
      services: includeInactive ? state.services : state.services.filter((s) => s.active),
      bookings: state.bookings,
      now: now(),
    };
  }

  function requireBooking(state: DemoState, predicate: (b: Booking) => boolean, label: string): Booking {
    const booking = state.bookings.find(predicate);
    if (!booking) throw new NotFoundError(label);
    return booking;
  }

  const repo: SalonRepository = {
    async listCategories() {
      return clone(config.categories);
    },

    async listServices(opts) {
      const { services } = load();
      return opts?.includeInactive ? services : services.filter((s) => s.active);
    },

    async listStaff() {
      return load().staff;
    },

    async getOpeningHours() {
      return load().openingHours;
    },

    async getAvailability(query: AvailabilityQuery, opts) {
      const input = availabilityInput(load(), opts?.admin);
      return generateSlots(input, {
        ...query,
        ignoreNoticeAndHorizon: opts?.admin,
        excludeBookingId: opts?.excludeBookingId,
      });
    },

    async getDayStatuses(query, dates) {
      const input = availabilityInput(load());
      const result: Record<string, DayStatus> = {};
      for (const date of dates) result[date] = dayStatus(input, query, date);
      return result;
    },

    async createBooking(data: CreateBookingInput) {
      const validation = validateCustomer(data.customer);
      if (!validation.ok) throw new ValidationError(Object.keys(validation.errors));
      const state = load();
      const admin = data.source === "admin";
      const input = availabilityInput(state, admin);
      const date = toZoned(Date.parse(data.start), config.timeZone).date;
      const slot = findSlot(
        input,
        { date, serviceIds: data.serviceIds, staffId: data.staffId, ignoreNoticeAndHorizon: admin },
        data.start,
      );
      if (!slot) throw new SlotUnavailableError();
      const staffId = data.staffId ?? assignStaff(input, slot);

      const taken = new Set(state.bookings.map((b) => b.reference));
      let reference = createReference();
      while (taken.has(reference)) reference = createReference();

      const booking: Booking = {
        id: newId(),
        reference,
        serviceIds: [...data.serviceIds],
        staffId,
        start: slot.start,
        end: slot.end,
        customer: validation.value,
        status: "confirmed",
        source: data.source ?? "online",
        createdAt: new Date(now()).toISOString(),
      };
      state.bookings.push(booking);
      save(state);
      return booking;
    },

    async getBooking(reference) {
      const ref = normalizeReference(reference);
      return load().bookings.find((b) => b.reference === ref) ?? null;
    },

    async listBookings(range) {
      const { bookings } = load();
      const filtered = range
        ? bookings.filter((b) => Date.parse(b.start) < Date.parse(range.to) && Date.parse(b.end) > Date.parse(range.from))
        : bookings;
      return [...filtered].sort((a, b) => a.start.localeCompare(b.start));
    },

    async cancelBooking(reference, opts?: { admin?: boolean }) {
      const state = load();
      const ref = normalizeReference(reference);
      const booking = requireBooking(state, (b) => b.reference === ref, "Booking");
      if (booking.status === "cancelled") return booking;
      if (!opts?.admin && !canCustomerCancel(booking, now())) throw new CancellationTooLateError();
      booking.status = "cancelled";
      booking.cancelledAt = new Date(now()).toISOString();
      save(state);
      return booking;
    },

    async moveBooking(id, { start, staffId }) {
      const state = load();
      const booking = requireBooking(state, (b) => b.id === id, "Booking");
      const input = availabilityInput(state, true);
      const date = toZoned(Date.parse(start), config.timeZone).date;
      const slot = findSlot(
        input,
        { date, serviceIds: booking.serviceIds, staffId, ignoreNoticeAndHorizon: true, excludeBookingId: id },
        start,
      );
      if (!slot) throw new SlotUnavailableError();
      booking.start = slot.start;
      booking.end = slot.end;
      booking.staffId = staffId;
      save(state);
      return booking;
    },

    async updateService(id, patch) {
      const state = load();
      const service = state.services.find((s) => s.id === id);
      if (!service) throw new NotFoundError("Service");
      Object.assign(service, patch);
      save(state);
      return service;
    },

    async updateStaffSchedule(id, schedule) {
      const state = load();
      const member = state.staff.find((m) => m.id === id);
      if (!member) throw new NotFoundError("Staff member");
      member.schedule = clone(schedule);
      save(state);
      return member;
    },

    async updateOpeningHours(hours) {
      const state = load();
      state.openingHours = clone(hours);
      save(state);
      return state.openingHours;
    },

    async resetDemoData() {
      save(freshState());
    },

    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) listener();
      };
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
  };

  return repo;
}
