import type { ExerciseKind } from '../db/types';
import { kindOf } from './kinds';

export interface SetLike {
  weight: number;
  reps: number;
  set_type?: string;
  completed_at?: string | null;
  /** Når den finnes, brukes den til å slå opp øvelsestypen (volum teller bare kg × reps). */
  exercise_id?: string;
  distance_km?: number | null;
}

/** Beregnet 1RM etter Epley. Ett rep = selve vekten. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Sets som teller: fullført, ikke oppvarming, og med reps/tid (eller distanse). */
export function countsAsWork(s: SetLike): boolean {
  return !!s.completed_at && s.set_type !== 'warmup' && (s.reps > 0 || (s.distance_km ?? 0) > 0);
}

const isWeightKind = (s: SetLike) => !s.exercise_id || kindOf(s.exercise_id) === 'weight';

/** Løftet vekt (kg × reps). Bare øvelser av typen vekt × reps teller. */
export function volume(sets: SetLike[]): number {
  return sets.filter((s) => countsAsWork(s) && isWeightKind(s)).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function heaviest(sets: SetLike[]): number {
  return sets.filter(countsAsWork).reduce((m, s) => Math.max(m, s.weight), 0);
}

export function best1RM(sets: SetLike[]): number {
  return sets.filter(countsAsWork).reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0);
}

export type PRKind = 'weight' | '1rm' | 'reps' | 'time' | 'distance';

export const PR_LABEL: Record<PRKind, string> = {
  weight: 'Tyngste',
  '1rm': 'Beste 1RM',
  reps: 'Flest reps',
  time: 'Lengst tid',
  distance: 'Lengst distanse',
};

const EPS = 1e-9;

/**
 * Hvilke rekorder settet slår, sammenlignet med alle tidligere sets på samme øvelse.
 * Vekt × reps: tyngste, beste 1RM og flest reps på denne vekten eller tyngre.
 * Kroppsvekt: flest reps (på samme eller mer ekstra vekt) og tyngste ekstra vekt.
 * Tid: lengst tid i ett set. Kondisjon: lengst distanse i ett set.
 * Første gang en øvelse logges gir ingen PR, ellers blir alt en rekord.
 */
export function detectPRs(set: SetLike, prior: SetLike[], kind: ExerciseKind = 'weight'): PRKind[] {
  if (!countsAsWork(set)) return [];
  const work = prior.filter(countsAsWork);
  if (work.length === 0) return [];
  const prs: PRKind[] = [];

  if (kind === 'time') {
    if (set.reps > Math.max(...work.map((s) => s.reps)) + EPS) prs.push('time');
    return prs;
  }
  if (kind === 'cardio') {
    const d = set.distance_km ?? 0;
    if (d > 0 && d > Math.max(...work.map((s) => s.distance_km ?? 0)) + EPS) prs.push('distance');
    return prs;
  }

  if (set.weight > 0 && set.weight > heaviest(work) + EPS) prs.push('weight');
  if (kind === 'weight' && estimate1RM(set.weight, set.reps) > best1RM(work) + EPS) prs.push('1rm');
  const atOrAbove = work.filter((s) => s.weight >= set.weight - EPS);
  if (atOrAbove.length > 0 && set.reps > Math.max(...atOrAbove.map((s) => s.reps))) prs.push('reps');
  return prs;
}

/**
 * PR-er for alle sets i én økt. Hvert set sammenlignes med historikken pluss
 * sets som ble fullført tidligere i samme økt, så bare ekte nye bestenoteringer merkes.
 */
export function detectPRsInOrder<T extends SetLike & { id: string }>(
  sessionSets: T[],
  history: SetLike[],
  kind: ExerciseKind = 'weight',
): Map<string, PRKind[]> {
  const result = new Map<string, PRKind[]>();
  const done = sessionSets.filter(countsAsWork).sort((a, b) => (a.completed_at! < b.completed_at! ? -1 : 1));
  const seen: SetLike[] = [...history];
  for (const s of done) {
    const prs = detectPRs(s, seen, kind);
    if (prs.length) result.set(s.id, prs);
    seen.push(s);
  }
  return result;
}
