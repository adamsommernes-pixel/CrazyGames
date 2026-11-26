import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LIBRARY } from './library';
import { PROGRAMS, programsForDays, recommendedProgramId } from './programs';
import { openUserDb, db } from './dexie';
import { applyProgram, replaceableRoutines, routineItems, saveRoutine } from './repo';
import { TEMPLATES } from './templates';

const ids = new Set(LIBRARY.map((e) => `ex-${e.slug}`));

describe('program library', () => {
  it('only uses exercises that exist', () => {
    for (const p of PROGRAMS) for (const r of p.routines) for (const [id] of r.exercises) expect(ids.has(id), `${p.id}: ${id}`).toBe(true);
  });

  it('has at least two programs and exactly one recommendation for every 2–6 days', () => {
    for (let d = 2; d <= 6; d++) {
      for (const exp of ['beginner', 'intermediate', 'advanced'] as const) {
        const list = programsForDays(d, exp, 'hypertrophy');
        expect(list.length, `${d} days`).toBeGreaterThanOrEqual(2);
        expect(list.filter((x) => x.recommended)).toHaveLength(1);
        expect(list[0].recommended).toBe(true);
      }
    }
  });

  it('recommends sensible splits', () => {
    expect(recommendedProgramId(3, 'beginner', 'hypertrophy')).toBe('fb2');
    expect(recommendedProgramId(3, 'intermediate', 'strength')).toBe('sl5x5');
    expect(recommendedProgramId(4, 'beginner', 'general')).toBe('ul4');
    expect(recommendedProgramId(5, 'advanced', 'hypertrophy')).toBe('pplul5');
    expect(recommendedProgramId(6, 'advanced', 'own')).toBe('ppl6');
    expect(recommendedProgramId(1, 'beginner', 'own')).toBe('fb2');
  });
});

let n = 0;
beforeEach(() => {
  openUserDb(`programs-${++n}`);
});

describe('applying programs', () => {
  it('replaces only unchanged program routines and old starter routines, never your own', async () => {
    // Gammel startrutine fra før programbiblioteket (uten source) + en egen rutine.
    const legacy = TEMPLATES.fullbody[0];
    await saveRoutine({ name: legacy.name, notes: '' }, legacy.exercises.map(([exercise_id]) => ({ exercise_id, target_sets: 3, target_reps: 10, rest_seconds: 90 })));
    await db.routines.toCollection().modify((r) => { delete r.source; }); // som laget før kolonnen fantes
    const own = await saveRoutine({ name: 'Min egen', notes: '' }, [{ exercise_id: 'ex-benkpress', target_sets: 3, target_reps: 8, rest_seconds: 120 }]);

    await applyProgram('ppl3', 'hypertrophy', 'add');
    expect((await replaceableRoutines()).map((r) => r.name).sort()).toEqual(['Bein', 'Fullkropp A', 'Pull', 'Push'].sort());

    // Redigering gjør en programrutine til din egen.
    const push = (await db.routines.toArray()).find((r) => r.name === 'Push')!;
    await saveRoutine({ id: push.id, name: 'Push', notes: '' }, (await routineItems(push.id)).map((i) => ({ ...i })));

    await applyProgram('ul4', 'hypertrophy', 'replace');
    const names = (await db.routines.toArray()).filter((r) => !r.deleted).map((r) => r.name).sort();
    expect(names).toEqual(['Min egen', 'Overkropp', 'Overkropp B', 'Push', 'Underkropp', 'Underkropp B'].sort());
    expect((await db.routines.get(own))?.deleted).toBe(0);
  });

  it('uses the goal for sets and reps', async () => {
    await applyProgram('sl5x5', 'strength');
    const r = (await db.routines.toArray()).find((x) => x.name === 'Styrke A')!;
    const items = await routineItems(r.id);
    expect(items[0]).toMatchObject({ target_sets: 5, target_reps: 5, rest_seconds: 180 });
    expect(r.source).toBe('program:sl5x5');
  });
});
