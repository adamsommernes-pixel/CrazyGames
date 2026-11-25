/**
 * BookingRepository backed by localStorage, seeded from salon.config.ts.
 * Every call reads fresh state from storage, so two tabs (e.g. the admin and
 * the public booking page) always see each other's changes.
 */
import type {
  Booking,
  BookingRules,
  Closure,
  OpeningHours,
  SalonConfig,
  SalonProfile,
  Service,
  StaffMember,
} from "@/lib/types";
import { hashPassword } from "@/lib/password";
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
  InUseError,
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
  closures: Closure[];
  bookings: Booking[];
  profile: SalonProfile;
  rules: BookingRules;
  adminPasswordHash: string;
  staffPasswordHash: string;
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

/** Bump when the stored shape or the seed changes, to reseed existing browsers. */
const DATA_VERSION = 5;

/** Cheap stable hash, so a changed config replaces stale demo data automatically. */
function fingerprint(config: SalonConfig): string {
  const source = JSON.stringify([DATA_VERSION, config.services, config.staff, config.openingHours, config.booking]);
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
      closures: config.booking.closedDates.map((d) => ({ id: `config-${d.date}`, date: d.date, reason: d.reason })),
      profile: clone({
        name: config.name,
        tagline: config.tagline,
        logo: config.logo,
        hero: config.hero,
        contact: config.contact,
      }),
      rules: clone(config.booking),
      adminPasswordHash: config.adminPasswordHash,
      staffPasswordHash: config.staffPasswordHash,
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
      rules: state.rules,
      openingHours: state.openingHours,
      staff: state.staff.filter((m) => !m.archived),
      services: includeInactive ? state.services : state.services.filter((s) => s.active),
      bookings: state.bookings,
      closures: state.closures,
      now: now(),
    };
  }

  /** Keep staff members' service lists in step with a service's `staffIds`. */
  function setServiceStaff(state: DemoState, serviceId: string, staffIds: string[]) {
    for (const member of state.staff) {
      const has = member.serviceIds.includes(serviceId);
      const should = staffIds.includes(member.id);
      if (has && !should) member.serviceIds = member.serviceIds.filter((id) => id !== serviceId);
      if (!has && should) member.serviceIds = [...member.serviceIds, serviceId];
    }
  }

  function slugFor(name: string, taken: (id: string) => boolean): string {
    const base =
      name
        .toLowerCase()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "a")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "id";
    let id = base;
    for (let i = 2; taken(id); i++) id = `${base}-${i}`;
    return id;
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
      return services.filter((s) => (opts?.includeArchived || !s.archived) && (opts?.includeInactive || s.active));
    },

    async listClosures() {
      return [...load().closures].sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
    },

    async listStaff(opts) {
      const { staff } = load();
      return opts?.includeArchived ? staff : staff.filter((m) => !m.archived);
    },

    async getProfile() {
      return load().profile;
    },

    async getRules() {
      return load().rules;
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
      const admin = data.source === "admin";
      const validation = validateCustomer(data.customer, { requireEmail: !admin });
      if (!validation.ok) throw new ValidationError(Object.keys(validation.errors));
      const state = load();
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

    async createService({ staffIds, ...fields }) {
      const state = load();
      const service: Service = { ...fields, id: slugFor(fields.name, (id) => state.services.some((s) => s.id === id)) };
      state.services.push(service);
      setServiceStaff(state, service.id, staffIds);
      save(state);
      return service;
    },

    async updateService(id, { staffIds, ...patch }) {
      const state = load();
      const service = state.services.find((s) => s.id === id && !s.archived);
      if (!service) throw new NotFoundError("Service");
      Object.assign(service, patch);
      if (staffIds) setServiceStaff(state, id, staffIds);
      save(state);
      return service;
    },

    async deleteService(id) {
      const state = load();
      const service = state.services.find((s) => s.id === id && !s.archived);
      if (!service) throw new NotFoundError("Service");
      const upcoming = state.bookings.filter(
        (b) => b.status === "confirmed" && b.serviceIds.includes(id) && Date.parse(b.end) > now(),
      ).length;
      if (upcoming > 0) throw new InUseError(upcoming);
      // Archive rather than remove, so past bookings keep the service name.
      service.archived = true;
      service.active = false;
      service.popular = false;
      setServiceStaff(state, id, []);
      save(state);
    },

    async addClosure(input) {
      const state = load();
      const closure: Closure = { ...input, id: newId() };
      state.closures.push(closure);
      save(state);
      return closure;
    },

    async removeClosure(id) {
      const state = load();
      state.closures = state.closures.filter((c) => c.id !== id);
      save(state);
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

    async createStaff(input) {
      const state = load();
      const member: StaffMember = { ...clone(input), id: slugFor(input.name, (id) => state.staff.some((m) => m.id === id)) };
      state.staff.push(member);
      save(state);
      return member;
    },

    async updateStaff(id, patch) {
      const state = load();
      const member = state.staff.find((m) => m.id === id && !m.archived);
      if (!member) throw new NotFoundError("Staff member");
      Object.assign(member, clone(patch));
      save(state);
      return member;
    },

    async deleteStaff(id) {
      const state = load();
      const member = state.staff.find((m) => m.id === id && !m.archived);
      if (!member) throw new NotFoundError("Staff member");
      const upcoming = state.bookings.filter(
        (b) => b.status === "confirmed" && b.staffId === id && Date.parse(b.end) > now(),
      ).length;
      if (upcoming > 0) throw new InUseError(upcoming);
      member.archived = true;
      member.serviceIds = [];
      state.closures = state.closures.filter((c) => c.staffId !== id);
      save(state);
    },

    async updateProfile(profile) {
      const state = load();
      state.profile = clone(profile);
      save(state);
      return state.profile;
    },

    async updateRules(patch) {
      const state = load();
      state.rules = { ...state.rules, ...patch };
      save(state);
      return state.rules;
    },

    async verifyAdminPassword(password) {
      return (await hashPassword(password)) === load().adminPasswordHash;
    },

    async verifyStaffPassword(password) {
      return (await hashPassword(password)) === load().staffPasswordHash;
    },

    async setStaffPassword(next) {
      const state = load();
      state.staffPasswordHash = await hashPassword(next);
      save(state);
    },

    async changeAdminPassword(current, next) {
      const state = load();
      if ((await hashPassword(current)) !== state.adminPasswordHash) return false;
      state.adminPasswordHash = await hashPassword(next);
      save(state);
      return true;
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
