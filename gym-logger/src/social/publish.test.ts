import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, openUserDb } from '../db/dexie';
import { addExerciseToWorkout, deleteWorkout, finishWorkout, setsForWorkout, startWorkout, toggleSetDone, updateSet } from '../db/repo';
import { createFakeSocial, memoryStore } from './fake';
import { setShared, syncActivities } from './publish';
import type { SocialBackend } from './backend';

let n = 0;
let me: SocialBackend;
let viewer: SocialBackend;
const ctx = { bw: 80, sex: 'male' as const, tier: { index: 4, score: 45.2 } };
const since = '2000-01-01T00:00:00.000Z';

beforeEach(async () => {
  openUserDb(`pub-${++n}`);
  const store = memoryStore();
  me = createFakeSocial(() => 'ME', store);
  viewer = createFakeSocial(() => 'V', store);
  await me.saveProfile({ handle: 'meg', display_name: 'Meg', color: '#34c56a', visibility: 3, is_16_plus: true });
  await viewer.saveProfile({ handle: 'viewer', display_name: 'V', color: '#34c56a', visibility: 1, is_16_plus: false });
});

/** Økt med benk 100 × 5 (fullført), pull-ups +10 × 8 (fullført) og ett set som ikke ble gjort. */
async function workout(): Promise<string> {
  const w = await startWorkout({ name: 'Push' });
  await addExerciseToWorkout(w, 'ex-benkpress', { sets: 2 });
  await addExerciseToWorkout(w, 'ex-pull-ups', { sets: 1 });
  const sets = await setsForWorkout(w);
  const bench = sets.filter((s) => s.exercise_id === 'ex-benkpress').sort((a, b) => a.position - b.position);
  const pull = sets.find((s) => s.exercise_id === 'ex-pull-ups')!;
  await updateSet(bench[0].id, { weight: 100, reps: 5 });
  await toggleSetDone(bench[0].id);
  await updateSet(pull.id, { weight: 10, reps: 8 });
  await toggleSetDone(pull.id);
  await finishWorkout(w);
  return w;
}

const feed = () => viewer.feed();

describe('publisering til feeden', () => {
  it('publiserer hele økta, uten kroppsvekt og uten løft som avslører den', async () => {
    const w = await workout();
    expect(await syncActivities(me, ctx, since)).toEqual({ published: 1, removed: 0 });
    const [a] = await feed();
    expect(a.id).toBe(w);
    expect(a.name).toBe('Push');
    expect(a.data.exercises.map((e) => [e.exercise_id, e.sets.length])).toEqual([['ex-benkpress', 1], ['ex-pull-ups', 1]]);
    expect(a.data.exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 5, set_type: 'normal' });
    expect(a.data.volume_kg).toBe(500);
    expect(a.data.tier).toEqual(ctx.tier);
    // Benk: Epley 100 × (1 + 5/30) = 116,7. Pull-ups (kroppsvekt + 10) sendes ikke.
    expect(a.data.lifts).toEqual({ 'ex-benkpress': 116.7 });
    expect(Object.keys(a.data).sort()).toEqual(['duration_s', 'exercises', 'lifts', 'muscles', 'records', 'reps', 'sets', 'tier', 'version', 'volume_kg']);
    expect(JSON.stringify(a)).not.toMatch(/bodyweight_kg|weight_kg|"bw"/);
    // Pull-ups logges med ekstravekten (+10), ikke kroppsvekt + 10.
    expect(a.data.exercises[1]).toMatchObject({ kind: 'bodyweight', sets: [{ weight: 10, reps: 8 }] });
  });

  it('sender bare på nytt når økta endres', async () => {
    const w = await workout();
    await syncActivities(me, ctx, since);
    expect(await syncActivities(me, ctx, since)).toEqual({ published: 0, removed: 0 });
    const done = (await setsForWorkout(w)).find((s) => s.exercise_id === 'ex-benkpress' && s.completed_at)!;
    await new Promise((r) => setTimeout(r, 5));
    await updateSet(done.id, { weight: 105 });
    expect(await syncActivities(me, ctx, since)).toEqual({ published: 1, removed: 0 });
    expect((await feed())[0].data.exercises[0].sets[0].weight).toBe(105);
  });

  it('endret økt beholder nivået den ble delt med (så «Fremgang» ikke blir feil)', async () => {
    const w = await workout();
    await syncActivities(me, ctx, since);
    const done = (await setsForWorkout(w)).find((s) => s.exercise_id === 'ex-benkpress' && s.completed_at)!;
    await new Promise((r) => setTimeout(r, 5));
    await updateSet(done.id, { reps: 6 });
    await syncActivities(me, { ...ctx, tier: { index: 6, score: 65 } }, since);
    expect((await feed())[0].data.tier).toEqual(ctx.tier);
  });

  it('fjerner økter som slettes eller ikke skal deles', async () => {
    const a = await workout();
    const b = await workout();
    await syncActivities(me, ctx, since);
    expect((await feed()).length).toBe(2);
    await setShared(a, false);
    expect(await syncActivities(me, ctx, since)).toEqual({ published: 0, removed: 1 });
    await deleteWorkout(b);
    expect(await syncActivities(me, ctx, since)).toEqual({ published: 0, removed: 1 });
    expect(await feed()).toEqual([]);
    await setShared(a, true);
    expect(await syncActivities(me, ctx, since)).toEqual({ published: 1, removed: 0 });
  });

  it('deler ikke økter fra før den sosiale profilen ble laget, eller økter som pågår', async () => {
    await workout();
    expect(await syncActivities(me, ctx, new Date(Date.now() + 60_000).toISOString())).toEqual({ published: 0, removed: 0 });
    await startWorkout({ name: 'Pågår' });
    await syncActivities(me, ctx, since);
    expect((await feed()).map((a) => a.name)).toEqual(['Push']);
  });

  it('prøver igjen etter en feil (f.eks. uten nett)', async () => {
    await workout();
    const failing: SocialBackend = { ...me, publish: async () => { throw new Error('offline'); } };
    await expect(syncActivities(failing, ctx, since)).rejects.toThrow('offline');
    expect(await syncActivities(me, ctx, since)).toEqual({ published: 1, removed: 0 });
    expect(await db.kv.get('social-published')).toBeTruthy();
  });
});
