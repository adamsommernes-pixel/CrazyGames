import { db, now, uuid } from './dexie';
import type { Exercise, Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet } from './types';
import { getSetting } from '../lib/settings';
import { defaultWorkoutName } from '../lib/format';

/** Markerer en rad som endret, så den blir med i neste synk. */
function touched<T extends object>(row: T): T & { updated_at: string; dirty: 1 } {
  return { ...row, updated_at: now(), dirty: 1 };
}

const alive = <T extends { deleted: 0 | 1 }>(rows: T[]) => rows.filter((r) => !r.deleted);

// ---------- Oppslag ----------

export async function getActiveWorkout(): Promise<Workout | undefined> {
  const open = await db.workouts.filter((w) => !w.deleted && w.ended_at === null).toArray();
  return open.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
}

export async function workoutExercises(workoutId: string): Promise<WorkoutExercise[]> {
  const rows = alive(await db.workout_exercises.where('workout_id').equals(workoutId).toArray());
  return rows.sort((a, b) => a.position - b.position);
}

export async function setsForWorkout(workoutId: string): Promise<WorkoutSet[]> {
  return alive(await db.sets.where('workout_id').equals(workoutId).toArray());
}

/** Fullførte sets fra forrige ferdige økt med denne øvelsen. */
export async function lastPerformance(exerciseId: string, excludeWorkoutId?: string): Promise<WorkoutSet[]> {
  const sets = alive(await db.sets.where('exercise_id').equals(exerciseId).toArray()).filter(
    (s) => s.completed_at && s.workout_id !== excludeWorkoutId,
  );
  if (!sets.length) return [];
  const workoutIds = [...new Set(sets.map((s) => s.workout_id))];
  const workouts = alive((await db.workouts.bulkGet(workoutIds)).filter(Boolean) as Workout[]).filter(
    (w) => w.ended_at,
  );
  const latest = workouts.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
  if (!latest) return [];
  return sets.filter((s) => s.workout_id === latest.id).sort((a, b) => a.position - b.position);
}

// ---------- Økter ----------

export async function startWorkout(opts: { routineId?: string; name?: string } = {}): Promise<string> {
  const existing = await getActiveWorkout();
  if (existing) return existing.id;

  const id = uuid();
  let name = opts.name ?? defaultWorkoutName();
  let items: Pick<RoutineExercise, 'exercise_id' | 'target_sets' | 'target_reps' | 'rest_seconds'>[] = [];
  if (opts.routineId) {
    const routine = await db.routines.get(opts.routineId);
    if (routine) name = routine.name;
    items = (await routineItems(opts.routineId)).map((r) => r);
  }
  await db.workouts.add(
    touched<Workout>({
      id,
      routine_id: opts.routineId ?? null,
      name,
      started_at: now(),
      ended_at: null,
      notes: '',
      deleted: 0,
      updated_at: '',
      dirty: 1,
    }),
  );
  for (const item of items) {
    await addExerciseToWorkout(id, item.exercise_id, {
      restSeconds: item.rest_seconds,
      sets: item.target_sets,
      reps: item.target_reps,
    });
  }
  return id;
}

/** Starter en ny økt med samme øvelser og antall sets som en tidligere økt. */
export async function repeatWorkout(workoutId: string): Promise<string> {
  const old = await db.workouts.get(workoutId);
  const active = await getActiveWorkout();
  if (active) return active.id;
  const id = await startWorkout({ name: old?.name ?? defaultWorkoutName() });
  const sets = await setsForWorkout(workoutId);
  for (const we of await workoutExercises(workoutId)) {
    const n = sets.filter((s) => s.workout_exercise_id === we.id && s.completed_at).length;
    await addExerciseToWorkout(id, we.exercise_id, { restSeconds: we.rest_seconds, sets: Math.max(n, 1) });
  }
  return id;
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  opts: { restSeconds?: number; sets?: number; reps?: number } = {},
): Promise<void> {
  const existing = await workoutExercises(workoutId);
  const weId = uuid();
  const rest = opts.restSeconds ?? (await getSetting('defaultRest'));
  await db.workout_exercises.add(
    touched<WorkoutExercise>({
      id: weId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      position: existing.length ? Math.max(...existing.map((e) => e.position)) + 1 : 0,
      rest_seconds: rest,
      deleted: 0,
      updated_at: '',
      dirty: 1,
    }),
  );
  // Forhåndsutfyll med det du gjorde sist.
  const last = (await lastPerformance(exerciseId, workoutId)).filter((s) => !s.is_warmup);
  const count = opts.sets ?? Math.max(last.length, 3);
  const rows: WorkoutSet[] = [];
  for (let i = 0; i < count; i++) {
    const ref = last[i] ?? last[last.length - 1];
    rows.push(
      touched<WorkoutSet>({
        id: uuid(),
        workout_exercise_id: weId,
        workout_id: workoutId,
        exercise_id: exerciseId,
        position: i,
        weight: ref?.weight ?? 0,
        reps: opts.reps ?? ref?.reps ?? 0,
        is_warmup: 0,
        completed_at: null,
        deleted: 0,
        updated_at: '',
        dirty: 1,
      }),
    );
  }
  await db.sets.bulkAdd(rows);
}

