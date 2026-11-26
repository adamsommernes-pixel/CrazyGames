import type { Equipment, ExerciseKind, MuscleGroup } from '../types';

export type Level = 'Nybegynner' | 'Middels' | 'Avansert';

/** Fremgangsmåte for en øvelse: hvordan den gjøres, hva man skal tenke på og vanlige feil. */
export interface Guide {
  steps: string[];
  tips: string[];
  mistakes: string[];
  /** Muskler som også jobber (hovedmuskelen er øvelsens muskelgruppe). */
  secondary: MuscleGroup[];
  level: Level;
}

export interface LibraryEntry {
  /** Fast id uten «ex-»-prefiks. Må aldri endres: historikk og rutiner peker på den. */
  slug: string;
  name: string;
  group: MuscleGroup;
  equipment: Equipment;
  kind: ExerciseKind;
  guide: Guide;
}

/** Kort skrivemåte for oppføringer i biblioteket. */
export function ex(
  slug: string,
  name: string,
  group: MuscleGroup,
  equipment: Equipment,
  kind: ExerciseKind,
  level: Level,
  secondary: MuscleGroup[],
  steps: string[],
  tips: string[],
  mistakes: string[],
): LibraryEntry {
  return { slug, name, group, equipment, kind, guide: { steps, tips, mistakes, secondary, level } };
}
