/**
 * Believable demo bookings so the admin calendar is not empty on first visit.
 * Deterministic for a given day, so screenshots and demos are repeatable.
 */
import type { Booking, LocalDate, SalonConfig } from "@/lib/types";
import { closureReason, generateSlots, workingIntervals, type AvailabilityInput } from "@/lib/booking/slots";
import { addDays, todayLocal, weekdayOf } from "@/lib/time/zoned";

const FIRST = ["Kari", "Ola", "Nora", "Emil", "Ingrid", "Jakob", "Sara", "Henrik", "Maja", "Aksel", "Ida", "Filip", "Thea", "Sander", "Linnea", "Magnus", "Hedda", "Elias", "Tiril", "Mathias", "Selma", "Oskar", "Live", "Noah"];
const LAST = ["Hansen", "Johansen", "Olsen", "Larsen", "Andersen", "Pedersen", "Nilsen", "Kristiansen", "Jensen", "Karlsen", "Johnsen", "Pettersen", "Eriksen", "Berg", "Haugen", "Hagen", "Dahl", "Lie", "Moen", "Strand"];
const NOTES = ["Ønsker samme som sist.", "Litt kortere i nakken.", "Allergisk mot parfyme.", "Har med bilde."];
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MINUTE = 60_000;
const DAY = 86_400_000;

type SeedConfig = Pick<SalonConfig, "services" | "staff" | "openingHours" | "booking" | "timeZone">;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ascii = (s: string) => s.toLowerCase().replace(/ø/g, "o").replace(/å/g, "a").replace(/æ/g, "ae");

export function createSeedBookings(config: SeedConfig, now: number): Booking[] {
  const today = todayLocal(now, config.timeZone);
  const rand = mulberry32(Number(today.replace(/-/g, "")));
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const step = config.booking.slotStepMin * MINUTE;
  const buffer = config.booking.bufferMin * MINUTE;
  const services = config.services.filter((s) => s.active);
  const bookings: Booking[] = [];

  function add(serviceId: string, staffId: string, start: number, durationMin: number) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const digits = String(40_000_000 + Math.floor(rand() * 59_999_999));
    const note = rand() < 0.25 ? pick(NOTES) : "";
    bookings.push({
      id: `seed-${staffId}-${start}`,
      reference: Array.from({ length: 6 }, () => pick(ALPHABET)).join(""),
      serviceIds: [serviceId],
      staffId,
      start: new Date(start).toISOString(),
      end: new Date(start + durationMin * MINUTE).toISOString(),
      customer: {
        name: `${first} ${last}`,
        phone: `+47 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`,
        email: `${ascii(first)}.${ascii(last)}@example.no`,
        ...(note ? { note } : {}),
      },
      status: rand() < 0.04 ? "cancelled" : "confirmed",
      source: rand() < 0.8 ? "online" : "admin",
      createdAt: new Date(now - Math.floor(rand() * 20) * DAY).toISOString(),
    });
  }

  /** Random, realistic density that thins out further ahead. */
  function fillRandom(date: LocalDate, density: number) {
    for (const member of config.staff) {
      const own = services.filter((s) => member.serviceIds.includes(s.id));
      for (const window of workingIntervals(date, member, config.openingHours, config.timeZone)) {
        let t = window.start;
        while (t < window.end) {
          const fitting = own.filter((s) => t + s.durationMin * MINUTE <= window.end);
          if (fitting.length === 0) break;
          if (rand() < density) {
            const service = pick(fitting);
            add(service.id, member.id, t, service.durationMin);
            const gap = Math.ceil((buffer + Math.floor(rand() * 3) * step) / step) * step;
            t += Math.ceil((service.durationMin * MINUTE) / step) * step + gap;
          } else {
            t += step * (2 + Math.floor(rand() * 3));
          }
        }
      }
    }
  }

  /** Book every remaining slot, so the day shows as "Fullt" for every service. */
  function fillCompletely(date: LocalDate) {
    const input = (): AvailabilityInput => ({
      timeZone: config.timeZone,
      rules: config.booking,
      openingHours: config.openingHours,
      staff: config.staff,
      services,
      bookings,
      now,
    });
    for (const member of config.staff) {
      const own = services.filter((s) => member.serviceIds.includes(s.id)).sort((a, b) => b.durationMin - a.durationMin);
      for (;;) {
        let placed = false;
        for (const service of own) {
          const [slot] = generateSlots(input(), { date, serviceIds: [service.id], staffId: member.id, ignoreNoticeAndHorizon: true });
          if (slot) {
            add(service.id, member.id, Date.parse(slot.start), service.durationMin);
            bookings.at(-1)!.status = "confirmed";
            placed = true;
            break;
          }
        }
        if (!placed) break;
      }
    }
  }

  let fullDay: LocalDate | null = null;
  for (let d = 1; d <= 7 && !fullDay; d++) if (weekdayOf(addDays(today, d)) === 6) fullDay = addDays(today, d);

  for (let offset = -3; offset <= 21; offset++) {
    const date = addDays(today, offset);
    if (date === fullDay) continue;
    if (closureReason(date, { rules: config.booking, openingHours: config.openingHours })) continue;
    fillRandom(date, offset <= 3 ? 0.7 : Math.max(0.15, 0.6 - offset * 0.025));
  }
  if (fullDay && !closureReason(fullDay, { rules: config.booking, openingHours: config.openingHours })) {
    fillCompletely(fullDay);
  }
  return bookings;
}
