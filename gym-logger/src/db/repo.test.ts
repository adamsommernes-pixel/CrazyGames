import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openUserDb } from './dexie';
import {
  addExerciseToWorkout,
  deleteSet,
  deleteWorkout,
  removeWorkoutExercise,
  restore,
  setsForWorkout,
  startWorkout,
  workoutExercises,
} from './repo';

let n = 0;
beforeEach(() => {
  openUserDb(`test-${++n}`);
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
