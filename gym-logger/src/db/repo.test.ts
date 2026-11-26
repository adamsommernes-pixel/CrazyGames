import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openUserDb } from './dexie';
import {
  addExerciseToWorkout,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  removeWorkoutExercise,
  restore,
  setsForWorkout,
  startWorkout,
  toggleSetDone,
  updateWorkoutTimes,
  workoutExercises,
} from './repo';

let n = 0;
beforeEach(() => {
  openUserDb(`test-${++n}`);
});

describe('etterregistrert økt', () => {
  it('sluttid og set-tider legges i øktas tidsrom, i samme rekkefølge', async () => {
    const start = '2026-11-20T17:00:00.000Z';
    const w = await startWorkout({ startedAt: start });
    await addExerciseToWorkout(w, 'ex-benkpress', { sets: 2 });
    const [a, b] = (await setsForWorkout(w)).sort((x, y) => x.position - y.position);
    await toggleSetDone(a.id);
    await toggleSetDone(b.id);
    const end = '2026-11-20T18:00:00.000Z';
    expect(await finishWorkout(w, end)).toBe(true);
    const done = (await setsForWorkout(w)).sort((x, y) => x.position - y.position);
    expect(done.every((s) => s.completed_at! > start && s.completed_at! < end)).toBe(true);
    expect(done[0].completed_at! < done[1].completed_at!).toBe(true);
  });

  it('endre start og varighet flytter økta', async () => {
    const w = await startWorkout({ startedAt: '2026-11-20T17:00:00.000Z' });
    await addExerciseToWorkout(w, 'ex-benkpress', { sets: 1 });
    const [s] = await setsForWorkout(w);
    await toggleSetDone(s.id);
    await finishWorkout(w, '2026-11-20T18:00:00.000Z');
    await updateWorkoutTimes(w, { name: 'Bryst', startedAt: '2026-11-21T08:00:00.000Z', durationMin: 45 });
    const { db } = await import('./dexie');
    const moved = await db.workouts.get(w);
    expect(moved).toMatchObject({ name: 'Bryst', started_at: '2026-11-21T08:00:00.000Z', ended_at: '2026-11-21T08:45:00.000Z' });
    const [after] = await setsForWorkout(w);
    expect(after.completed_at! > '2026-11-21T08:00:00.000Z').toBe(true);
  });
});

describe('angre sletting', () => {
  it('gjenoppretter et slettet set', async () => {
    const w = await startWorkout();
    await addExerciseToWorkout(w, 'ex-benkpress', { sets: 3 });
    const [first] = await setsForWorkout(w);
    const removed = await deleteSet(first.id);
    expect(await setsForWorkout(w)).toHaveLength(2);
    await restore(removed);
    expect(await setsForWorkout(w)).toHaveLength(3);
  });

  it('gjenoppretter en fjernet øvelse med settene', async () => {
    const w = await startWorkout();
    await addExerciseToWorkout(w, 'ex-benkpress', { sets: 2 });
    const [we] = await workoutExercises(w);
    const removed = await removeWorkoutExercise(we.id);
    expect(await workoutExercises(w)).toHaveLength(0);
    await restore(removed);
    expect(await workoutExercises(w)).toHaveLength(1);
    expect(await setsForWorkout(w)).toHaveLength(2);
  });

  it('gjenoppretter ikke sets som var slettet fra før', async () => {
    const w = await startWorkout();
    await addExerciseToWorkout(w, 'ex-benkpress', { sets: 3 });
    const [first] = await setsForWorkout(w);
    await deleteSet(first.id); // slettet før økta forkastes
    const removed = await deleteWorkout(w);
    expect(removed.sets).toHaveLength(2);
    await restore(removed);
    expect(await setsForWorkout(w)).toHaveLength(2);
  });
});
