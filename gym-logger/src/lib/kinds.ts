import { BUILTIN_EXERCISES } from '../db/exercises';
import type { Exercise, ExerciseKind } from '../db/types';
import { duration, num, toDisplay } from './format';

// Hvilken type hver øvelse er. Innebygde er kjent på forhånd; egne registreres når de lastes.
const kinds = new Map<string, ExerciseKind>(BUILTIN_EXERCISES.map((e) => [e.id, e.kind ?? 'weight']));

export function registerKinds(list: Pick<Exercise, 'id' | 'kind'>[]) {
  for (const e of list) kinds.set(e.id, e.kind ?? 'weight');
}

export const kindOf = (exerciseId: string): ExerciseKind => kinds.get(exerciseId) ?? 'weight';

/** Kolonnenavn og felt for de to tallfeltene i en set-rad. */
export function kindColumns(kind: ExerciseKind, unit: 'kg' | 'lbs') {
  switch (kind) {
    case 'bodyweight':
      return { first: `+${unit}`, second: 'Reps' };
    case 'time':
      return { first: `+${unit}`, second: 'Sek' };
    case 'cardio':
      return { first: 'Km', second: 'Min' };
    default:
      return { first: unit, second: 'Reps' };
  }
}

interface SetValues {
  weight: number;
  reps: number;
  distance_km?: number | null;
}

/** Et set som tekst, tilpasset øvelsestypen: «100 kg × 5», «12 reps», «1:00», «30 min · 5 km». */
export function formatSet(s: SetValues, kind: ExerciseKind, unit: 'kg' | 'lbs'): string {
  const extra = s.weight > 0 ? `+${num(toDisplay(s.weight, unit))} ${unit}` : '';
  switch (kind) {
    case 'bodyweight':
      return extra ? `${extra} × ${s.reps}` : `${s.reps} reps`;
    case 'time':
      return [extra, duration(s.reps * 1000)].filter(Boolean).join(' · ');
    case 'cardio':
      return [`${s.reps} min`, s.distance_km ? `${num(s.distance_km, 2)} km` : ''].filter(Boolean).join(' · ');
    default:
      return `${num(toDisplay(s.weight, unit))} ${unit} × ${s.reps}`;
  }
}

/** Kort variant uten enhet for trange kolonner («100 × 5», «12», «1:00», «30′ 5 km»). */
export function formatSetShort(s: SetValues, kind: ExerciseKind, unit: 'kg' | 'lbs'): string {
  switch (kind) {
    case 'bodyweight':
      return s.weight > 0 ? `+${num(toDisplay(s.weight, unit))} × ${s.reps}` : `${s.reps}`;
    case 'time':
      return duration(s.reps * 1000);
    case 'cardio':
      return s.distance_km ? `${num(s.distance_km, 1)} km` : `${s.reps} min`;
    default:
      return `${num(toDisplay(s.weight, unit))} × ${s.reps}`;
  }
}
