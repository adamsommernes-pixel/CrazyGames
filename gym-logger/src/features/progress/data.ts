import type { Workout, WorkoutSet } from '../../db/types';
import { best1RM, countsAsWork, heaviest, volume } from '../../lib/calc';

export interface SessionPoint {
  workoutId: string;
  date: string;
  heaviest: number;
  e1rm: number;
  volume: number;
  /** Flest reps (eller sekunder/minutter) i ett set. */
  maxReps: number;
  /** Sum av reps (eller sekunder/minutter) i økta. */
  totalReps: number;
  /** Sum av distanse (km) i økta. */
  distance: number;
  bestSet: WorkoutSet;
  sets: WorkoutSet[];
}

/** Ett punkt per ferdig økt der øvelsen ble gjort, eldste først. */
export function sessionsForExercise(sets: WorkoutSet[], workouts: Map<string, Workout>): SessionPoint[] {
  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (s.deleted || !countsAsWork(s)) continue;
    const w = workouts.get(s.workout_id);
    if (!w || w.deleted || !w.ended_at) continue;
    const list = byWorkout.get(s.workout_id) ?? [];
    list.push(s);
    byWorkout.set(s.workout_id, list);
  }
  return [...byWorkout.entries()]
    .map(([workoutId, list]) => {
      const sorted = [...list].sort((a, b) => a.position - b.position);
      const bestSet = sorted.reduce((b, s) => (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b));
      return {
        workoutId,
        date: workouts.get(workoutId)!.started_at,
        heaviest: heaviest(list),
        e1rm: best1RM(list),
        volume: volume(list),
        maxReps: Math.max(...list.map((s) => s.reps)),
        totalReps: list.reduce((t, s) => t + s.reps, 0),
        distance: list.reduce((t, s) => t + (s.distance_km ?? 0), 0),
        bestSet,
        sets: sorted,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
