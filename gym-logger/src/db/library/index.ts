import type { Exercise } from '../types';
import type { Guide, LibraryEntry } from './types';
import { BACK, CHEST, SHOULDERS } from './upper';
import { BICEPS, FOREARMS, TRICEPS } from './arms';
import { GLUTES, LEGS } from './lower';
import { CARDIO, CORE } from './core';
import { EXTRA } from './extra';
import { EN } from './en';
import { getLang } from '../../i18n';

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
  ...EXTRA,
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
const slugOf = (exerciseId: string) => exerciseId.replace(/^ex-/, '');

/** Fremgangsmåten for en innebygd øvelse på gjeldende språk (undefined for egne øvelser). */
export function guideFor(exerciseId: string): Guide | undefined {
  const guide = GUIDES.get(exerciseId);
  if (!guide) return undefined;
  const en = getLang() === 'en' ? EN[slugOf(exerciseId)] : undefined;
  return en ? { ...guide, steps: en.steps, tips: en.tips, mistakes: en.mistakes } : guide;
}

/** Engelsk navn på en innebygd øvelse. */
export function englishName(exerciseId: string): string | undefined {
  return EN[slugOf(exerciseId)]?.name;
}

/**
 * De store basisløftene som har innarbeidede norske navn. Alle andre innebygde øvelser vises med
 * engelsk navn også på norsk (men kan fortsatt søkes opp på norsk). Kondisjon beholder norsk navn.
 */
export const NB_NAMED = new Set([
  'kneboy',
  'frontboy',
  'utfall',
  'markloft',
  'rumensk-markloft',
  'benkpress',
  'skrabenk',
  'militaerpress',
  'dips',
  'stangroing',
  'nedtrekk',
  'pull-ups',
]);

const GROUPS = new Map(LIBRARY.map((e) => [`ex-${e.slug}`, e.group]));

/** Om en innebygd øvelse beholder det norske navnet i norsk språkdrakt. */
export function keepsNorwegianName(exerciseId: string): boolean {
  return NB_NAMED.has(slugOf(exerciseId)) || GROUPS.get(exerciseId) === 'Kondisjon';
}
