// Tidsrom for data og grafer: 7 dager, 30 dager, 12 måneder eller et bestemt år.
// Valget huskes (per enhet) og gjelder alle sider, så brukeren slipper å velge på nytt.
import type { Workout, WorkoutSet } from '../db/types';
import { countsAsWork } from './calc';
import { locale, t } from '../i18n';

export type Range = { kind: '7d' } | { kind: '30d' } | { kind: '12m' } | { kind: 'year'; year: number };

const DAY = 86_400_000;

export interface Bounds {
  from: number;
  to: number;
  /** Antall dager i perioden (brukes til «per uke»-beregninger). */
  days: number;
  /** Hvordan stolpene grupperes. */
  bucket: 'day' | 'month';
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function rangeBounds(r: Range, now = Date.now()): Bounds {
  if (r.kind === 'year') {
    const from = new Date(r.year, 0, 1).getTime();
    const end = new Date(r.year + 1, 0, 1).getTime() - 1;
    const to = Math.min(end, now);
    return { from, to, days: Math.max(1, Math.ceil((to - from) / DAY)), bucket: 'month' };
  }
  if (r.kind === '12m') {
    const d = new Date(now);
    const from = new Date(d.getFullYear(), d.getMonth() - 11, 1).getTime();
    return { from, to: now, days: Math.ceil((now - from) / DAY), bucket: 'month' };
  }
  const n = r.kind === '7d' ? 7 : 30;
  return { from: startOfDay(now) - (n - 1) * DAY, to: now, days: n, bucket: 'day' };
}

export const inRange = (iso: string | null | undefined, b: Bounds) => {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return ms >= b.from && ms <= b.to;
};

export function rangeLabel(r: Range): string {
  switch (r.kind) {
    case '7d':
      return t('Siste 7 dager', 'Last 7 days');
    case '30d':
      return t('Siste 30 dager', 'Last 30 days');
    case '12m':
      return t('Siste 12 måneder', 'Last 12 months');
    default:
      return t(`I ${r.year}`, `In ${r.year}`);
  }
}

/** Volum og antall økter per dag (7 d / 30 d) eller per måned (12 mnd / år), eldste først. */
export function periodSeries(workouts: Workout[], sets: WorkoutSet[], r: Range, now = Date.now()) {
  const b = rangeBounds(r, now);
  const key = (ms: number) => {
    const d = new Date(ms);
    return b.bucket === 'day' ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : `${d.getFullYear()}-${d.getMonth()}`;
  };
  const buckets: { key: string; start: number; x: string; volume: number; workouts: number }[] = [];
  if (b.bucket === 'day') {
    for (let ms = startOfDay(b.from); ms <= b.to; ms += DAY) {
      const d = new Date(ms);
      buckets.push({ key: key(ms), start: ms, x: `${d.getDate()}.${d.getMonth() + 1}`, volume: 0, workouts: 0 });
    }
  } else {
    const d = new Date(b.from);
    for (let m = new Date(d.getFullYear(), d.getMonth(), 1); m.getTime() <= b.to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      buckets.push({ key: key(m.getTime()), start: m.getTime(), x: m.toLocaleDateString(locale(), { month: 'short' }).replace('.', ''), volume: 0, workouts: 0 });
    }
  }
  const byKey = new Map(buckets.map((x) => [x.key, x]));
  const done = workouts.filter((w) => !w.deleted && w.ended_at && inRange(w.started_at, b));
  const wMap = new Map(done.map((w) => [w.id, w]));
  for (const w of done) {
    const x = byKey.get(key(Date.parse(w.started_at)));
    if (x) x.workouts++;
  }
  for (const s of sets) {
    const w = wMap.get(s.workout_id);
    if (!w || s.deleted || !countsAsWork(s)) continue;
    const x = byKey.get(key(Date.parse(w.started_at)));
    if (x) x.volume += s.weight * s.reps;
  }
  return buckets;
}

/** År som har data (nyeste først), alltid med inneværende år. */
export function yearsWithData(dates: (string | null | undefined)[], now = new Date()): number[] {
  const ys = new Set<number>([now.getFullYear()]);
  for (const d of dates) if (d) ys.add(new Date(d).getFullYear());
  return [...ys].sort((a, b) => b - a);
}
