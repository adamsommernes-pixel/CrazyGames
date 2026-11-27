import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';

export interface Settings {
  unit: 'kg' | 'lbs';
  /** Standard hviletid i sekunder. */
  defaultRest: number;
  /** Aktiv hviletimer: når den er ferdig (ms) og hvor lang den var. */
  restTimer: { endAt: number; total: number } | null;
  /** Stangvekt i kg for platekalkulatoren. */
  barWeight: number;
  /** Skiver som finnes på gymmen (kg). */
  plates: number[];
  sound: boolean;
  haptics: boolean;
  /** Varsel fra serveren når pausen er over (virker med låst skjerm). Per enhet. */
  restPush: boolean;
  /** Valgt tidsrom for data og grafer (felles for alle sider). */
  statsRange: import('./range').Range;
  /** Hold skjermen på mens en økt pågår. */
  keepAwake: boolean;
  /** Øvelser merket med stjerne, vises først i øvelsesvelgeren. */
  favorites: string[];
}

export const DEFAULTS: Settings = {
  unit: 'kg',
  defaultRest: 90,
  restTimer: null,
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  sound: true,
  haptics: true,
  restPush: false,
  statsRange: { kind: '30d' },
  keepAwake: true,
  favorites: [],
};

export async function toggleFavorite(exerciseId: string) {
  const favs = await getSetting('favorites');
  await setSetting('favorites', favs.includes(exerciseId) ? favs.filter((f) => f !== exerciseId) : [...favs, exerciseId]);
}

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
