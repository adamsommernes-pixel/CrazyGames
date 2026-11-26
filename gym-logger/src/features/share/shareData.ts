import { db } from '../../db/dexie';
import { setsForWorkout, workoutExercises } from '../../db/repo';
import type { Exercise, MuscleGroup } from '../../db/types';
import { countsAsWork, estimate1RM, volume, type PRKind } from '../../lib/calc';
import { durationShort, dateLong, num, toDisplay } from '../../lib/format';
import { formatSetShort, kindOf } from '../../lib/kinds';
import { exerciseName } from '../../lib/exerciseName';
import { guideFor } from '../../db/library';
import type { StrengthProfile } from '../../lib/strength';

// Alt et delekort trenger, ferdig formatert i gjeldende språk og enhet.

export interface ShareExercise {
  name: string;
  sets: { text: string; pr: boolean }[];
  top: string | null;
}

export interface ShareData {
  name: string;
  date: string;
  duration: string;
  sets: number;
  reps: number;
  volume: string;
  unit: string;
  exercises: ShareExercise[];
  prs: { exercise: string; text: string }[];
  heaviest: { exercise: string; text: string } | null;
  volumeDiff: number | null;
  /** 0–4 per muskelgruppe i denne økta (hovedmuskel 1, sekundær 0,5 per set). */
  muscles: Partial<Record<MuscleGroup, number>>;
  tier: { index: number; name: string; score: number; progress: number } | null;
}

/** Nivå 0–4 for en muskelgruppe ut fra arbeidssett i én økt. */
const workoutLevel = (sets: number) => (sets <= 0 ? 0 : sets < 3 ? 1 : sets < 6 ? 2 : sets < 10 ? 3 : 4);

export async function buildShareData(
  workoutId: string,
  exMap: Map<string, Exercise>,
  prMap: Map<string, PRKind[]>,
  unit: 'kg' | 'lbs',
  strength?: StrengthProfile,
): Promise<ShareData | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) return null;
  const sets = (await setsForWorkout(workoutId)).filter((s) => s.completed_at && !s.deleted);
  const wes = await workoutExercises(workoutId);
  const work = sets.filter(countsAsWork);

  const exercises: ShareExercise[] = wes
    .map((we) => {
      const own = sets.filter((s) => s.workout_exercise_id === we.id).sort((a, b) => a.position - b.position);
      const kind = kindOf(we.exercise_id);
      const best = own
        .filter(countsAsWork)
        .sort((a, b) => (kind === 'weight' ? estimate1RM(b.weight, b.reps) - estimate1RM(a.weight, a.reps) : b.weight - a.weight || b.reps - a.reps))[0];
      return {
        name: exerciseName(exMap.get(we.exercise_id)),
        sets: own.map((s) => ({ text: formatSetShort(s, kindOf(s.exercise_id), unit), pr: prMap.has(s.id) })),
        top: best ? formatSetShort(best, kind, unit) : null,
      };
    })
    .filter((e) => e.sets.length > 0);

  const prs = sets
    .filter((s) => prMap.has(s.id))
    .map((s) => ({ exercise: exerciseName(exMap.get(s.exercise_id)), text: formatSetShort(s, kindOf(s.exercise_id), unit) }));

  const weighted = work.filter((s) => kindOf(s.exercise_id) === 'weight' && s.weight > 0).sort((a, b) => b.weight - a.weight)[0];

  const muscleSets: Partial<Record<MuscleGroup, number>> = {};
  for (const s of work) {
    const ex = exMap.get(s.exercise_id);
    if (!ex) continue;
    muscleSets[ex.muscle_group] = (muscleSets[ex.muscle_group] ?? 0) + 1;
    for (const g of guideFor(s.exercise_id)?.secondary ?? []) if (g !== ex.muscle_group) muscleSets[g] = (muscleSets[g] ?? 0) + 0.5;
  }
  const muscles: Partial<Record<MuscleGroup, number>> = {};
  for (const [g, n] of Object.entries(muscleSets)) muscles[g as MuscleGroup] = workoutLevel(n);

  const earlier = (await db.workouts.toArray())
    .filter((w) => !w.deleted && w.ended_at && w.id !== workoutId && w.started_at < workout.started_at)
    .filter((w) => (workout.routine_id ? w.routine_id === workout.routine_id : w.name === workout.name))
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
  const vol = volume(sets);
  const prevVol = earlier ? volume((await setsForWorkout(earlier.id)).filter((s) => s.completed_at)) : 0;

  const ms = workout.ended_at ? new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime() : 0;
  return {
    name: workout.name,
    date: dateLong(workout.started_at),
    duration: durationShort(ms),
    sets: work.length,
    reps: work.filter((s) => ['weight', 'bodyweight'].includes(kindOf(s.exercise_id))).reduce((n, s) => n + s.reps, 0),
    volume: num(toDisplay(vol, unit), 0),
    unit,
    exercises,
    prs,
    heaviest: weighted ? { exercise: exerciseName(exMap.get(weighted.exercise_id)), text: formatSetShort(weighted, 'weight', unit) } : null,
    volumeDiff: prevVol > 0 ? ((vol - prevVol) / prevVol) * 100 : null,
    muscles,
    tier: strength && strength.lifts.length ? { index: strength.tier.index, name: strength.tier.name, score: strength.score, progress: strength.progress } : null,
  };
}
