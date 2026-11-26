import type { Exercise } from '../types';
import type { Guide, LibraryEntry } from './types';
import { BACK, CHEST, SHOULDERS } from './upper';
import { BICEPS, FOREARMS, TRICEPS } from './arms';
import { GLUTES, LEGS } from './lower';
import { CARDIO, CORE } from './core';

export type { Guide, Level, LibraryEntry } from './types';

/** Hele det innebygde øvelsesbiblioteket. */
export const LIBRARY: LibraryEntry[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...BICEPS,
  ...TRICEPS,
  ...FOREARMS,
  ...LEGS,
  ...GLUTES,
  ...CORE,
  ...CARDIO,
];

export const BUILTIN_EXERCISES: Exercise[] = LIBRARY.map((e) => ({
  id: `ex-${e.slug}`,
  name: e.name,
  muscle_group: e.group,
  equipment: e.equipment,
  kind: e.kind,
  custom: 0,
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted: 0,
  dirty: 0,
}));

const GUIDES = new Map<string, Guide>(LIBRARY.map((e) => [`ex-${e.slug}`, e.guide]));

/** Fremgangsmåten for en innebygd øvelse (undefined for egne øvelser). */
export function guideFor(exerciseId: string): Guide | undefined {
  return GUIDES.get(exerciseId);
}
