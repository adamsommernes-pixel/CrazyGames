import { db, now, uuid } from './dexie';
import type { Bodyweight, Exercise, Profile, Routine, RoutineExercise, SetType, Workout, WorkoutExercise, WorkoutSet } from './types';
import { TEMPLATES } from './templates';
import { programById, recommendedProgramId, schemeFor } from './programs';
import { SWATCHES } from '../lib/theme';
import type { Goal } from './types';
import { getSetting } from '../lib/settings';
import { defaultWorkoutName } from '../lib/format';
import { kindOf } from '../lib/kinds';
import { t } from '../i18n';

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

export async function startWorkout(opts: { routineId?: string; name?: string; startedAt?: string } = {}): Promise<string> {
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
      started_at: opts.startedAt ?? now(),
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
  // Hviletid: rutinens verdi, ellers den du sist valgte for øvelsen, ellers standard.
  const rest = opts.restSeconds ?? (await rememberedRest(exerciseId)) ?? (await getSetting('defaultRest'));
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

// Endringer på sets leser først og skriver så. De kjøres i en rw-transaksjon, slik at Dexie
// kjører dem én om gangen: en rask «fullfør» kan da ikke overskrive en vekt som akkurat ble lagret.

export async function updateSet(id: string, patch: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'set_type' | 'distance_km'>>) {
  await db.transaction('rw', db.sets, async () => {
    const s = await db.sets.get(id);
    if (s) await db.sets.put(touched({ ...s, ...patch }));
  });
}

/** Huker av eller fjerner haken. Returnerer true når settet ble fullført. */
export async function toggleSetDone(id: string): Promise<boolean> {
  return db.transaction('rw', db.sets, async () => {
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
  });
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
/**
 * Deler vekten på to for de gitte setene (for manualøvelser logget med begge manualene samlet).
 * Gir de gamle vektene tilbake, så det kan angres med restoreSetWeights.
 */
export async function halveSetWeights(ids: string[]): Promise<{ id: string; weight: number }[]> {
  const before: { id: string; weight: number }[] = [];
  await db.transaction('rw', db.sets, async () => {
    const rows = (await db.sets.bulkGet(ids)).filter((s): s is WorkoutSet => !!s && !s.deleted && s.weight > 0);
    for (const s of rows) before.push({ id: s.id, weight: s.weight });
    await db.sets.bulkPut(rows.map((s) => touched({ ...s, weight: Math.round((s.weight / 2) * 100) / 100 })));
  });
  return before;
}

export async function restoreSetWeights(prev: { id: string; weight: number }[]) {
  await db.transaction('rw', db.sets, async () => {
    for (const p of prev) {
      const s = await db.sets.get(p.id);
      if (s) await db.sets.put(touched({ ...s, weight: p.weight }));
    }
  });
}

/** Alle set (ikke slettede) for en øvelse, på tvers av økter. */
export async function setIdsForExercise(exerciseId: string): Promise<string[]> {
  return (await db.sets.where('exercise_id').equals(exerciseId).toArray()).filter((s) => !s.deleted && s.weight > 0).map((s) => s.id);
}

export type Removed = Partial<
  Record<'workouts' | 'workout_exercises' | 'sets' | 'routines' | 'routine_exercises' | 'bodyweights' | 'exercises', string[]>
>;

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
  await db.transaction('rw', db.sets, async () => {
    const s = await db.sets.get(id);
    if (s) await db.sets.put(touched({ ...s, weight, reps }));
  });
}

/** Endrer hviletiden i økta og husker den for øvelsen til neste gang. */
export async function setExerciseRest(weId: string, seconds: number) {
  const we = await db.workout_exercises.get(weId);
  if (!we) return;
  await db.workout_exercises.put(touched({ ...we, rest_seconds: seconds }));
  await db.kv.put({ key: `rest:${we.exercise_id}`, value: seconds });
}

export async function rememberedRest(exerciseId: string): Promise<number | undefined> {
  const v = (await db.kv.get(`rest:${exerciseId}`))?.value;
  return typeof v === 'number' ? v : undefined;
}

/** Notatet fra sist gang øvelsen ble gjort i en ferdig økt (f.eks. «setehøyde 4»). */
export async function lastNotes(exerciseId: string, excludeWorkoutId: string): Promise<string> {
  const wes = alive(await db.workout_exercises.where('exercise_id').equals(exerciseId).toArray()).filter(
    (we) => we.workout_id !== excludeWorkoutId && we.notes?.trim(),
  );
  if (!wes.length) return '';
  const workouts = await db.workouts.bulkGet(wes.map((we) => we.workout_id));
  const dated = wes
    .map((we, i) => ({ we, w: workouts[i] }))
    .filter((x) => x.w && !x.w.deleted && x.w.ended_at)
    .sort((a, b) => (a.w!.started_at < b.w!.started_at ? 1 : -1));
  return dated[0]?.we.notes ?? '';
}

/**
 * Bytter øvelse midt i økta (f.eks. når maskinen er opptatt). Uferdige sets beholder antallet,
 * men får vekt fra den nye øvelsens historikk. Er noen sets allerede gjort, blir de stående på
 * den gamle øvelsen, og de uferdige flyttes til en ny øvelse rett under.
 */
export async function swapWorkoutExercise(weId: string, newExerciseId: string): Promise<void> {
  const we = await db.workout_exercises.get(weId);
  if (!we || we.exercise_id === newExerciseId) return;
  const sets = alive(await db.sets.where('workout_exercise_id').equals(weId).toArray()).sort((a, b) => a.position - b.position);
  const pending = sets.filter((s) => !s.completed_at);
  const last = (await lastPerformance(newExerciseId, we.workout_id)).filter((s) => s.set_type !== 'warmup');
  const rest = (await rememberedRest(newExerciseId)) ?? we.rest_seconds;

  await db.transaction('rw', db.workout_exercises, db.sets, async () => {
    let target = we;
    if (pending.length === sets.length) {
      target = touched({ ...we, exercise_id: newExerciseId, rest_seconds: rest, notes: '' });
      await db.workout_exercises.put(target);
    } else {
      target = touched<WorkoutExercise>({
        ...we,
        id: uuid(),
        exercise_id: newExerciseId,
        position: we.position + 0.5,
        rest_seconds: rest,
        notes: '',
        updated_at: '',
        dirty: 1,
      });
      await db.workout_exercises.add(target);
    }
    await db.sets.bulkPut(
      pending.map((s, i) => {
        const ref = last[i] ?? last[last.length - 1];
        return touched({
          ...s,
          workout_exercise_id: target.id,
          exercise_id: newExerciseId,
          position: i,
          weight: ref?.weight ?? 0,
          reps: ref?.reps ?? s.reps,
          distance_km: ref?.distance_km ?? null,
        });
      }),
    );
  });
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

/** Setter ny rekkefølge på øvelsene i en økt (id-er i ønsket rekkefølge). */
export async function setWorkoutExerciseOrder(workoutId: string, ids: string[]) {
  const list = await workoutExercises(workoutId);
  const changed = list
    .map((we) => ({ we, pos: ids.indexOf(we.id) }))
    .filter(({ we, pos }) => pos >= 0 && we.position !== pos)
    .map(({ we, pos }) => touched({ ...we, position: pos }));
  if (changed.length) await db.workout_exercises.bulkPut(changed);
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
export async function finishWorkout(id: string, endedAt?: string): Promise<boolean> {
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
    if (!w) return;
    const end = endedAt ?? now();
    await db.workouts.put(touched({ ...w, ended_at: end }));
    // Etterregistrert økt: legg settenes tidspunkt inne i øktas tidsrom, så rekorder
    // og «forrige gang» havner i riktig rekkefølge sammenlignet med andre økter.
    if (endedAt) await spreadSetTimes(sets.filter((s) => s.completed_at), w.started_at, end);
  });
  return true;
}

/** Fordeler fullførte sets jevnt mellom start og slutt, i samme rekkefølge som de ble gjort. */
async function spreadSetTimes(done: WorkoutSet[], start: string, end: string) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!(b > a) || !done.length) return;
  const ordered = [...done].sort((x, y) => x.completed_at!.localeCompare(y.completed_at!) || x.position - y.position);
  const stepMs = (b - a) / (ordered.length + 1);
  await db.sets.bulkPut(ordered.map((s, i) => touched({ ...s, completed_at: new Date(a + stepMs * (i + 1)).toISOString() })));
}

