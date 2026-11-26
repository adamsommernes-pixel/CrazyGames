import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, openUserDb } from './dexie';
import { moveRoutine, nextRoutine, saveRoutine, sortedRoutines } from './repo';

let n = 0;
beforeEach(() => {
  openUserDb(`order-${++n}`);
});

const item = { exercise_id: 'ex-benkpress', target_sets: 3, target_reps: 8, rest_seconds: 90 };
const make = (name: string) => saveRoutine({ name, notes: '' }, [item]);
/** En ferdig økt fra en rutine på et gitt tidspunkt. */
const done = (routineId: string, at: string) =>
  db.workouts.put({ id: `w-${at}`, routine_id: routineId, name: 'x', started_at: at, ended_at: at, notes: '', updated_at: at, deleted: 0, dirty: 0 });

describe('routine order', () => {
  it('keeps creation order, rotates «up next» through it, and follows moves', async () => {
    const push = await make('Push');
    const pull = await make('Pull');
    await make('Bein');
    expect((await sortedRoutines()).map((r) => r.name)).toEqual(['Push', 'Pull', 'Bein']);
    expect((await nextRoutine())?.name).toBe('Push');

    await done(push, '2026-11-20T10:00:00.000Z');
    expect((await nextRoutine())?.name).toBe('Pull');

    // Flytt Bein opp foran Pull: nå står Bein for tur etter Push.
    const bein = (await sortedRoutines())[2];
    await moveRoutine(bein.id, -1);
    expect((await sortedRoutines()).map((r) => r.name)).toEqual(['Push', 'Bein', 'Pull']);
    expect((await nextRoutine())?.name).toBe('Bein');

    // Etter den siste begynner det på toppen igjen.
    await done(pull, '2026-11-22T10:00:00.000Z');
    expect((await nextRoutine())?.name).toBe('Push');
  });
});
