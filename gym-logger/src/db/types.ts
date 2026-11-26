import { t } from '../i18n';
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
  'Underarmer',
  'Bein',
  'Rumpe',
  'Mage',
  'Kondisjon',
  'Annet',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ['Stang', 'Manualer', 'Maskin', 'Kabel', 'Kroppsvekt', 'Kettlebell', 'Annet'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/**
 * Hvordan en øvelse logges:
 * - weight: kg × reps
 * - bodyweight: reps, med valgfri ekstra vekt (kg)
 * - time: sekunder (reps-feltet), med valgfri ekstra vekt
 * - cardio: minutter (reps-feltet) og distanse (distance_km)
 */
export const EXERCISE_KINDS = ['weight', 'bodyweight', 'time', 'cardio'] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];
// Etiketter er gettere, så de alltid gir teksten på gjeldende språk.
export const KIND_LABEL: Record<ExerciseKind, string> = {
  get weight() { return t('Vekt × reps', 'Weight × reps'); },
  get bodyweight() { return t('Kroppsvekt', 'Bodyweight'); },
  get time() { return t('Tid', 'Time'); },
  get cardio() { return t('Kondisjon', 'Cardio'); },
};

/** Visningsnavn for muskelgrupper. Verdiene i databasen er de norske id-ene. */
export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  get Bryst() { return t('Bryst', 'Chest'); },
  get Rygg() { return t('Rygg', 'Back'); },
  get Skuldre() { return t('Skuldre', 'Shoulders'); },
  get Biceps() { return t('Biceps', 'Biceps'); },
  get Triceps() { return t('Triceps', 'Triceps'); },
  get Underarmer() { return t('Underarmer', 'Forearms'); },
  get Bein() { return t('Bein', 'Legs'); },
  get Rumpe() { return t('Rumpe', 'Glutes'); },
  get Mage() { return t('Mage', 'Core'); },
  get Kondisjon() { return t('Kondisjon', 'Cardio'); },
  get Annet() { return t('Annet', 'Other'); },
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  get Stang() { return t('Stang', 'Barbell'); },
  get Manualer() { return t('Manualer', 'Dumbbells'); },
  get Maskin() { return t('Maskin', 'Machine'); },
  get Kabel() { return t('Kabel', 'Cable'); },
  get Kroppsvekt() { return t('Kroppsvekt', 'Bodyweight'); },
  get Kettlebell() { return t('Kettlebell', 'Kettlebell'); },
  get Annet() { return t('Annet', 'Other'); },
};

export const LEVEL_LABEL: Record<'Nybegynner' | 'Middels' | 'Avansert', string> = {
  get Nybegynner() { return t('Nybegynner', 'Beginner'); },
  get Middels() { return t('Middels', 'Intermediate'); },
  get Avansert() { return t('Avansert', 'Advanced'); },
};

export interface Exercise extends Row {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  /** 0 = innebygd (synkes ikke), 1 = laget av brukeren. */
  custom: Flag;
  /** Mangler på eldre rader: tolkes som 'weight'. */
  kind?: ExerciseKind;
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
  /** Alltid lagret i kg. For tid og kroppsvekt: ekstra vekt. */
  weight: number;
  /** Reps, eller sekunder (tid) eller minutter (kondisjon). */
  reps: number;
  /** Bare for kondisjon. */
  distance_km?: number | null;
  set_type: SetType;
  completed_at: string | null;
}

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];
export const SET_TYPE_LABEL: Record<SetType, string> = {
  get normal() { return t('Vanlig', 'Normal'); },
  get warmup() { return t('Oppvarming', 'Warm-up'); },
  get drop() { return t('Drop-set', 'Drop set'); },
  get failure() { return t('Til feil', 'To failure'); },
};
/** Kort merke i set-kolonnen. Vanlige sets viser nummeret i stedet. */
// «W» for oppvarming (warm-up) som i de fleste treningsapper; «O» ligner for mye på 0.
export const SET_TYPE_SHORT: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };

export const GOALS = ['strength', 'hypertrophy', 'general', 'endurance'] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABEL: Record<Goal, string> = {
  get strength() { return t('Bli sterkere', 'Get stronger'); },
  get hypertrophy() { return t('Bygge muskler', 'Build muscle'); },
  get general() { return t('Generell form', 'General fitness'); },
  get endurance() { return t('Utholdenhet', 'Endurance'); },
};

export const EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;
export type Experience = (typeof EXPERIENCE)[number];
export const EXPERIENCE_LABEL: Record<Experience, string> = {
  get beginner() { return t('Nybegynner', 'Beginner'); },
  get intermediate() { return t('Litt erfaren', 'Some experience'); },
  get advanced() { return t('Erfaren', 'Experienced'); },
};

/** Én rad per konto, med id = bruker-id. */
export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];
export const SEX_LABEL: Record<Sex, string> = {
  get male() { return t('Mann', 'Male'); },
  get female() { return t('Kvinne', 'Female'); },
};

export interface Profile extends Row {
  name: string;
  color: string;
  goal: Goal;
  weekly_target: number;
  experience: Experience;
  bodyweight_kg: number | null;
  height_cm: number | null;
  birth_year: number | null;
  /** Valgfritt. Brukes bare til standardene for styrkenivå. */
  sex?: Sex | null;
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