export async function addSet(we: WorkoutExercise): Promise<void> {
  const sets = alive(await db.sets.where('workout_exercise_id').equals(we.id).toArray()).sort(
    (a, b) => a.position - b.position,
  );
  const prev = sets[sets.length - 1];
  await db.sets.add(
    touched<WorkoutSet>({
      id: uuid(),
      workout_exercise_id: we.id,
      workout_id: we.workout_id,
      exercise_id: we.exercise_id,
      position: prev ? prev.position + 1 : 0,
      weight: prev?.weight ?? 0,
      reps: prev?.reps ?? 0,
      is_warmup: 0,
      completed_at: null,
      deleted: 0,
      updated_at: '',
      dirty: 1,
    }),
  );
}

export async function updateSet(id: string, patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'is_warmup'>>) {
  const s = await db.sets.get(id);
  if (s) await db.sets.put(touched({ ...s, ...patch }));
}

/** Huker av eller fjerner haken. Returnerer true når settet ble fullført. */
export async function toggleSetDone(id: string): Promise<boolean> {
  const s = await db.sets.get(id);
  if (!s) return false;
  const completing = !s.completed_at;
  await db.sets.put(touched({ ...s, completed_at: completing ? now() : null }));
  return completing;
}

export async function deleteSet(id: string) {
  const s = await db.sets.get(id);
  if (s) await db.sets.put(touched({ ...s, deleted: 1 }));
}

export async function setExerciseRest(weId: string, seconds: number) {
  const we = await db.workout_exercises.get(weId);
  if (we) await db.workout_exercises.put(touched({ ...we, rest_seconds: seconds }));
}

export async function removeWorkoutExercise(weId: string) {
  await db.transaction('rw', db.workout_exercises, db.sets, async () => {
    const we = await db.workout_exercises.get(weId);
    if (!we) return;
    await db.workout_exercises.put(touched({ ...we, deleted: 1 }));
    const sets = await db.sets.where('workout_exercise_id').equals(weId).toArray();
    await db.sets.bulkPut(sets.map((s) => touched({ ...s, deleted: 1 as const })));
  });
}

