import { describe, expect, it } from 'vitest';
import { lifetime, loadLevel, longestStreak, muscleLoad, thisWeekCount, trainedDaysThisWeek, weekKey, weekStreak, weeklySeries } from './stats';
import type { Workout, WorkoutSet } from '../db/types';

const w = (id: string, date: string): Workout => ({
  id,
  started_at: new Date(date + 'T18:00:00').toISOString(),
  ended_at: new Date(date + 'T19:00:00').toISOString(),
  routine_id: null,
  name: 'x',
  notes: '',
  updated_at: '',
  deleted: 0,
  dirty: 0,
});

describe('uker', () => {
  it('weekKey er mandagen', () => {
    expect(weekKey(new Date('2026-11-26T12:00:00'))).toBe('2026-11-23'); // torsdag
    expect(weekKey(new Date('2026-11-29T12:00:00'))).toBe('2026-11-23'); // søndag
    expect(weekKey(new Date('2027-01-01T12:00:00'))).toBe('2026-12-28'); // over årsskiftet
  });
});

describe('ukemål og streak', () => {
  const now = new Date('2026-11-26T20:00:00'); // torsdag
  const list = [
    w('a', '2026-11-23'), w('b', '2026-11-25'), // denne uka: 2
    w('c', '2026-11-16'), w('d', '2026-11-18'), w('e', '2026-11-20'), // forrige: 3
    w('f', '2026-11-10'), w('g', '2026-11-12'), // 2 uker siden: 2
    w('h', '2026-11-03'), // 3 uker siden: 1
  ];
  it('teller denne uka', () => expect(thisWeekCount(list, now)).toBe(2));
  it('treningsdager', () => expect(trainedDaysThisWeek(list, now)).toEqual([true, false, true, false, false, false, false]));
  it('streak med mål 2: denne + forrige + 2 uker siden', () => expect(weekStreak(list, 2, now)).toBe(3));
  it('pågående uke bryter ikke streaken', () => expect(weekStreak(list, 3, now)).toBe(1));
  it('lengste streak', () => expect(longestStreak(list, 2)).toBe(3));
  it('streak over årsskiftet', () => {
    const ny = [w('x', '2026-12-29'), w('y', '2027-01-05')];
    expect(weekStreak(ny, 1, new Date('2027-01-06T12:00:00'))).toBe(2);
  });
  it('slettede og pågående økter teller ikke', () => {
    expect(thisWeekCount([{ ...w('z', '2026-11-24'), deleted: 1 }, { ...w('q', '2026-11-24'), ended_at: null }], now)).toBe(0);
  });
});

describe('volum', () => {
  const s = (id: string, workout_id: string, weight: number, reps: number): WorkoutSet => ({
    id, workout_id, workout_exercise_id: 'we', exercise_id: 'ex', position: 0, weight, reps, set_type: 'normal',
    completed_at: '2026-11-25T18:10:00.000Z', updated_at: '', deleted: 0, dirty: 0,
  });
  it('ukeserie og livstid', () => {
    const ws = [w('a', '2026-11-25'), w('b', '2026-11-18')];
    const sets = [s('1', 'a', 100, 5), s('2', 'b', 50, 10), { ...s('3', 'b', 60, 10), set_type: 'warmup' as const }];
    const series = weeklySeries(ws, sets, 3, new Date('2026-11-26T12:00:00'));
    expect(series.map((x) => x.volume)).toEqual([0, 500, 500]);
    expect(lifetime(ws, sets)).toEqual({ workouts: 2, sets: 2, volume: 1000 });
  });
});

describe('muscleLoad', () => {
  const ex = (id: string, muscle_group: 'Bryst' | 'Bein' | 'Triceps') =>
    [id, { id, muscle_group, name: id, equipment: 'Stang', custom: 0, kind: 'weight', updated_at: '', deleted: 0, dirty: 0 }] as const;
  const exercises = new Map([ex('bench', 'Bryst'), ex('squat', 'Bein')]);
  const secondary = (id: string) => (id === 'bench' ? (['Triceps'] as const).slice() : []);
  const set = (id: string, exercise_id: string, completed_at: string, set_type: 'normal' | 'warmup' = 'normal'): WorkoutSet => ({
    id, exercise_id, completed_at, set_type, workout_id: 'w', workout_exercise_id: 'we', position: 0, weight: 100, reps: 5,
    updated_at: '', deleted: 0, dirty: 0,
  });
  const now = new Date('2026-11-26T12:00:00Z');

  it('hovedmuskel teller 1, sekundær 0,5, oppvarming og gamle sets teller ikke', () => {
    const load = muscleLoad(
      [
        set('1', 'bench', '2026-11-25T18:00:00Z'),
        set('2', 'bench', '2026-11-25T18:05:00Z'),
        set('3', 'bench', '2026-11-25T17:55:00Z', 'warmup'),
        set('4', 'squat', '2026-11-10T18:00:00Z'), // over 7 dager siden
      ],
      exercises as never,
      secondary as never,
      7,
      now,
    );
    expect(load.get('Bryst')).toEqual({ sets: 2, last: '2026-11-25T18:05:00Z' });
    expect(load.get('Triceps')?.sets).toBe(1);
    expect(load.has('Bein')).toBe(false);
  });

  it('nivåer per uke', () => {
    expect(loadLevel(0)).toBe(0);
    expect(loadLevel(0.5)).toBe(1);
    expect(loadLevel(4)).toBe(2);
    expect(loadLevel(12)).toBe(3);
    expect(loadLevel(20)).toBe(4);
    expect(loadLevel(20, 30)).toBe(2); // 20 sets over 30 dager ≈ 4,7 per uke
  });
});
