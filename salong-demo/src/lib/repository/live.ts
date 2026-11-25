"use client";

/**
 * Hooks for reading repository data in client components.
 *
 * `useLiveCatalog` lets static content pages render from salon.config.ts on
 * the server, then pick up admin edits (prices, hidden services, opening
 * hours) from the repository after hydration, without a loading state.
 */
import { useSyncExternalStore } from "react";
import { salon } from "@config";
import type { Closure, OpeningHours, Service, StaffMember } from "@/lib/types";
import { todayLocal } from "@/lib/time/zoned";

export interface Catalog {
  services: Service[];
  staff: StaffMember[];
  openingHours: OpeningHours;
  closures: Closure[];
}

const initialCatalog: Catalog = {
  services: salon.services.filter((s) => s.active),
  staff: salon.staff,
  openingHours: salon.openingHours,
  closures: salon.booking.closedDates.map((d) => ({ id: `config-${d.date}`, date: d.date, reason: d.reason })),
};

let catalog: Catalog | null = null;
const catalogListeners = new Set<() => void>();
let unsubscribeRepo: (() => void) | null = null;

async function refreshCatalog() {
  // Loaded on demand so content pages ship without the repository code.
  const { getRepository } = await import("./client");
  const repo = getRepository();
  const [services, staff, openingHours, closures] = await Promise.all([
    repo.listServices(),
    repo.listStaff(),
    repo.getOpeningHours(),
    repo.listClosures(),
  ]);
  catalog = { services, staff, openingHours, closures };
  for (const l of catalogListeners) l();
}

function subscribeCatalog(listener: () => void) {
  catalogListeners.add(listener);
  if (!unsubscribeRepo) {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    unsubscribeRepo = () => {
      cancelled = true;
      unsubscribe?.();
    };
    void import("./client").then(({ getRepository }) => {
      if (cancelled) return;
      unsubscribe = getRepository().subscribe(() => void refreshCatalog());
      void refreshCatalog();
    });
  }
  return () => {
    catalogListeners.delete(listener);
    if (catalogListeners.size === 0 && unsubscribeRepo) {
      unsubscribeRepo();
      unsubscribeRepo = null;
    }
  };
}

export function useLiveCatalog(): Catalog {
  return useSyncExternalStore(
    subscribeCatalog,
    () => catalog ?? initialCatalog,
    () => initialCatalog,
  );
}

const noop = () => () => {};

/** Today's date in the salon's timezone, or null during server rendering. */
export function useToday(): string | null {
  return useSyncExternalStore(
    noop,
    () => todayLocal(Date.now(), salon.timeZone),
    () => null,
  );
}

function subscribeMinute(listener: () => void) {
  const id = window.setInterval(listener, 30_000);
  return () => window.clearInterval(id);
}

/** The current time rounded to the minute (re-renders each minute), or null on the server. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}
