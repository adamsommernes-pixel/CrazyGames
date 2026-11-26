import { db, now, uuid } from './dexie';
import type { Bodyweight, Exercise, Profile, Routine, RoutineExercise, SetType, Workout, WorkoutExercise, WorkoutSet } from './types';
import { TEMPLATES, pickTemplate } from './templates';
import type { Goal } from './types';
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
  // Samme rutinekobling, så «forrige gang» og rutineoppdatering virker også ved gjentakelse.
  if (old?.routine_id) {
    const w = await db.workouts.get(id);
    if (w) await db.workouts.put(touched({ ...w, routine_id: old.routine_id }));
  }
  const sets = await setsForWorkout(workoutId);
  for (const we of await workoutExercises(workoutId)) {
    const n = sets.filter((s) => s.workout_exercise_id === we.id && s.completed_at && s.set_type !== 'warmup').length;
    await addExerciseToWorkout(id, we.exercise_id, {
      restSeconds: we.rest_seconds,
      sets: Math.max(n, 1),
      reps: we.target_reps ?? undefined,
    });
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
      notes: '',
      target_reps: opts.reps ?? null,
      deleted: 0,
      updated_at: '',
      dirty: 1,
    }),
  );
  // Forhåndsutfyll med det du gjorde sist.
  const last = (await lastPerformance(exerciseId, workoutId)).filter((s) => s.set_type !== 'warmup');
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
        set_type: 'normal',
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
      set_type: prev?.set_type === 'warmup' ? 'normal' : (prev?.set_type ?? 'normal'),
      completed_at: null,
      deleted: 0,
      updated_at: '',
      dirty: 1,
    }),
  );
}

export async function updateSet(id: string, patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'set_type'>>) {
  const s = await db.sets.get(id);
  if (s) await db.sets.put(touched({ ...s, ...patch }));
}

/** Huker av eller fjerner haken. Returnerer true når settet ble fullført. */
export async function toggleSetDone(id: string): Promise<boolean> {
  const s = await db.sets.get(id);
  if (!s) return false;
  const completing = !s.completed_at;
  await db.sets.put(touched({ ...s, completed_at: completing ? now() : null }));
  if (completing && s.weight > 0) {
    // Neste tomme sets i samme øvelse får samme vekt, så man slipper å skrive den igjen.
    const later = (await db.sets.where('workout_exercise_id').equals(s.workout_exercise_id).toArray()).filter(
      (x) => !x.deleted && !x.completed_at && x.position > s.position && x.weight === 0 && x.set_type === s.set_type,
    );
    await db.sets.bulkPut(later.map((x) => touched({ ...x, weight: s.weight, reps: x.reps || s.reps })));
  }
  return completing;
}

/** Setter samme vekt (kg) på alle uferdige arbeidssett i øvelsen, f.eks. fra et progresjonsforslag. */
export async function applyWeightToPending(weId: string, weightKg: number) {
  const pending = alive(await db.sets.where('workout_exercise_id').equals(weId).toArray()).filter(
    (s) => !s.completed_at && s.set_type !== 'warmup',
  );
  await db.sets.bulkPut(pending.map((s) => touched({ ...s, weight: weightKg })));
}

/** Legger oppvarmingssett først i øvelsen. Eksisterende sets flyttes ned. */
export async function addWarmupSets(we: WorkoutExercise, warmups: { weight: number; reps: number }[]) {
  if (!warmups.length) return;
  await db.transaction('rw', db.sets, async () => {
    const existing = alive(await db.sets.where('workout_exercise_id').equals(we.id).toArray());
    await db.sets.bulkPut(existing.map((s) => touched({ ...s, position: s.position + warmups.length })));
    await db.sets.bulkAdd(
      warmups.map((w, i) =>
        touched<WorkoutSet>({
          id: uuid(),
          workout_exercise_id: we.id,
          workout_id: we.workout_id,
          exercise_id: we.exercise_id,
          position: i,
          weight: w.weight,
          reps: w.reps,
          set_type: 'warmup',
          completed_at: null,
          deleted: 0,
          updated_at: '',
          dirty: 1,
        }),
      ),
    );
  });
}

/** Hvilke rader en sletting markerte som slettet, så den kan angres nøyaktig. */
export type Removed = Partial<Record<'workouts' | 'workout_exercises' | 'sets' | 'routines' | 'routine_exercises' | 'bodyweights', string[]>>;

/** Angrer en sletting: radene blir synlige igjen (og synkes som endret). */
export async function restore(removed: Removed) {
  for (const [table, ids] of Object.entries(removed) as [keyof Removed, string[]][]) {
    if (!ids?.length) continue;
    const t = db.table(table);
    const rows = (await t.bulkGet(ids)).filter(Boolean);
    await t.bulkPut(rows.map((r) => touched({ ...r, deleted: 0 as const })));
  }
}

/** Myk-sletter radene som ikke allerede er slettet, og returnerer id-ene. */
async function softDelete<T extends { id: string; deleted: 0 | 1 }>(table: string, rows: T[]): Promise<string[]> {
  const live = rows.filter((r) => !r.deleted);
  await db.table(table).bulkPut(live.map((r) => touched({ ...r, deleted: 1 as const })));
  return live.map((r) => r.id);
}

export async function deleteSet(id: string): Promise<Removed> {
  const s = await db.sets.get(id);
  return s ? { sets: await softDelete('sets', [s]) } : {};
}

export async function setExerciseNotes(weId: string, notes: string) {
  const we = await db.workout_exercises.get(weId);
  if (we) await db.workout_exercises.put(touched({ ...we, notes }));
}

/** Endrer et set i en ferdig økt (vekt og reps). */
export async function editSet(id: string, weight: number, reps: number) {
  const s = await db.sets.get(id);
  if (s) await db.sets.put(touched({ ...s, weight, reps }));
}

