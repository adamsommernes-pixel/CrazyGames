import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openUserDb, db } from './dexie';
import { csvField, exportBackup, importBackup, parseBackup, setsToCSV, summarizeBackup } from './backup';
import { addExerciseToWorkout, finishWorkout, startWorkout, toggleSetDone, updateSet, setsForWorkout } from './repo';
import type { Workout, WorkoutSet } from './types';

let n = 0;
beforeEach(() => {
  openUserDb(`backup-${++n}`);
});

describe('CSV', () => {
  it('quotes fields with commas, quotes and newlines', () => {
    expect(csvField('Knebøy')).toBe('Knebøy');
    expect(csvField('Push, pull')).toBe('"Push, pull"');
    expect(csvField('Han sa "tungt"')).toBe('"Han sa ""tungt"""');
    expect(csvField(null)).toBe('');
    expect(csvField(102.5)).toBe('102.5');
  });

  it('writes one row per completed set with a header', () => {
    const w = { id: 'w1', name: 'Bein, tung', deleted: 0 } as unknown as Workout;
    const s = (id: string, pos: number, done: string | null) =>
      ({ id, workout_id: 'w1', exercise_id: 'ex-kneboy', position: pos, weight: 100, reps: 5, set_type: 'normal', completed_at: done, deleted: 0 }) as unknown as WorkoutSet;
    const csv = setsToCSV([s('a', 0, '2026-11-20T10:00:00Z'), s('b', 1, null)], new Map([['w1', w]]), new Map([['ex-kneboy', { id: 'ex-kneboy', name: 'Knebøy', custom: 0 }]]), new Set(['a']));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('date,workout,exercise,set,type,weight_kg,reps,distance_km,pr');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-11-20 10:00,"Bein, tung",Knebøy,1,normal,100,5,,yes');
  });
});

describe('JSON backup', () => {
  it('round-trips workouts, sets and settings (v2) and summarizes them', async () => {
    const w = await startWorkout();
    await addExerciseToWorkout(w, 'ex-kneboy', { sets: 2 });
    const [first] = await setsForWorkout(w);
    await updateSet(first.id, { weight: 100, reps: 5 });
    await toggleSetDone(first.id);
    await finishWorkout(w);
    await db.kv.put({ key: 'unit', value: 'lbs' });
    await db.kv.put({ key: 'pull:me:sets', value: { at: 'x', id: 'y' } });

    const backup = await exportBackup();
    expect(backup.version).toBe(2);
    expect(backup.kv?.some((r) => r.key === 'unit')).toBe(true);
    expect(backup.kv?.some((r) => r.key.startsWith('pull:'))).toBe(false);
    expect(summarizeBackup(backup)).toMatchObject({ workouts: 1, sets: 1 });

    openUserDb(`backup-${++n}`);
    const added = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(added).toBeGreaterThanOrEqual(3);
    expect((await db.sets.toArray()).find((s) => s.weight === 100)?.reps).toBe(5);
    expect((await db.kv.get('unit'))?.value).toBe('lbs');
  });

  it('still reads version 1 files and rejects other files', async () => {
    const v1 = { app: 'gym-logger', version: 1, exported_at: '2026-01-01T00:00:00Z', tables: { workouts: [{ id: 'w1', name: 'Gammel', updated_at: '2026-01-01T00:00:00Z', started_at: '2026-01-01T00:00:00Z' }] } };
    expect(await importBackup(v1)).toBe(1);
    expect((await db.workouts.get('w1'))?.name).toBe('Gammel');
    expect(() => parseBackup({ hello: 1 })).toThrow();
  });
});