export async function moveWorkoutExercise(workoutId: string, weId: string, dir: -1 | 1) {
  const list = await workoutExercises(workoutId);
  const i = list.findIndex((e) => e.id === weId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = list[i];
  const b = list[j];
  await db.workout_exercises.bulkPut([touched({ ...a, position: b.position }), touched({ ...b, position: a.position })]);
}

export async function renameWorkout(id: string, name: string) {
  const w = await db.workouts.get(id);
  if (w) await db.workouts.put(touched({ ...w, name }));
}

export async function setWorkoutNotes(id: string, notes: string) {
  const w = await db.workouts.get(id);
  if (w) await db.workouts.put(touched({ ...w, notes }));
}

/**
 * Avslutter økta. Sets som ikke er huket av fjernes, og øvelser uten fullførte sets fjernes.
 * Returnerer false (og gjør ingenting) hvis ingen sets er fullført.
 */
export async function finishWorkout(id: string): Promise<boolean> {
  const sets = await setsForWorkout(id);
  if (!sets.some((s) => s.completed_at)) return false;
  await db.transaction('rw', db.workouts, db.workout_exercises, db.sets, async () => {
    const pending = sets.filter((s) => !s.completed_at);
    await db.sets.bulkPut(pending.map((s) => touched({ ...s, deleted: 1 as const })));
    const doneWe = new Set(sets.filter((s) => s.completed_at).map((s) => s.workout_exercise_id));
    for (const we of await workoutExercises(id)) {
      if (!doneWe.has(we.id)) await db.workout_exercises.put(touched({ ...we, deleted: 1 }));
    }
    const w = await db.workouts.get(id);
    if (w) await db.workouts.put(touched({ ...w, ended_at: now() }));
  });
  return true;
}

/** Sletter en økt med alt innhold (myk sletting). */
export async function deleteWorkout(id: string) {
  await db.transaction('rw', db.workouts, db.workout_exercises, db.sets, async () => {
    const w = await db.workouts.get(id);
    if (w) await db.workouts.put(touched({ ...w, deleted: 1 }));
    const wes = await db.workout_exercises.where('workout_id').equals(id).toArray();
    await db.workout_exercises.bulkPut(wes.map((r) => touched({ ...r, deleted: 1 as const })));
    const sets = await db.sets.where('workout_id').equals(id).toArray();
    await db.sets.bulkPut(sets.map((r) => touched({ ...r, deleted: 1 as const })));
  });
}

// ---------- Øvelser ----------

export async function createExercise(e: Pick<Exercise, 'name' | 'muscle_group' | 'equipment'>): Promise<string> {
  const id = uuid();
  await db.exercises.add(touched<Exercise>({ ...e, id, custom: 1, deleted: 0, updated_at: '', dirty: 1 }));
  return id;
}

// ---------- Rutiner ----------

export async function routineItems(routineId: string): Promise<RoutineExercise[]> {
  const rows = alive(await db.routine_exercises.where('routine_id').equals(routineId).toArray());
  return rows.sort((a, b) => a.position - b.position);
}

export interface RoutineDraftItem {
  id?: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  rest_seconds: number;
}

export async function saveRoutine(
  routine: { id?: string; name: string; notes: string },
  items: RoutineDraftItem[],
): Promise<string> {
  const id = routine.id ?? uuid();
  await db.transaction('rw', db.routines, db.routine_exercises, async () => {
    const prev = await db.routines.get(id);
    await db.routines.put(
      touched<Routine>({ ...(prev ?? { deleted: 0 }), id, name: routine.name, notes: routine.notes, updated_at: '', dirty: 1 }),
    );
    const old = await routineItems(id);
    const keep = new Set(items.map((i) => i.id).filter(Boolean));
    await db.routine_exercises.bulkPut(
      old.filter((o) => !keep.has(o.id)).map((o) => touched({ ...o, deleted: 1 as const })),
    );
    await db.routine_exercises.bulkPut(
      items.map((item, position) =>
        touched<RoutineExercise>({
          id: item.id ?? uuid(),
          routine_id: id,
          exercise_id: item.exercise_id,
          position,
          target_sets: item.target_sets,
          target_reps: item.target_reps,
          rest_seconds: item.rest_seconds,
          deleted: 0,
          updated_at: '',
          dirty: 1,
        }),
      ),
    );
  });
  return id;
}

export async function deleteRoutine(id: string) {
  await db.transaction('rw', db.routines, db.routine_exercises, async () => {
    const r = await db.routines.get(id);
    if (r) await db.routines.put(touched({ ...r, deleted: 1 }));
    const items = await db.routine_exercises.where('routine_id').equals(id).toArray();
    await db.routine_exercises.bulkPut(items.map((i) => touched({ ...i, deleted: 1 as const })));
  });
}

/** Lager en rutine av en ferdig økt. */
export async function routineFromWorkout(workoutId: string): Promise<string> {
  const w = await db.workouts.get(workoutId);
  const sets = await setsForWorkout(workoutId);
  const items: RoutineDraftItem[] = (await workoutExercises(workoutId)).map((we) => {
    const done = sets.filter((s) => s.workout_exercise_id === we.id && s.completed_at && !s.is_warmup);
    return {
      exercise_id: we.exercise_id,
      target_sets: Math.max(done.length, 1),
      target_reps: done[0]?.reps ?? 8,
      rest_seconds: we.rest_seconds,
    };
  });
  return saveRoutine({ name: w?.name ?? 'Ny rutine', notes: '' }, items);
}
