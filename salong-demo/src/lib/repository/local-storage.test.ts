import { describe, expect, it } from "vitest";
import { salon } from "@config";
import { addDays, todayLocal, weekdayOf, zonedToUtc } from "@/lib/time/zoned";
import { createLocalRepository, ValidationError, type KeyValueStore } from "./local-storage";
import { InUseError, SlotUnavailableError } from "./types";

const TZ = salon.timeZone;

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// Tuesday 1 December 2026, 08:00 Oslo.
const NOW = zonedToUtc("2026-12-01", 8 * 60, TZ);
const DATE = "2026-12-02"; // Wednesday
const customer = { name: "Kari Nordmann", phone: "412 34 567", email: "kari@example.no" };

const make = (store = memoryStore(), seedBookings = false) =>
  createLocalRepository({ config: salon, store, now: () => NOW, seedBookings });

describe("local repository", () => {
  it("prevents double-booking the same staff member", async () => {
    const repo = make();
    const [slot] = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "marius" });
    expect(slot).toBeDefined();
    await repo.createBooking({ serviceIds: ["herreklipp"], staffId: "marius", start: slot!.start, customer });
    await expect(
      repo.createBooking({ serviceIds: ["herreklipp"], staffId: "marius", start: slot!.start, customer }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
    const after = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "marius" });
    expect(after.map((s) => s.start)).not.toContain(slot!.start);
  });

  it("assigns a free staff member for no-preference bookings", async () => {
    const repo = make();
    const slots = await repo.getAvailability({ date: DATE, serviceIds: ["dameklipp-kort"], staffId: null });
    const slot = slots.find((s) => s.staffIds.length > 1)!;
    const first = await repo.createBooking({ serviceIds: ["dameklipp-kort"], staffId: null, start: slot.start, customer });
    const second = await repo.createBooking({ serviceIds: ["dameklipp-kort"], staffId: null, start: slot.start, customer });
    expect(first.staffId).not.toBe(second.staffId);
    expect(slot.staffIds).toContain(first.staffId);
    expect(slot.staffIds).toContain(second.staffId);
  });

  it("rejects invalid customer details", async () => {
    const repo = make();
    const [slot] = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: null });
    await expect(
      repo.createBooking({ serviceIds: ["herreklipp"], staffId: null, start: slot!.start, customer: { ...customer, phone: "12" } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("cancels by reference and frees the slot", async () => {
    const repo = make();
    const [slot] = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "jonas" });
    const target = slot ?? (await repo.getAvailability({ date: "2026-12-04", serviceIds: ["herreklipp"], staffId: "jonas" }))[0]!;
    const booking = await repo.createBooking({ serviceIds: ["herreklipp"], staffId: "jonas", start: target.start, customer });
    const cancelled = await repo.cancelBooking(booking.reference.toLowerCase());
    expect(cancelled.status).toBe("cancelled");
    const date = new Date(target.start);
    const again = await repo.getAvailability({
      date: todayLocal(date.getTime(), TZ),
      serviceIds: ["herreklipp"],
      staffId: "jonas",
    });
    expect(again.map((s) => s.start)).toContain(target.start);
  });

  it("moves a booking and checks the new time", async () => {
    const repo = make();
    const slots = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "marius" });
    const a = await repo.createBooking({ serviceIds: ["herreklipp"], staffId: "marius", start: slots[0]!.start, customer });
    const b = await repo.createBooking({ serviceIds: ["herreklipp"], staffId: "marius", start: slots[8]!.start, customer });
    await expect(repo.moveBooking(b.id, { start: a.start, staffId: "marius" })).rejects.toBeInstanceOf(SlotUnavailableError);
    const moved = await repo.moveBooking(b.id, { start: slots[4]!.start, staffId: "marius" });
    expect(moved.start).toBe(slots[4]!.start);
  });

  it("reflects admin edits in availability immediately", async () => {
    const repo = make();
    await repo.updateService("herreklipp", { active: false });
    expect((await repo.listServices()).map((s) => s.id)).not.toContain("herreklipp");
    expect(await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: null })).toEqual([]);

    const hours = await repo.getOpeningHours();
    await repo.updateOpeningHours({ ...hours, 3: null });
    expect(await repo.getAvailability({ date: DATE, serviceIds: ["dameklipp-kort"], staffId: null })).toEqual([]);

    await repo.resetDemoData();
    expect((await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: null })).length).toBeGreaterThan(0);
  });

  it("seeds a fully booked Saturday and keeps seeded bookings conflict-free", async () => {
    const repo = make(memoryStore(), true);
    const today = todayLocal(NOW, TZ);
    let saturday = addDays(today, 1);
    while (weekdayOf(saturday) !== 6) saturday = addDays(saturday, 1);
    for (const service of await repo.listServices()) {
      const slots = await repo.getAvailability({ date: saturday, serviceIds: [service.id], staffId: null });
      expect(slots, service.id).toEqual([]);
    }
    const bookings = (await repo.listBookings()).filter((b) => b.status === "confirmed");
    for (const a of bookings) {
      for (const b of bookings) {
        if (a !== b && a.staffId === b.staffId) {
          expect(Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end)).toBe(false);
        }
      }
    }
  });

  it("creates, edits and deletes services, keeping staff assignments in step", async () => {
    const repo = make();
    const service = await repo.createService({
      categoryId: "klipp",
      name: "Pannelugg",
      description: "Rask justering av luggen.",
      durationMin: 15,
      priceNok: 195,
      active: true,
      staffIds: ["marius", "jonas"],
    });
    expect(service.id).toBe("pannelugg");
    const staff = await repo.listStaff();
    expect(staff.find((m) => m.id === "jonas")!.serviceIds).toContain("pannelugg");
    expect((await repo.getAvailability({ date: DATE, serviceIds: ["pannelugg"], staffId: "marius" })).length).toBeGreaterThan(0);

    await repo.updateService("pannelugg", { priceNok: 245, staffIds: ["marius"] });
    expect((await repo.listStaff()).find((m) => m.id === "jonas")!.serviceIds).not.toContain("pannelugg");
    expect((await repo.listServices()).find((s) => s.id === "pannelugg")!.priceNok).toBe(245);

    const again = await repo.createService({ ...service, staffIds: [] });
    expect(again.id).toBe("pannelugg-2");

    const [slot] = await repo.getAvailability({ date: DATE, serviceIds: ["pannelugg"], staffId: "marius" });
    const booking = await repo.createBooking({ serviceIds: ["pannelugg"], staffId: "marius", start: slot!.start, customer });
    await expect(repo.deleteService("pannelugg")).rejects.toBeInstanceOf(InUseError);
    await repo.cancelBooking(booking.reference);
    await repo.deleteService("pannelugg");
    expect((await repo.listServices({ includeInactive: true })).map((s) => s.id)).not.toContain("pannelugg");
    expect((await repo.listServices({ includeInactive: true, includeArchived: true })).map((s) => s.id)).toContain("pannelugg");
    expect((await repo.listStaff()).some((m) => m.serviceIds.includes("pannelugg"))).toBe(false);
  });

  it("adds and removes closures that availability respects", async () => {
    const repo = make();
    expect((await repo.listClosures()).map((c) => c.reason)).toEqual(["Julaften", "Nyttårsaften"]);
    const closure = await repo.addClosure({ date: DATE, staffId: "marius", reason: "Kurs" });
    expect(await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "marius" })).toEqual([]);
    await repo.removeClosure(closure.id);
    expect((await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "marius" })).length).toBeGreaterThan(0);
  });

  it("adds, edits and removes staff; availability follows", async () => {
    const repo = make();
    const nine = [{ start: "09:00", end: "17:00" }] as const;
    const member = await repo.createStaff({
      name: "Live Ås",
      role: "Frisør",
      bio: "Ny hos oss.",
      serviceIds: ["herreklipp"],
      schedule: { 1: [...nine], 2: [...nine], 3: [...nine], 4: [...nine], 5: [...nine], 6: [], 7: [] },
    });
    expect(member.id).toBe("live-as");
    const slots = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "live-as" });
    expect(slots[0]?.label).toBe("09:00");

    await repo.updateStaff("live-as", { role: "Seniorfrisør", serviceIds: [] });
    expect((await repo.listStaff()).find((m) => m.id === "live-as")!.role).toBe("Seniorfrisør");
    expect(await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "live-as" })).toEqual([]);

    await repo.updateStaff("live-as", { serviceIds: ["herreklipp"] });
    const booking = await repo.createBooking({ serviceIds: ["herreklipp"], staffId: "live-as", start: slots[0]!.start, customer });
    await expect(repo.deleteStaff("live-as")).rejects.toBeInstanceOf(InUseError);
    await repo.cancelBooking(booking.reference);
    await repo.deleteStaff("live-as");
    expect((await repo.listStaff()).map((m) => m.id)).not.toContain("live-as");
    expect((await repo.listStaff({ includeArchived: true })).map((m) => m.id)).toContain("live-as");
    expect(await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: null })).not.toEqual([]);
  });

  it("edits the salon profile and booking rules", async () => {
    const repo = make();
    const profile = await repo.getProfile();
    await repo.updateProfile({ ...profile, name: "Salong Røsslyng" });
    expect((await repo.getProfile()).name).toBe("Salong Røsslyng");

    const before = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "marius" });
    await repo.updateRules({ slotStepMin: 30 });
    const after = await repo.getAvailability({ date: DATE, serviceIds: ["herreklipp"], staffId: "marius" });
    expect(after.length).toBeLessThan(before.length);
    expect(after.every((s) => s.label.endsWith(":00") || s.label.endsWith(":30"))).toBe(true);
  });

  it("checks and changes the admin password", async () => {
    const repo = make();
    expect(await repo.verifyAdminPassword("lyng2026")).toBe(true);
    expect(await repo.verifyAdminPassword("feil")).toBe(false);
    expect(await repo.changeAdminPassword("feil", "nytt-passord")).toBe(false);
    expect(await repo.changeAdminPassword("lyng2026", "nytt-passord")).toBe(true);
    expect(await repo.verifyAdminPassword("nytt-passord")).toBe(true);
    await repo.resetDemoData();
    expect(await repo.verifyAdminPassword("lyng2026")).toBe(true);
  });
});
