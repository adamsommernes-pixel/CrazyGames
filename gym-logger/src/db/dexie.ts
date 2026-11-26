import Dexie, { type EntityTable } from 'dexie';
import type { Exercise, KV, Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet } from './types';
import { BUILTIN_EXERCISES } from './exercises';

export class GymDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routine_exercises!: EntityTable<RoutineExercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workout_exercises!: EntityTable<WorkoutExercise, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'gym-logger') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, muscle_group, custom, dirty',
      routines: 'id, name, dirty',
      routine_exercises: 'id, routine_id, exercise_id, dirty',
      workouts: 'id, started_at, ended_at, routine_id, dirty',
      workout_exercises: 'id, workout_id, exercise_id, dirty',
      sets: 'id, workout_exercise_id, workout_id, exercise_id, completed_at, dirty',
      kv: 'key',
    });
    // Innebygde øvelser legges inn ved første oppstart.
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(BUILTIN_EXERCISES);
    });
  }
}

export const db = new GymDB();

export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();