export async function setExerciseRest(weId: string, seconds: number) {
  const we = await db.workout_exercises.get(weId);
  if (we) await db.workout_exercises.put(touched({ ...we, rest_seconds: seconds }));
}

export async function removeWorkoutExercise(weId: string): Promise<Removed> {
  return db.transaction('rw', db.workout_exercises, db.sets, async () => {
    const we = await db.workout_exercises.get(weId);
    if (!we) return {};
    return {
      workout_exercises: await softDelete('workout_exercises', [we]),
      sets: await softDelete('sets', await db.sets.where('workout_exercise_id').equals(weId).toArray()),
    };
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
export async function deleteWorkout(id: string): Promise<Removed> {
  return db.transaction('rw', db.workouts, db.workout_exercises, db.sets, async () => {
    const w = await db.workouts.get(id);
    return {
      workouts: w ? await softDelete('workouts', [w]) : [],
      workout_exercises: await softDelete('workout_exercises', await db.workout_exercises.where('workout_id').equals(id).toArray()),
      sets: await softDelete('sets', await db.sets.where('workout_id').equals(id).toArray()),
    };
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

export async function deleteRoutine(id: string): Promise<Removed> {
  return db.transaction('rw', db.routines, db.routine_exercises, async () => {
    const r = await db.routines.get(id);
    return {
      routines: r ? await softDelete('routines', [r]) : [],
      routine_exercises: await softDelete('routine_exercises', await db.routine_exercises.where('routine_id').equals(id).toArray()),
    };
  });
}

/** Lager en rutine av en ferdig økt. */
export async function routineFromWorkout(workoutId: string): Promise<string> {
  const w = await db.workouts.get(workoutId);
  const sets = await setsForWorkout(workoutId);
  const items: RoutineDraftItem[] = (await workoutExercises(workoutId)).map((we) => {
    const done = sets.filter((s) => s.workout_exercise_id === we.id && s.completed_at && s.set_type !== 'warmup');
    return {
      exercise_id: we.exercise_id,
      target_sets: Math.max(done.length, 1),
      target_reps: done[0]?.reps ?? 8,
      rest_seconds: we.rest_seconds,
    };
  });
  return saveRoutine({ name: w?.name ?? 'Ny rutine', notes: '' }, items);
}

// ---------- Profil ----------

export const PROFILE_COLORS = ['#2bd66b', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#facc15'];

export async function getProfile(userId: string): Promise<Profile | undefined> {
  const p = await db.profiles.get(userId);
  return p && !p.deleted ? p : undefined;
}

export async function saveProfile(userId: string, patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  const prev = await db.profiles.get(userId);
  const next = touched<Profile>({
    name: '',
    color: PROFILE_COLORS[0],
    goal: 'hypertrophy',
    weekly_target: 3,
    experience: 'beginner',
    bodyweight_kg: null,
    height_cm: null,
    birth_year: null,
    created_at: now(),
    onboarded_at: null,
    deleted: 0,
    ...prev,
    ...patch,
    id: userId,
    updated_at: '',
    dirty: 1,
  });
  await db.profiles.put(next);
  return next;
}

// ---------- Kroppsvekt ----------

export async function logBodyweight(weightKg: number, date = now()): Promise<void> {
  // Én måling per dag: samme dag erstattes.
  const day = date.slice(0, 10);
  const same = (await db.bodyweights.toArray()).find((b) => !b.deleted && b.date.slice(0, 10) === day);
  await db.bodyweights.put(
    touched<Bodyweight>({ id: same?.id ?? uuid(), date, weight_kg: weightKg, deleted: 0, updated_at: '', dirty: 1 }),
  );
}

export async function deleteBodyweight(id: string): Promise<Removed> {
  const b = await db.bodyweights.get(id);
  return b ? { bodyweights: await softDelete('bodyweights', [b]) } : {};
}

// ---------- Startrutiner ----------

/** Lager ferdige rutiner tilpasset mål og antall økter per uke. */
export async function createStarterRoutines(goal: Goal, perWeek: number): Promise<number> {
  const key = pickTemplate(perWeek);
  const scheme = goal === 'strength' ? { sets: 5, reps: 5, rest: 180 } : goal === 'endurance' ? { sets: 3, reps: 15, rest: 60 } : goal === 'general' ? { sets: 3, reps: 10, rest: 90 } : { sets: 3, reps: 10, rest: 120 };
  for (const r of TEMPLATES[key]) {
    await saveRoutine(
      { name: r.name, notes: '' },
      r.exercises.map(([exercise_id, accessory]) => ({
        exercise_id,
        target_sets: accessory ? 3 : scheme.sets,
        target_reps: accessory ? Math.max(scheme.reps, 10) : scheme.reps,
        rest_seconds: accessory ? Math.min(scheme.rest, 90) : scheme.rest,
      })),
    );
  }
  return TEMPLATES[key].length;
}

/** Rutinen som står for tur: den som er brukt minst nylig. */
export async function nextRoutine(): Promise<Routine | undefined> {
  const routines = (await db.routines.toArray()).filter((r) => !r.deleted);
  if (!routines.length) return undefined;
  const workouts = (await db.workouts.toArray()).filter((w) => !w.deleted && w.routine_id);
  const lastUsed = new Map<string, string>();
  for (const w of workouts) if (w.started_at > (lastUsed.get(w.routine_id!) ?? '')) lastUsed.set(w.routine_id!, w.started_at);
  return routines.sort((a, b) => (lastUsed.get(a.id) ?? '').localeCompare(lastUsed.get(b.id) ?? '') || a.name.localeCompare(b.name, 'nb'))[0];
}

export type { SetType };
