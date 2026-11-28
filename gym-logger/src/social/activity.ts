import { db } from '../db/dexie';
import { setsForWorkout, workoutExercises } from '../db/repo';
import type { Sex, WorkoutSet } from '../db/types';
import { guideFor } from '../db/library';
import { countsAsWork, estimate1RM, volume } from '../lib/calc';
import { computePRMap } from '../lib/prs';
import { kindOf } from '../lib/kinds';
import { exerciseName } from '../lib/exerciseName';
import { MAX_REPS, isImplausible, rankOf } from '../lib/strength';
import type { Activity, ActivityData, ActivityExercise } from './types';

// Gjør en ferdig økt om til det som deles i feeden (activities.data). Hele økta (som Hevy):
// alle øvelser og fullførte sets, rekorder, muskler og volum. Aldri kroppsvekt.

export interface BuildContext {
  /** Kroppsvekten brukes bare til å skille ut tastefeil; den sendes ikke. */
  bw: number;
  sex: Sex | null;
  /** Styrkenivået nå (etter økta). */
  tier: { index: number; score: number } | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Beste beregnede 1RM per løft som teller i styrkenivået (til løftutfordringer).
 * Løft der kroppsvekten er med i tallet (pull-ups, dips) utelates, ellers kunne kroppsvekten regnes ut.
 */
export function liftsOf(sets: (WorkoutSet | (Pick<WorkoutSet, 'exercise_id' | 'weight' | 'reps' | 'set_type' | 'completed_at'>))[], bw: number, sex: Sex | null): Record<string, number> {
  const best: Record<string, number> = {};
  for (const s of sets) {
    const rank = rankOf(s.exercise_id);
    if (!rank || rank.load === 'bw' || !countsAsWork(s) || s.reps > MAX_REPS || isImplausible(s, bw, sex)) continue;
    const e = estimate1RM(s.weight, s.reps);
    if (e > (best[s.exercise_id] ?? 0)) best[s.exercise_id] = r1(e);
  }
  return best;
}

export async function buildActivity(workoutId: string, ctx: BuildContext): Promise<Omit<Activity, 'user_id' | 'created_at' | 'updated_at'> | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout || workout.deleted || !workout.ended_at) return null;
  const sets = (await setsForWorkout(workoutId)).filter((s) => s.completed_at);
  if (!sets.length) return null;
  const wes = await workoutExercises(workoutId);
  const exMap = new Map((await db.exercises.bulkGet([...new Set(wes.map((w) => w.exercise_id))])).filter((e) => !!e).map((e) => [e!.id, e!]));
  // Rekorder regnes mot all historikk (som ellers i appen).
  const prMap = computePRMap((await db.sets.where('exercise_id').anyOf([...exMap.keys()]).toArray()).filter((s) => !s.deleted));

  const exercises: ActivityExercise[] = wes
    .map((we) => {
      const ex = exMap.get(we.exercise_id);
      const own = sets.filter((s) => s.workout_exercise_id === we.id).sort((a, b) => a.position - b.position);
      return {
        exercise_id: we.exercise_id,
        name: exerciseName(ex),
        kind: ex?.kind ?? kindOf(we.exercise_id),
        muscle_group: ex?.muscle_group ?? 'Annet',
        sets: own.map((s) => ({
          weight: r1(s.weight),
          reps: s.reps,
          ...(s.distance_km ? { distance_km: s.distance_km } : {}),
          set_type: s.set_type,
          ...(prMap.has(s.id) ? { pr: true } : {}),
        })),
      };
    })
    .filter((e) => e.sets.length > 0);

  const work = sets.filter(countsAsWork);
  const muscles: Record<string, number> = {};
  for (const s of work) {
    const ex = exMap.get(s.exercise_id);
    if (!ex) continue;
    muscles[ex.muscle_group] = (muscles[ex.muscle_group] ?? 0) + 1;
    for (const g of guideFor(s.exercise_id)?.secondary ?? []) if (g !== ex.muscle_group) muscles[g] = (muscles[g] ?? 0) + 0.5;
  }

  const records = exercises
    .map((e) => {
      const kinds = [...new Set(sets.filter((s) => s.exercise_id === e.exercise_id).flatMap((s) => prMap.get(s.id) ?? []))];
      return { exercise_id: e.exercise_id, name: e.name, kinds };
    })
    .filter((r) => r.kinds.length > 0);

  const data: ActivityData = {
    version: 1,
    duration_s: Math.max(0, Math.round((Date.parse(workout.ended_at) - Date.parse(workout.started_at)) / 1000)),
    sets: work.length,
    reps: work.filter((s) => ['weight', 'bodyweight'].includes(kindOf(s.exercise_id))).reduce((n, s) => n + s.reps, 0),
    volume_kg: Math.round(volume(sets)),
    exercises,
    records,
    muscles,
    lifts: liftsOf(sets, ctx.bw, ctx.sex),
    tier: ctx.tier,
  };
  return { id: workout.id, name: workout.name.slice(0, 120), started_at: workout.started_at, ended_at: workout.ended_at, data };
}
