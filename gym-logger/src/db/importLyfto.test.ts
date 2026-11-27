import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openUserDb, db } from './dexie';
import { importBackup, parseBackup, summarizeBackup } from './backup';
import { LYFTO_MAP, lyftoToBackup, type LyftoExport } from './importLyfto';
import { BUILTIN_EXERCISES } from './library';

// Oppdiktet eksempel i samme format som Lyfto-eksporten (ingen ekte brukerdata).
const SAMPLE: LyftoExport = {
  schema: 'lyfto-export',
  exportedAt: '2026-11-27T09:00:00.000Z',
  workouts: [
    {
      id: 'w1',
      date: '2026-11-20T11:00:00.000Z',
      durationSeconds: 3600,
      exercises: [
        { id: 'e1', exerciseId: 'bench-press', sets: [
          { weight: 40, reps: 10, completed: true, isWarmup: true, completedAt: '2026-11-20T10:05:00.000Z' },
          { weight: 80, reps: 5, completed: true, completedAt: '2026-11-20T10:10:00.000Z' },
          { weight: 80, reps: 5, completed: false },
        ] },
        { id: 'e2', exerciseId: 'landmine-180', sets: [{ weight: 20, reps: 12, completed: true }] },
        { id: 'e3', exerciseId: 'custom_abc', sets: [{ weight: 50, reps: 8, completed: true }] },
        { id: 'e4', exerciseId: 'squat', sets: [{ weight: 100, reps: 5, completed: false }] },
      ],
    },
    { id: 'w2', date: '2026-11-21T11:00:00.000Z', exercises: [{ id: 'e5', exerciseId: 'deadlift', sets: [{ weight: 100, reps: 3, completed: false }] }] },
  ],
  bodyWeight: [{ date: '2026-08-12T13:49:42.181Z', weight: 82 }],
  templates: [{ id: 't1', name: 'Upper', exerciseIds: ['incline-bench-press', 'lat-pulldown'] }],
  customExercises: [{ id: 'custom_abc', name: 'Min press', primaryMuscles: ['chest'], equipment: 'barbell' }],
  coachPrefs: { weightUnit: 'kg' },
};

let n = 0;
beforeEach(() => openUserDb(`lyfto-${++n}`));

describe('Lyfto-import', () => {
  it('alle faste koblinger peker på øvelser som finnes', () => {
    const ids = new Set(BUILTIN_EXERCISES.map((e) => e.id));
    for (const [l, slug] of Object.entries(LYFTO_MAP)) expect(ids.has(`ex-${slug}`), l).toBe(true);
  });

  it('gjør eksporten om til en backup: bare fullførte sets, oppvarming beholdes', () => {
    const b = parseBackup(JSON.parse(JSON.stringify(SAMPLE)));
    expect(summarizeBackup(b)).toMatchObject({ workouts: 1, sets: 4, routines: 1, bodyweights: 1 });
    const sets = b.tables.sets as unknown as { exercise_id: string; set_type: string; weight: number }[];
    expect(sets.filter((s) => s.exercise_id === 'ex-benkpress').map((s) => s.set_type)).toEqual(['warmup', 'normal']);
    const ex = b.tables.exercises as unknown as { id: string; name: string; muscle_group: string; equipment: string }[];
    expect(ex.find((e) => e.id === 'lyfto-ex-custom_abc')).toMatchObject({ name: 'Min press', muscle_group: 'Bryst', equipment: 'Stang' });
    expect(ex.find((e) => e.id === 'lyfto-ex-landmine-180')?.name).toBe('Landmine 180');
    const w = b.tables.workouts[0] as unknown as { started_at: string; ended_at: string; name: string };
    expect(w.started_at).toBe('2026-11-20T10:00:00.000Z');
    expect(w.ended_at).toBe('2026-11-20T11:00:00.000Z');
    expect(w.name).toContain('Bryst');
  });

  it('pund regnes om til kg', () => {
    const b = lyftoToBackup({ ...SAMPLE, coachPrefs: { weightUnit: 'lbs' } });
    const s = (b.tables.sets as unknown as { weight: number; set_type: string }[]).find((x) => x.set_type === 'normal');
    expect(s?.weight).toBeCloseTo(36.29, 2);
  });

  it('kan leses inn to ganger uten duplikater', async () => {
    await importBackup(SAMPLE);
    await importBackup(SAMPLE);
    expect(await db.workouts.count()).toBe(1);
    expect(await db.sets.count()).toBe(4);
    expect(await db.routines.count()).toBe(1);
  });
});
