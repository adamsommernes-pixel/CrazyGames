import { salon } from "@config";
import { createLocalRepository, type KeyValueStore } from "./local-storage";
import type { SalonRepository } from "./types";

let instance: SalonRepository | null = null;

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function browserStore(): KeyValueStore {
  try {
    const probe = "__salong_probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    // Private mode or storage disabled: keep data for this page view only.
    return memoryStore();
  }
}

/**
 * The repository used by the UI. Swap this factory for a database-backed
 * implementation of `SalonRepository` to go to production.
 */
export function getRepository(): SalonRepository {
  if (typeof window === "undefined") throw new Error("getRepository() is client-only in the demo");
  instance ??= createLocalRepository({ config: salon, store: browserStore() });
  return instance;
}