/** Endrer navn, start og varighet på en ferdig økt. */
export async function updateWorkoutTimes(id: string, patch: { name: string; startedAt: string; durationMin: number }) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(id);
    if (!w) return;
    const end = new Date(new Date(patch.startedAt).getTime() + Math.max(1, patch.durationMin) * 60_000).toISOString();
    const moved = patch.startedAt !== w.started_at || end !== w.ended_at;
    await db.workouts.put(touched({ ...w, name: patch.name.trim() || w.name, started_at: patch.startedAt, ended_at: end }));
    if (moved) await spreadSetTimes((await setsForWorkout(id)).filter((s) => s.completed_at), patch.startedAt, end);
  });
}

/** Første uferdige set i økta, i øvelsesrekkefølge (det neste du skal gjøre). */
export function nextPendingSet(wes: WorkoutExercise[], sets: WorkoutSet[]): WorkoutSet | undefined {
  for (const we of [...wes].sort((a, b) => a.position - b.position)) {
    const next = sets
      .filter((s) => s.workout_exercise_id === we.id && !s.completed_at && !s.deleted)
      .sort((a, b) => a.position - b.position)[0];
    if (next) return next;
  }
  return undefined;
}

/** Tidspunktet for siste fullførte set i økta (eller null). */
export async function lastSetTime(id: string): Promise<string | null> {
  const done = (await setsForWorkout(id)).filter((s) => s.completed_at).map((s) => s.completed_at!);
  return done.length ? done.sort().at(-1)! : null;
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

type ExerciseFields = Pick<Exercise, 'name' | 'muscle_group' | 'equipment'> & { kind?: Exercise['kind'] };

export async function createExercise(e: ExerciseFields): Promise<string> {
  const id = uuid();
  await db.exercises.add(touched<Exercise>({ kind: 'weight', ...e, id, custom: 1, deleted: 0, updated_at: '', dirty: 1 }));
  return id;
}

/** Endrer en egen øvelse. Innebygde øvelser kan ikke endres. */
export async function updateExercise(id: string, patch: ExerciseFields) {
  await db.transaction('rw', db.exercises, async () => {
    const e = await db.exercises.get(id);
    if (e?.custom) await db.exercises.put(touched({ ...e, ...patch, name: patch.name.trim() || e.name }));
  });
}

/** Skjuler en egen øvelse. Historikken beholdes, og slettingen kan angres. */
export async function deleteExercise(id: string): Promise<Removed> {
  const e = await db.exercises.get(id);
  return e?.custom ? { exercises: await softDelete('exercises', [e]) } : {};
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

/** Alle rutiner i brukerens rekkefølge. */
export async function sortedRoutines(): Promise<Routine[]> {
  const list = alive(await db.routines.toArray());
  return list.sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.name.localeCompare(b.name, 'nb'));
}

/** Flytter en rutine ett steg opp (-1) eller ned (1). Gir alle rutinene faste plasser. */
export async function moveRoutine(id: string, dir: -1 | 1): Promise<void> {
  const list = await sortedRoutines();
  const i = list.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction('rw', db.routines, async () => {
    for (const [pos, r] of list.entries()) if (r.position !== pos) await db.routines.put(touched({ ...r, position: pos }));
  });
}

export async function saveRoutine(
  routine: { id?: string; name: string; notes: string; source?: string | null },
  items: RoutineDraftItem[],
): Promise<string> {
  const id = routine.id ?? uuid();
  await db.transaction('rw', db.routines, db.routine_exercises, async () => {
    const prev = await db.routines.get(id);
    // Nye rutiner legges bakerst i rekkefølgen.
    const position = prev?.position ?? (prev ? null : Math.max(-1, ...alive(await db.routines.toArray()).map((r) => r.position ?? -1)) + 1);
    await db.routines.put(
      // Lagres rutinen uten source (f.eks. fra redigering), blir den brukerens egen.
      touched<Routine>({ ...(prev ?? { deleted: 0 }), id, name: routine.name, notes: routine.notes, source: routine.source ?? null, position, updated_at: '', dirty: 1 }),
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

/**
 * Rutinepunkter ut fra en økt. Med `onlyDone` telles bare fullførte arbeidssett (ferdig økt),
 * ellers alle planlagte arbeidssett (økt som pågår). Mål-reps beholdes fra rutinen når de finnes.
 */
async function itemsFromWorkout(workoutId: string, onlyDone: boolean): Promise<RoutineDraftItem[]> {
  const sets = await setsForWorkout(workoutId);
  return (await workoutExercises(workoutId))
    .map((we) => {
      const work = sets.filter((s) => s.workout_exercise_id === we.id && s.set_type !== 'warmup' && (!onlyDone || s.completed_at));
      return {
        exercise_id: we.exercise_id,
        target_sets: work.length,
        target_reps: we.target_reps ?? work[0]?.reps ?? 8,
        rest_seconds: we.rest_seconds,
      };
    })
    .filter((i) => i.target_sets > 0);
}

/** Lager en rutine av en ferdig økt. */
export async function routineFromWorkout(workoutId: string): Promise<string> {
  const w = await db.workouts.get(workoutId);
  return saveRoutine({ name: w?.name ?? t('Ny rutine', 'New routine'), notes: '' }, await itemsFromWorkout(workoutId, true));
}

/**
 * Er økta (startet fra en rutine) annerledes enn rutinen: andre øvelser, annen rekkefølge
 * eller annet antall sets? Brukes til å tilby «Oppdater rutinen» når økta avsluttes.
 */
export async function routineChanges(workoutId: string): Promise<{ routineId: string; routineName: string } | null> {
  const w = await db.workouts.get(workoutId);
  if (!w?.routine_id) return null;
  const routine = await db.routines.get(w.routine_id);
  if (!routine || routine.deleted) return null;
  const planned = await itemsFromWorkout(workoutId, false);
  const current = await routineItems(routine.id);
  const sig = (xs: { exercise_id: string; target_sets: number }[]) => xs.map((x) => `${x.exercise_id}:${x.target_sets}`).join('|');
  return sig(planned) === sig(current) ? null : { routineId: routine.id, routineName: routine.name };
}

/** Skriver øktas øvelser og antall sets tilbake til rutinen den ble startet fra. */
export async function updateRoutineFromWorkout(workoutId: string): Promise<void> {
  const w = await db.workouts.get(workoutId);
  const routine = w?.routine_id ? await db.routines.get(w.routine_id) : undefined;
  if (!routine) return;
  const items = await itemsFromWorkout(workoutId, true);
  if (items.length) await saveRoutine({ id: routine.id, name: routine.name, notes: routine.notes }, items);
}

/** Lager en kopi av en rutine og returnerer id-en til kopien. */
export async function duplicateRoutine(id: string): Promise<string> {
  const r = await db.routines.get(id);
  const items = (await routineItems(id)).map(({ exercise_id, target_sets, target_reps, rest_seconds }) => ({ exercise_id, target_sets, target_reps, rest_seconds }));
  return saveRoutine({ name: `${r?.name ?? t('Rutine', 'Routine')} ${t('(kopi)', '(copy)')}`, notes: r?.notes ?? '' }, items);
}

// ---------- Profil ----------

/** Appfargene brukeren kan velge (samme som avatarfargen). Se src/lib/theme.ts. */
export const PROFILE_COLORS = SWATCHES.map((s) => s.hex);

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
/** KV-nøkkel: brukeren har sett/valgt de nye programmene (skjuler banneret på Hjem). */
export const PROGRAMS_SEEN_KEY = 'programs-v2-seen';

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Rutiner som trygt kan erstattes av et nytt program: rutiner fra programbiblioteket som ikke er
 * endret, og gamle startrutiner (laget før programbiblioteket) med uendrede øvelser. Egne rutiner aldri.
 */
export async function replaceableRoutines(): Promise<Routine[]> {
  const routines = alive(await db.routines.toArray());
  const legacy = Object.values(TEMPLATES).flat().map((tpl) => tpl.exercises.map(([id]) => id));
  const out: Routine[] = [];
  for (const r of routines) {
    if (r.source?.startsWith('program:')) {
      out.push(r);
      continue;
    }
    if (r.source === undefined) {
      const ids = (await routineItems(r.id)).map((i) => i.exercise_id);
      if (legacy.some((l) => sameList(l, ids))) out.push(r);
    }
  }
  return out;
}

/**
 * Lager rutinene i et program. «replace» sletter først rutinene fra `replaceableRoutines`
 * (egne rutiner beholdes alltid). Returnerer antall nye rutiner.
 */
export async function applyProgram(programId: string, goal: Goal, mode: 'add' | 'replace' = 'add'): Promise<number> {
  const program = programById(programId);
  if (!program) return 0;
  if (mode === 'replace') for (const r of await replaceableRoutines()) await deleteRoutine(r.id);
  const scheme = schemeFor(goal);
  for (const r of program.routines) {
    await saveRoutine(
      { name: r.name, notes: '', source: `program:${program.id}` },
      r.exercises.map(([exercise_id, accessory]) => ({
        exercise_id,
        target_sets: accessory ? 3 : scheme.sets,
        // Tidsøvelser (planke) har mål i sekunder, ikke reps.
        target_reps: kindOf(exercise_id) === 'time' ? 45 : accessory ? Math.max(scheme.reps, 10) : scheme.reps,
        rest_seconds: accessory ? Math.min(scheme.rest, 90) : scheme.rest,
      })),
    );
  }
  await db.kv.put({ key: PROGRAMS_SEEN_KEY, value: new Date().toISOString() });
  return program.routines.length;
}

/** Startrutiner ved oppstart: det anbefalte programmet for antall dager. */
export async function createStarterRoutines(goal: Goal, perWeek: number): Promise<number> {
  return applyProgram(recommendedProgramId(perWeek, 'beginner', goal), goal);
}

/**
 * Rutinen som står for tur: den neste i brukerens rekkefølge etter rutinen fra forrige økt
 * (og den første hvis ingen er brukt ennå). Starter på nytt fra toppen etter den siste.
 */
export async function nextRoutine(): Promise<Routine | undefined> {
  const routines = await sortedRoutines();
  if (!routines.length) return undefined;
  const last = (await db.workouts.toArray())
    .filter((w) => !w.deleted && w.routine_id && routines.some((r) => r.id === w.routine_id))
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
  if (!last) return routines[0];
  const i = routines.findIndex((r) => r.id === last.routine_id);
  return routines[(i + 1) % routines.length];
}

export type { SetType };
