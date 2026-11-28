import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, openUserDb } from './dexie';
import { accountCode, ownId, ownImported } from './ownIds';
import { pushWith, type Upserter } from './sync';
import type { Backup } from './backup';

const ME = 'aaaaaaaa-1111-2222-3333-444444444444';
const OTHER = 'bbbbbbbb-1111-2222-3333-444444444444';
let n = 0;
beforeEach(() => {
  openUserDb(`${ME}-${++n}`);
});
const stamp = '2026-11-28T10:00:00.000Z';
const base = { updated_at: stamp, deleted: 0 as const, dirty: 1 as const };

describe('id-er merket med kontoen', () => {
  it('fast kode per konto, og merket legges bare på én gang', () => {
    expect(accountCode(ME)).toBe(accountCode(ME));
    expect(accountCode(ME)).not.toBe(accountCode(OTHER));
    expect(ownId('hevy-ex-1', ME)).toBe(`hevy-ex-1-u${accountCode(ME)}`);
    expect(ownId(ownId('hevy-ex-1', ME), ME)).toBe(ownId('hevy-ex-1', ME));
  });

  it('importerte id-er og referanser merkes, men ikke de som allerede er dine', async () => {
    await db.exercises.put({ ...base, id: 'hevy-ex-old', name: 'Gammel', muscle_group: 'Bryst', equipment: 'Annet', custom: 1 });
    const b: Backup = {
      app: 'repgrade', version: 2, exported_at: stamp,
      tables: {
        exercises: [{ ...base, id: 'hevy-ex-new' }, { ...base, id: 'hevy-ex-old' }],
        sets: [{ ...base, id: 'hevy-w-1-0-0', exercise_id: 'hevy-ex-new', workout_id: 'hevy-w-1' } as never, { ...base, id: 'hevy-w-1-1-0', exercise_id: 'ex-benkpress', workout_id: 'hevy-w-1' } as never],
      },
    };
    const out = await ownImported(b, ME);
    expect(out.tables.exercises.map((r) => r.id)).toEqual([ownId('hevy-ex-new', ME), 'hevy-ex-old']);
    const sets = out.tables.sets as unknown as Record<string, string>[];
    expect(sets[0]).toMatchObject({ id: ownId('hevy-w-1-0-0', ME), exercise_id: ownId('hevy-ex-new', ME), workout_id: ownId('hevy-w-1', ME) });
    expect(sets[1].exercise_id).toBe('ex-benkpress');
  });
});

/** Liten «sky»: hver id eies av én bruker; andres id-er nektes som i Supabase (row-level security). */
function fakeCloud(owner: Map<string, string>, me: string): Upserter & { saved: Map<string, Record<string, unknown>> } {
  const saved = new Map<string, Record<string, unknown>>();
  return {
    saved,
    from: (table: string) => ({
      upsert: async (rows: unknown[]) => {
        for (const r of rows as Record<string, unknown>[]) {
          const key = `${table}:${r.id}`;
          if (owner.has(key) && owner.get(key) !== me) return { error: { message: `new row violates row-level security policy for table "${table}"`, code: '42501' } };
        }
        for (const r of rows as Record<string, unknown>[]) {
          owner.set(`${table}:${r.id}`, me);
          saved.set(`${table}:${r.id}`, r);
        }
        return { error: null };
      },
    }),
  };
}

describe('synken reparerer id-er som tilhører andre', () => {
  it('gir øvelsen, økta og alt som peker på dem egne id-er, og sender på nytt', async () => {
    // Pappa importerte samme Hevy-øvelse og -økt som en annen bruker allerede har i skyen.
    await db.exercises.put({ ...base, id: 'hevy-ex-x', name: 'Smith row', muscle_group: 'Rygg', equipment: 'Maskin', custom: 1 });
    await db.workouts.put({ ...base, id: 'hevy-w-1', routine_id: null, name: 'Pull', started_at: stamp, ended_at: stamp, notes: '' });
    await db.workout_exercises.put({ ...base, id: 'hevy-w-1-0', workout_id: 'hevy-w-1', exercise_id: 'hevy-ex-x', position: 0, rest_seconds: 120, notes: '' });
    await db.sets.put({ ...base, id: 'hevy-w-1-0-0', workout_exercise_id: 'hevy-w-1-0', workout_id: 'hevy-w-1', exercise_id: 'hevy-ex-x', position: 0, weight: 60, reps: 8, set_type: 'normal', completed_at: stamp });
    // En skjult innebygd øvelse skal aldri sendes.
    await db.exercises.put({ ...base, id: 'ex-sidehev', name: 'Sidehev', muscle_group: 'Skuldre', equipment: 'Manualer', custom: 0, deleted: 1 });
    await db.kv.put({ key: 'favorites', value: ['hevy-ex-x'] });

    const owner = new Map([['exercises:hevy-ex-x', OTHER], ['workouts:hevy-w-1', OTHER]]);
    const cloud = fakeCloud(owner, ME);
    expect(await pushWith(cloud, ME)).toBe(2);

    const ex = ownId('hevy-ex-x', ME);
    const w = ownId('hevy-w-1', ME);
    expect(await db.exercises.get('hevy-ex-x')).toBeUndefined();
    expect((await db.exercises.get(ex))?.name).toBe('Smith row');
    expect(await db.sets.get('hevy-w-1-0-0')).toMatchObject({ exercise_id: ex, workout_id: w, dirty: 0 });
    expect(await db.workout_exercises.get('hevy-w-1-0')).toMatchObject({ exercise_id: ex, workout_id: w, dirty: 0 });
    expect((await db.kv.get('favorites'))?.value).toEqual([ex]);
    // I skyen: pappas egne rader under nye id-er; den andre brukerens rader er urørt.
    expect(owner.get(`exercises:${ex}`)).toBe(ME);
    expect(owner.get('exercises:hevy-ex-x')).toBe(OTHER);
    expect(cloud.saved.has('exercises:ex-sidehev')).toBe(false);
    expect((await db.exercises.get('ex-sidehev'))?.dirty).toBe(0);
    // Ingenting igjen å sende
    expect(await db.sets.where('dirty').equals(1).count()).toBe(0);
    expect(await pushWith(cloud, ME)).toBe(0);
  });

  it('andre feil (f.eks. manglende tilgang) repareres ikke, men vises', async () => {
    await db.workouts.put({ ...base, id: 'w1', routine_id: null, name: 'x', started_at: stamp, ended_at: stamp, notes: '' });
    const broken: Upserter = { from: () => ({ upsert: async () => ({ error: { message: 'permission denied for table workouts', code: '42501' } }) }) };
    await expect(pushWith(broken, ME)).rejects.toThrow(/permission denied/);
    expect(await db.workouts.get('w1')).toBeTruthy();
  });
});
