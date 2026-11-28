import { db, now } from './dexie';
import type { SyncedTable } from './types';
import { getSetting, setSetting } from '../lib/settings';

// Gir en rad ny id lokalt og oppdaterer alt som peker på den. Brukes når databasen i skyen nekter en rad
// fordi id-en allerede tilhører en annen bruker (raden har da aldri vært lagret i skyen for denne kontoen).

/** Hvilke felt i hvilke tabeller som peker på en rad i tabellen. */
const REFS: Partial<Record<SyncedTable, [SyncedTable, string][]>> = {
  exercises: [['sets', 'exercise_id'], ['workout_exercises', 'exercise_id'], ['routine_exercises', 'exercise_id']],
  workouts: [['workout_exercises', 'workout_id'], ['sets', 'workout_id']],
  workout_exercises: [['sets', 'workout_exercise_id']],
  routines: [['routine_exercises', 'routine_id'], ['workouts', 'routine_id']],
};

export async function rekey(table: SyncedTable, oldId: string, newId: string): Promise<boolean> {
  if (oldId === newId || table === 'profiles') return false;
  const stamp = now();
  const tables = [table, ...(REFS[table] ?? []).map(([t]) => t)];
  const moved = await db.transaction('rw', [...new Set(tables)].map((t) => db.table(t)), async () => {
    const t = db.table<Record<string, unknown>, string>(table);
    const row = await t.get(oldId);
    if (!row) return false;
    if (await t.get(newId)) {
      // Finnes allerede (f.eks. reparert på en annen enhet og hentet ned): bare flytt referansene.
      await t.delete(oldId);
    } else {
      await t.delete(oldId);
      await t.put({ ...row, id: newId, updated_at: stamp, dirty: 1 });
    }
    for (const [refTable, field] of REFS[table] ?? []) {
      const rt = db.table<Record<string, unknown>, string>(refTable);
      const rows = await rt.filter((r) => r[field] === oldId).toArray();
      await rt.bulkPut(rows.map((r) => ({ ...r, [field]: newId, updated_at: stamp, dirty: 1 })));
    }
    return true;
  });
  if (moved && table === 'exercises') {
    const favs = await getSetting('favorites');
    if (favs.includes(oldId)) await setSetting('favorites', favs.map((f) => (f === oldId ? newId : f)));
  }
  return moved;
}
