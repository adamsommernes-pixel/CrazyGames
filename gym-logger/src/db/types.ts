// Feltnavn er snake_case så de kan synkes direkte til Supabase-tabellene.
export type Flag = 0 | 1;

export interface Row {
  id: string;
  /** Siste endring (ISO). Brukes til «siste endring vinner» ved synk. */
  updated_at: string;
  /** Myk sletting, så slettinger også synkes. */
  deleted: Flag;
  /** 1 = endret lokalt og ikke sendt til skyen ennå. */
  dirty: Flag;
}

export const MUSCLE_GROUPS = [
  'Bryst',
  'Rygg',
  'Skuldre',
  'Biceps',
  'Triceps',
  'Bein',
  'Rumpe',
  'Mage',
  'Kondisjon',
  'Annet',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ['Stang', 'Manualer', 'Maskin', 'Kabel', 'Kroppsvekt', 'Kettlebell', 'Annet'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export interface Exercise extends Row {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  /** 0 = innebygd (synkes ikke), 1 = laget av brukeren. */
  custom: Flag;
}

export interface Routine extends Row {
  name: string;
  notes: string;
}

export interface RoutineExercise extends Row {
  routine_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps: number;
  rest_seconds: number;
}

export interface Workout extends Row {
  routine_id: string | null;
  name: string;
  started_at: string;
  ended_at: string | null;
  notes: string;
}

export interface WorkoutExercise extends Row {
  workout_id: string;
  exercise_id: string;
  position: number;
  rest_seconds: number;
  notes: string;
  /** Mål-reps fra rutinen økta ble startet fra (null for egne øvelser). */
  target_reps?: number | null;
}

export interface WorkoutSet extends Row {
  workout_exercise_id: string;
  /** Kopiert inn for raske oppslag i historikk og fremgang. */
  workout_id: string;
  exercise_id: string;
  position: number;
  /** Alltid lagret i kg. */
  weight: number;
  reps: number;
  set_type: SetType;
  completed_at: string | null;
}

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];
export const SET_TYPE_LABEL: Record<SetType, string> = {
  normal: 'Vanlig',
  warmup: 'Oppvarming',
  drop: 'Drop-set',
  failure: 'Til feil',
};
/** Kort merke i set-kolonnen. Vanlige sets viser nummeret i stedet. */
export const SET_TYPE_SHORT: Record<SetType, string> = { normal: '', warmup: 'O', drop: 'D', failure: 'F' };

export const GOALS = ['strength', 'hypertrophy', 'general', 'endurance'] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABEL: Record<Goal, string> = {
  strength: 'Bli sterkere',
  hypertrophy: 'Bygge muskler',
  general: 'Generell form',
  endurance: 'Utholdenhet',
};

export const EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;
export type Experience = (typeof EXPERIENCE)[number];
export const EXPERIENCE_LABEL: Record<Experience, string> = {
  beginner: 'Nybegynner',
  intermediate: 'Litt erfaren',
  advanced: 'Erfaren',
};

/** Én rad per konto, med id = bruker-id. */
export interface Profile extends Row {
  name: string;
  color: string;
  goal: Goal;
  weekly_target: number;
  experience: Experience;
  bodyweight_kg: number | null;
  height_cm: number | null;
  birth_year: number | null;
  created_at: string;
  /** Satt når oppstartsveiviseren er fullført. */
  onboarded_at: string | null;
}

export interface Bodyweight extends Row {
  date: string;
  weight_kg: number;
}

export interface KV {
  key: string;
  value: unknown;
}

export const SYNCED_TABLES = [
  'exercises',
  'routines',
  'routine_exercises',
  'workouts',
  'workout_exercises',
  'sets',
  'profiles',
  'bodyweights',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];
