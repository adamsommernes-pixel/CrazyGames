import Dexie from 'dexie';
import type { GymDB } from './dexie';

// Data fra versjon 1 lå i én felles database uten konto. Ved første innlogging
// kan de flyttes inn i kontoen.

const LEGACY = 'gym-logger';
const TABLES = ['exercises', 'routines', 'routine_exercises', 'workouts', 'workout_exercises', 'sets'] as const;

async function openLegacy(): Promise<Dexie | null> {
  try {
    if (!(await Dexie.exists(LEGACY))) return null;
    const legacy = new Dexie(LEGACY);
    await legacy.open();
    return legacy;
  } catch {
    return null;
  }
}

/** Antall ferdige økter i den gamle databasen (0 om den ikke finnes). */
export async function legacyWorkoutCount(): Promise<number> {
  const legacy = await openLegacy();
  if (!legacy) return 0;
  try {
    const rows = await legacy.table('workouts').toArray();
    return rows.filter((w) => !w.deleted && w.ended_at).length;
  } finally {
    legacy.close();
  }
}

/** Kopierer alt fra den gamle databasen inn i brukerens, og sletter den gamle. */
export async function importLegacy(target: GymDB): Promise<void> {
  const legacy = await openLegacy();
  if (!legacy) return;
  try {
    for (const t of TABLES) {
      let rows = await legacy.table(t).toArray();
      if (t === 'exercises') rows = rows.filter((r) => r.custom);
      if (t === 'sets') {
        rows = rows.map(({ is_warmup, ...r }) => ({ ...r, set_type: is_warmup ? 'warmup' : (r.set_type ?? 'normal'), dirty: 1 }));
      } else {
        rows = rows.map((r) => ({ ...(t === 'workout_exercises' ? { notes: '' } : {}), ...r, dirty: 1 }));
      }
      await target.table(t).bulkPut(rows);
    }
    const kv = await legacy.table('kv').toArray();
    await target.kv.bulkPut(kv.filter((k) => k.key === 'unit' || k.key === 'defaultRest'));
  } finally {
    legacy.close();
  }
  await Dexie.delete(LEGACY);
}

export async function discardLegacy() {
  await Dexie.delete(LEGACY);
}
