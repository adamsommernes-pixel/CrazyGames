import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openUserDb, db } from './dexie';
import { importBackup, parseBackup, summarizeBackup } from './backup';
import { convertImport, matchExercise, parseCSV, parseDate } from './importApps';

// Oppdiktede eksempler i samme format som eksportene fra Hevy og Strong.
export const HEVY_CSV = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push","15 Jan 2026, 10:30","15 Jan 2026, 11:30","","Bench Press (Barbell)","","Tung dag","0","warmup","40","10","","",""
"Push","15 Jan 2026, 10:30","15 Jan 2026, 11:30","","Bench Press (Barbell)","","","1","normal","80","5","","","8"
"Push","15 Jan 2026, 10:30","15 Jan 2026, 11:30","","Triceps Pushdown (Cable)","","","0","normal","30","12","","",""
"Push","15 Jan 2026, 10:30","15 Jan 2026, 11:30","","Weird Machine Thing","","","0","normal","50","10","","",""
"Legs","17 Jan 2026, 09:00","17 Jan 2026, 10:00","","Squat (Barbell)","","","0","normal","100","5","","",""
"Legs","17 Jan 2026, 09:00","17 Jan 2026, 10:00","","Running","","","0","normal","","","5","1800",""`;

export const STRONG_CSV = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2026-02-01 18:00:00;"Pull, tung";1h 5m;Deadlift (Barbell);W;60;5;0;0;;;
2026-02-01 18:00:00;"Pull, tung";1h 5m;Deadlift (Barbell);1;140;3;0;0;;;
2026-02-01 18:00:00;"Pull, tung";1h 5m;Deadlift (Barbell);Rest Timer;0;0;0;120;;;
2026-02-01 18:00:00;"Pull, tung";1h 5m;Lat Pulldown (Cable);1;60;10;0;0;;;
2026-02-01 18:00:00;"Pull, tung";1h 5m;Bicep Curl (Dumbbell);1;14;10;0;0;;;`;

let n = 0;
beforeEach(() => openUserDb(`apps-${++n}`));

describe('CSV og datoer', () => {
  it('leser komma og semikolon med anførselstegn', () => {
    expect(parseCSV('a,b\n"x, y",2')).toEqual([{ a: 'x, y', b: '2' }]);
    expect(parseCSV('a;b\r\n"si ""hei""";2\r\n')).toEqual([{ a: 'si "hei"', b: '2' }]);
  });
  it('leser datoformatene', () => {
    expect(parseDate('15 Jan 2026, 10:30')).toBe(new Date(2026, 0, 15, 10, 30).toISOString());
    expect(parseDate('2026-02-01 18:00:00')).toBe(new Date(2026, 1, 1, 18, 0).toISOString());
    expect(parseDate('')).toBeNull();
  });
});

describe('øvelsesnavn', () => {
  it('kjenner igjen vanlige navn fra Hevy og Strong', () => {
    const id = (s: string) => matchExercise(s)?.id;
    expect(id('Bench Press (Barbell)')).toBe('ex-benkpress');
    expect(id('Bench Press (Dumbbell)')).toBe('ex-benkpress-med-manualer');
    expect(id('Squat (Barbell)')).toBe('ex-kneboy');
    expect(id('Deadlift (Barbell)')).toBe('ex-markloft');
    expect(id('Lat Pulldown (Cable)')).toBe('ex-nedtrekk');
    expect(id('Triceps Pushdown (Cable)')).toBe('ex-triceps-pushdown');
    expect(id('Bicep Curl (Dumbbell)')).toBe('ex-bicepscurl-med-manualer');
    expect(id('Pull Up')).toBe('ex-pull-ups');
    expect(id('Lateral Raise (Dumbbell)')).toBe('ex-sidehev');
    expect(id('Weird Machine Thing')).toBeUndefined();
  });
});

describe('Hevy', () => {
  it('blir økter med sets, oppvarming, egne øvelser og kondisjon', () => {
    const { source, data } = convertImport(HEVY_CSV, 'kg');
    expect(source).toBe('hevy');
    const b = parseBackup(data);
    expect(summarizeBackup(b)).toMatchObject({ workouts: 2, sets: 6 });
    const sets = b.tables.sets as unknown as { exercise_id: string; set_type: string; reps: number; distance_km: number | null }[];
    expect(sets.filter((s) => s.exercise_id === 'ex-benkpress').map((s) => s.set_type)).toEqual(['warmup', 'normal']);
    expect(sets.find((s) => s.exercise_id === 'ex-loping')).toMatchObject({ reps: 30, distance_km: 5 });
    const ex = b.tables.exercises as unknown as { name: string; custom: number }[];
    expect(ex.map((e) => e.name)).toEqual(['Weird Machine Thing']);
    expect((b.tables.workouts as unknown as { name: string }[]).map((w) => w.name)).toEqual(['Push', 'Legs']);
  });
  it('kan importeres to ganger uten duplikater', async () => {
    await importBackup(convertImport(HEVY_CSV, 'kg').data);
    await importBackup(convertImport(HEVY_CSV, 'kg').data);
    expect(await db.workouts.count()).toBe(2);
    expect(await db.sets.count()).toBe(6);
  });
});

describe('Strong', () => {
  it('hopper over hvile-rader, leser oppvarming og varighet', () => {
    const { source, data } = convertImport(STRONG_CSV, 'kg');
    expect(source).toBe('strong');
    const b = parseBackup(data);
    expect(summarizeBackup(b)).toMatchObject({ workouts: 1, sets: 4 });
    const w = b.tables.workouts[0] as unknown as { name: string; started_at: string; ended_at: string };
    expect(w.name).toBe('Pull, tung');
    expect(new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()).toBe(65 * 60 * 1000);
    expect((b.tables.sets as unknown as { set_type: string }[])[0].set_type).toBe('warmup');
  });
  it('regner om fra lbs når brukeren bruker lbs', () => {
    const b = parseBackup(convertImport(STRONG_CSV, 'lbs').data);
    const s = (b.tables.sets as unknown as { weight: number }[])[1];
    expect(s.weight).toBeCloseTo(63.5, 1);
  });
  it('ukjent fil gir en forståelig feil', () => {
    expect(() => convertImport('foo,bar\n1,2', 'kg')).toThrow(/Hevy eller Strong/);
  });
});
