import type { Exercise, MuscleGroup, Workout, WorkoutSet } from '../db/types';
import { countsAsWork } from './calc';

const DAY = 86_400_000;

/** Mandagen i uka datoen hører til, som lokal dato «YYYY-MM-DD». */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // man = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function weekKey(d: Date | string): string {
  const w = weekStart(typeof d === 'string' ? new Date(d) : d);
  return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
}

const finished = (ws: Workout[]) => ws.filter((w) => !w.deleted && w.ended_at);

export function workoutsPerWeek(workouts: Workout[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of finished(workouts)) m.set(weekKey(w.started_at), (m.get(weekKey(w.started_at)) ?? 0) + 1);
  return m;
}

export function thisWeekCount(workouts: Workout[], now = new Date()): number {
  return workoutsPerWeek(workouts).get(weekKey(now)) ?? 0;
}

/** Hvilke dager (man–søn) denne uka det er trent. */
export function trainedDaysThisWeek(workouts: Workout[], now = new Date()): boolean[] {
  const start = weekStart(now).getTime();
  const days = Array<boolean>(7).fill(false);
  for (const w of finished(workouts)) {
    const t = new Date(w.started_at);
    const i = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - start) / DAY + 0.01);
    if (i >= 0 && i < 7) days[i] = true;
  }
  return days;
}

function prevWeek(d: Date): Date {
  const x = weekStart(d);
  x.setDate(x.getDate() - 7);
  return x;
}

/**
 * Uker på rad der ukemålet er nådd. Inneværende uke teller med når målet er nådd,
 * men bryter ikke streaken mens den pågår.
 */
export function weekStreak(workouts: Workout[], target: number, now = new Date()): number {
  const per = workoutsPerWeek(workouts);
  let streak = 0;
  let cursor = weekStart(now);
  if ((per.get(weekKey(cursor)) ?? 0) >= target) streak++;
  cursor = prevWeek(cursor);
  while ((per.get(weekKey(cursor)) ?? 0) >= target) {
    streak++;
    cursor = prevWeek(cursor);
  }
  return streak;
}

export function longestStreak(workouts: Workout[], target: number): number {
  const keys = [...workoutsPerWeek(workouts).entries()].filter(([, n]) => n >= target).map(([k]) => k).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    const expected = prev ? weekKey(new Date(new Date(prev + 'T12:00:00').getTime() + 7 * DAY)) : null;
    run = prev && expected === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Volum og antall økter per uke, eldste først, for de siste `weeks` ukene. */
export function weeklySeries(workouts: Workout[], sets: WorkoutSet[], weeks = 12, now = new Date()) {
  const ws = finished(workouts);
  const wMap = new Map(ws.map((w) => [w.id, w]));
  const vol = new Map<string, number>();
  for (const s of sets) {
    const w = wMap.get(s.workout_id);
    if (!w || s.deleted || !countsAsWork(s)) continue;
    const k = weekKey(w.started_at);
    vol.set(k, (vol.get(k) ?? 0) + s.weight * s.reps);
  }
  const per = workoutsPerWeek(ws);
  const out: { week: string; start: Date; volume: number; workouts: number }[] = [];
  let cursor = weekStart(now);
  for (let i = 0; i < weeks; i++) {
    const k = weekKey(cursor);
    out.unshift({ week: k, start: new Date(cursor), volume: vol.get(k) ?? 0, workouts: per.get(k) ?? 0 });
    cursor = prevWeek(cursor);
  }
  return out;
}

/** Antall arbeidssett per muskelgruppe de siste `days` dagene. */
export function muscleSplit(sets: WorkoutSet[], exercises: Map<string, Exercise>, days = 30, now = new Date()) {
  const since = now.getTime() - days * DAY;
  const m = new Map<MuscleGroup, number>();
  for (const s of sets) {
    if (s.deleted || !countsAsWork(s) || new Date(s.completed_at!).getTime() < since) continue;
    const g = exercises.get(s.exercise_id)?.muscle_group;
    if (g) m.set(g, (m.get(g) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function lifetime(workouts: Workout[], sets: WorkoutSet[]) {
  const ids = new Set(finished(workouts).map((w) => w.id));
  const work = sets.filter((s) => !s.deleted && countsAsWork(s) && ids.has(s.workout_id));
  return {
    workouts: ids.size,
    sets: work.length,
    volume: work.reduce((v, s) => v + s.weight * s.reps, 0),
  };
}

export interface MuscleLoad {
  /** Arbeidssett (sekundære muskler teller halvt). */
  sets: number;
  /** Sist trent (ISO), eller null. */
  last: string | null;
}

/**
 * Hvor mye hver muskelgruppe er trent i perioden: hovedmuskelen får 1 per arbeidssett,
 * muskler som også jobber (fra fremgangsmåten) får 0,5. Brukes til kroppskartet på Hjem.
 */
export function muscleLoad(
  sets: WorkoutSet[],
  exercises: Map<string, Exercise>,
  secondaryOf: (exerciseId: string) => MuscleGroup[],
  days = 7,
  now = new Date(),
): Map<MuscleGroup, MuscleLoad> {
  const since = now.getTime() - days * DAY;
  const out = new Map<MuscleGroup, MuscleLoad>();
  const add = (g: MuscleGroup, amount: number, at: string) => {
    const cur = out.get(g) ?? { sets: 0, last: null };
    out.set(g, { sets: cur.sets + amount, last: !cur.last || at > cur.last ? at : cur.last });
  };
  for (const s of sets) {
    if (s.deleted || !countsAsWork(s)) continue;
    if (new Date(s.completed_at!).getTime() < since) continue;
    const ex = exercises.get(s.exercise_id);
    if (!ex) continue;
    add(ex.muscle_group, 1, s.completed_at!);
    for (const g of secondaryOf(s.exercise_id)) if (g !== ex.muscle_group) add(g, 0.5, s.completed_at!);
  }
  return out;
}

/** 0–4: hvor mye en muskelgruppe er trent, målt i arbeidssett per uke (1–3, 4–8, 9–15, 16+). */
export function loadLevel(setsInPeriod: number, days = 7): 0 | 1 | 2 | 3 | 4 {
  const perWeek = setsInPeriod / (days / 7);
  if (perWeek <= 0) return 0;
  if (perWeek <= 3) return 1;
  if (perWeek <= 8) return 2;
  if (perWeek <= 15) return 3;
  return 4;
}
