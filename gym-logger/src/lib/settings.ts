import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';

export interface Settings {
  unit: 'kg' | 'lbs';
  /** Standard hviletid i sekunder. */
  defaultRest: number;
  /** Aktiv hviletimer: når den er ferdig (ms) og hvor lang den var. */
  restTimer: { endAt: number; total: number } | null;
}

export const DEFAULTS: Settings = { unit: 'kg', defaultRest: 90, restTimer: null };

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.kv.get(key);
  return (row?.value as Settings[K]) ?? DEFAULTS[key];
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.kv.put({ key, value });
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useLiveQuery(() => getSetting(key), [key], DEFAULTS[key]);
}
