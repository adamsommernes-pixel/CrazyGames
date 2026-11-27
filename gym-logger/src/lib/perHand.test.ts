import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { perHand } from './perHand';
import { openUserDb, db } from '../db/dexie';
import { addExerciseToWorkout, halveSetWeights, restoreSetWeights, setIdsForExercise, setsForWorkout, startWorkout, updateSet } from '../db/repo';
import { BUILTIN_EXERCISES } from '../db/library';

const ex = (slug: string) => BUILTIN_EXERCISES.find((e) => e.id === `ex-${slug}`)!;

describe('vekt per manual', () => {
  it('gjelder manualer og kettlebells, ikke stang, maskin eller kondisjon', () => {
    expect(perHand(ex('benkpress-med-manualer'))).toBe('dumbbell');
    expect(perHand(ex('roing-med-manual'))).toBe('dumbbell');
    expect(perHand(ex('kettlebell-swing'))).toBe('kettlebell');
    expect(perHand(ex('benkpress'))).toBeNull();
    expect(perHand(ex('beinpress'))).toBeNull();
    expect(perHand(null)).toBeNull();
  });
});

let n = 0;
beforeEach(() => openUserDb(`perhand-${++n}`));

describe('del på to', () => {
  it('halverer vektene og kan angres', async () => {
    const wid = await startWorkout();
    await addExerciseToWorkout(wid, 'ex-benkpress-med-manualer');
    const [s] = await setsForWorkout(wid);
    await updateSet(s.id, { weight: 80, reps: 8 });
    const ids = await setIdsForExercise('ex-benkpress-med-manualer');
    expect(ids).toContain(s.id);
    const prev = await halveSetWeights(ids);
    expect((await db.sets.get(s.id))?.weight).toBe(40);
    await restoreSetWeights(prev);
    expect((await db.sets.get(s.id))?.weight).toBe(80);
  });
});
