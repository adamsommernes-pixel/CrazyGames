import Dexie, { type EntityTable } from 'dexie';
import type {
  Bodyweight,
  Exercise,
  KV,
  Profile,
  Routine,
  RoutineExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types';
import { BUILTIN_EXERCISES } from './exercises';

/** Én database per konto, så dataene til ulike brukere på samme enhet holdes helt adskilt. */
export class GymDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routine_exercises!: EntityTable<RoutineExercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workout_exercises!: EntityTable<WorkoutExercise, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  profiles!: EntityTable<Profile, 'id'>;
  bodyweights!: EntityTable<Bodyweight, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, muscle_group, custom, dirty',
      routines: 'id, name, dirty',
      routine_exercises: 'id, routine_id, exercise_id, dirty',
      workouts: 'id, started_at, ended_at, routine_id, dirty',
      workout_exercises: 'id, workout_id, exercise_id, dirty',
      sets: 'id, workout_exercise_id, workout_id, exercise_id, completed_at, dirty',
      profiles: 'id, dirty',
      bodyweights: 'id, date, dirty',
      kv: 'key',
    });
    // Innebygde øvelser legges inn når databasen lages.
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(BUILTIN_EXERCISES);
    });
    // Ved hver åpning: legg til nye innebygde øvelser og oppdater endrede (f.eks. type),
    // så kontoer laget med et eldre bibliotek også får dem. Egne øvelser røres ikke.
    this.on('ready', (vip) => syncBuiltins(vip as GymDB));
  }
}

export async function syncBuiltins(gym: GymDB) {
  const existing = new Map((await gym.table<Exercise>('exercises').toArray()).map((e) => [e.id, e]));
  const changed = BUILTIN_EXERCISES.filter((b) => {
    const e = existing.get(b.id);
    if (!e) return true;
    if (e.custom) return false;
    return e.name !== b.name || e.muscle_group !== b.muscle_group || e.equipment !== b.equipment || e.kind !== b.kind;
  });
  // Behold slettet-status om brukeren har skjult en innebygd øvelse.
  if (changed.length) await gym.table('exercises').bulkPut(changed.map((b) => ({ ...b, deleted: existing.get(b.id)?.deleted ?? 0 })));
}

export const userDbName = (userId: string) => `gym-${userId}`;

/**
 * Databasen til innlogget bruker. Levende binding: alle moduler som importerer `db`
 * ser den nye verdien etter `openUserDb`. Appen remountes ved brukerbytte.
 */
export let db = new GymDB('gym-none');

export function openUserDb(userId: string): GymDB {
  const name = userDbName(userId);
  if (db.name !== name) {
    db.close();
    db = new GymDB(name);
  }
  return db;
}

export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();
