"use client";

/**
 * Hooks for reading repository data in client components.
 *
 * `useLiveCatalog` lets static content pages render from salon.config.ts on
 * the server, then pick up admin edits (prices, hidden services, opening
 * hours) from the repository after hydration, without a loading state.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { salon } from "@config";
import type { OpeningHours, Service, StaffMember } from "@/lib/types";
import { todayLocal } from "@/lib/time/zoned";
import { getRepository } from "./client";
import type { SalonRepository } from "./types";

export interface Catalog {
  services: Service[];
  staff: StaffMember[];
  openingHours: OpeningHours;
}

const initialCatalog: Catalog = {
  services: salon.services.filter((s) => s.active),
  staff: salon.staff,
  openingHours: salon.openingHours,
};

let catalog: Catalog | null = null;
const catalogListeners = new Set<() => void>();
let unsubscribeRepo: (() => void) | null = null;

async function refreshCatalog() {
  const repo = getRepository();
  const [services, staff, openingHours] = await Promise.all([repo.listServices(), repo.listStaff(), repo.getOpeningHours()]);
  catalog = { services, staff, openingHours };
  for (const l of catalogListeners) l();
}

function subscribeCatalog(listener: () => void) {
  catalogListeners.add(listener);
  if (!unsubscribeRepo) {
    unsubscribeRepo = getRepository().subscribe(() => void refreshCatalog());
    void refreshCatalog();
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

/**
 * Load data from the repository and reload whenever it changes.
 * `key` identifies the query; change it to refetch with new arguments.
 */
export function useRepoQuery<T>(key: string, load: (repo: SalonRepository) => Promise<T>): T | undefined {
  const [result, setResult] = useState<{ key: string; version: number; data: T } | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => getRepository().subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let alive = true;
    load(getRepository()).then((data) => {
      if (alive) setResult({ key, version, data });
    });
    return () => {
      alive = false;
    };
    // `load` is recreated every render; `key` captures its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return result?.key === key ? result.data : undefined;
}
