import { describe, expect, it } from 'vitest';
import { inRange, periodSeries, rangeBounds, yearsWithData } from './range';
import type { Workout, WorkoutSet } from '../db/types';

const now = new Date(2026, 10, 27, 12).getTime(); // 27. nov 2026
const iso = (y: number, m: number, d: number) => new Date(y, m, d, 10).toISOString();
const w = (id: string, at: string) => ({ id, started_at: at, ended_at: at, deleted: 0 }) as unknown as Workout;
const s = (wid: string, weight: number, reps: number) =>
  ({ id: `${wid}-s`, workout_id: wid, exercise_id: 'ex-kneboy', weight, reps, set_type: 'normal', completed_at: '2026-01-01T00:00:00Z', deleted: 0 }) as unknown as WorkoutSet;

describe('tidsrom', () => {
  it('7 d og 30 d teller dager, 12 mnd og år teller måneder', () => {
    expect(rangeBounds({ kind: '7d' }, now)).toMatchObject({ days: 7, bucket: 'day' });
    expect(rangeBounds({ kind: '30d' }, now)).toMatchObject({ days: 30, bucket: 'day' });
    expect(rangeBounds({ kind: '12m' }, now).bucket).toBe('month');
    const y = rangeBounds({ kind: 'year', year: 2025 }, now);
    expect(inRange(iso(2025, 0, 1), y)).toBe(true);
    expect(inRange(iso(2025, 11, 31), y)).toBe(true);
    expect(inRange(iso(2026, 0, 1), y)).toBe(false);
  });

  it('grafen får én stolpe per dag eller måned med volum og økter', () => {
    const ws = [w('a', iso(2026, 10, 26)), w('b', iso(2026, 9, 5)), w('c', iso(2025, 2, 1))];
    const sets = [s('a', 100, 5), s('b', 50, 10), s('c', 80, 1)];
    const week = periodSeries(ws, sets, { kind: '7d' }, now);
    expect(week).toHaveLength(7);
    expect(week.at(-2)).toMatchObject({ workouts: 1, volume: 500 });
    const year = periodSeries(ws, sets, { kind: 'year', year: 2026 }, now);
    expect(year).toHaveLength(11); // jan–nov (til i dag)
    expect(year[9]).toMatchObject({ workouts: 1, volume: 500 });
    const months = periodSeries(ws, sets, { kind: '12m' }, now);
    expect(months).toHaveLength(12);
    expect(months.reduce((n, m) => n + m.workouts, 0)).toBe(2); // mars 2025 er utenfor
  });

  it('årene med data, nyeste først', () => {
    expect(yearsWithData([iso(2024, 1, 1), iso(2026, 1, 1)], new Date(now))).toEqual([2026, 2024]);
  });
});
