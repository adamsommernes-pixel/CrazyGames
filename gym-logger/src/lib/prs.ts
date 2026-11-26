import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import type { WorkoutSet } from '../db/types';
import { countsAsWork, detectPRsInOrder, type PRKind } from './calc';
import { kindOf, registerKinds } from './kinds';

/**
 * Går gjennom alle fullførte sets i rekkefølgen de ble gjort, per øvelse,
 * og finner hvilke som satte rekord da de ble gjort. Rekordtypen følger øvelsestypen.
 */
export function computePRMap(sets: WorkoutSet[]): Map<string, PRKind[]> {
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (s.deleted || !countsAsWork(s)) continue;
    const list = byExercise.get(s.exercise_id) ?? [];
    list.push(s);
    byExercise.set(s.exercise_id, list);
  }
  const result = new Map<string, PRKind[]>();
  for (const [exerciseId, list] of byExercise) {
    for (const [id, prs] of detectPRsInOrder(list, [], kindOf(exerciseId))) result.set(id, prs);
  }
  return result;
}

const EMPTY = new Map<string, PRKind[]>();

export function usePRMap(): Map<string, PRKind[]> {
  return useLiveQuery(
    async () => {
      // Egne øvelser kan ha en annen type enn vekt × reps.
      registerKinds((await db.exercises.toArray()).filter((e) => e.custom));
      return computePRMap(await db.sets.toArray());
    },
    [],
    EMPTY,
  );
}
