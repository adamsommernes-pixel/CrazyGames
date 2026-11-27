import { describe, expect, it } from 'vitest';
import {
  bestLifts,
  levelEventFor,
  liftScore,
  progressInTier,
  ratioForScore,
  scoreFromRatio,
  strengthProfile,
  tierFor,
  fallbackBodyweight,
} from './strength';

const ANCH = [0.5, 0.75, 1.0, 1.5, 1.9, 2.4];
let id = 0;
const set = (exercise: string, weight: number, reps: number, set_type = 'normal') => ({
  id: `s${++id}`,
  exercise_id: `ex-${exercise}`,
  weight,
  reps,
  set_type,
  completed_at: '2026-11-20T10:00:00Z',
});

describe('strength scoring', () => {
  it('interpolates between anchors and extrapolates above elite', () => {
    expect(scoreFromRatio(0.5, ANCH)).toBe(10);
    expect(scoreFromRatio(1.0, ANCH)).toBe(50);
    expect(scoreFromRatio(1.25, ANCH)).toBeCloseTo(60);
    expect(scoreFromRatio(0.25, ANCH)).toBeCloseTo(5);
    expect(scoreFromRatio(1.9, ANCH)).toBeCloseTo(85);
    expect(scoreFromRatio(2.4, ANCH)).toBeCloseTo(98);
    expect(scoreFromRatio(2.5, ANCH)).toBeCloseTo(100);
    expect(scoreFromRatio(5, ANCH)).toBe(100);
    expect(ratioForScore(60, ANCH)).toBeCloseTo(1.25);
  });

  it('maps scores to the ten tiers', () => {
    expect(tierFor(0).index).toBe(0);
    expect(tierFor(9.99).index).toBe(0);
    expect(tierFor(10).index).toBe(1);
    expect(tierFor(89.9).index).toBe(8);
    expect(tierFor(90).name).toBe('Olympia');
    expect(tierFor(100).index).toBe(9);
    expect(progressInTier(65)).toBeCloseTo(0.5);
    expect(progressInTier(95)).toBe(1);
  });

  it('uses different standards per sex, with an in-between scale', () => {
    const m = liftScore('ex-benkpress', 80, 80, 'male')!.score;
    const f = liftScore('ex-benkpress', 80, 80, 'female')!.score;
    const n = liftScore('ex-benkpress', 80, 80, null)!.score;
    expect(m).toBe(50);
    expect(f).toBeGreaterThan(m);
    expect(n).toBeGreaterThan(m);
    expect(n).toBeLessThan(f);
  });

  it('adds bodyweight for pull-ups and dips', () => {
    // 10 kg ekstra × 5 reps med 80 kg kroppsvekt: (90) × (1 + 5/30) = 105
    expect(bestLifts([set('pull-ups', 10, 5)], 80).get('ex-pull-ups')).toBeCloseTo(105);
    expect(liftScore('ex-pull-ups', 105, 80, 'male')!.bodyweightLoad).toBe(true);
  });

  it('scales close variants by their factor (incline bench)', () => {
    const inc = liftScore('ex-skrabenk', 68, 80, 'male')!; // 68 / 0.85 = 80 kg benk
    expect(inc.score).toBeCloseTo(liftScore('ex-benkpress', 80, 80, 'male')!.score);
    expect(inc.nextTierKg).toBeCloseTo(liftScore('ex-benkpress', 80, 80, 'male')!.nextTierKg! * 0.85);
  });

  it('only main lifts are ranked: machines and dumbbells give no level', () => {
    for (const slug of ['beinpress', 'hack-squat', 'nedtrekk', 'sittende-roing', 'smith-benkpress', 'benkpress-med-manualer', 'skulderpress-med-manualer', 'hip-thrust', 'bulgarsk-splittboy', 't-bar-roing'])
      expect(liftScore(`ex-${slug}`, 100, 80, 'male'), slug).toBeNull();
    expect(liftScore('ex-benkpress', 100, 80, 'male')).not.toBeNull();
  });

  it('ignores warm-ups, high-rep sets and unranked exercises', () => {
    const best = bestLifts([set('benkpress', 200, 1, 'warmup'), set('benkpress', 60, 20), set('sidehev', 20, 10)], 80);
    expect(best.size).toBe(0);
  });

  it('averages push, pull and legs, with a missing category counting as 0', () => {
    const p = strengthProfile([set('benkpress', 80, 1)], 80, 'male');
    expect(p.categories.push).toBe(50);
    expect(p.score).toBeCloseTo(50 / 3);
    expect(p.missing).toEqual(['pull', 'legs']);
    const full = strengthProfile([set('benkpress', 80, 1), set('stangroing', 76, 1), set('markloft', 148, 1)], 80, 'male');
    expect(full.score).toBeCloseTo(50);
    expect(full.tier.index).toBe(5);
    expect(full.missing).toEqual([]);
  });

  it('falls back to a default bodyweight per sex', () => {
    expect(fallbackBodyweight('male')).toBe(80);
    expect(fallbackBodyweight('female')).toBe(65);
    expect(fallbackBodyweight(null)).toBe(72);
  });

  it('only creates a level event for a new best 1RM', () => {
    const old = set('benkpress', 80, 5);
    const lighter = set('benkpress', 70, 5);
    expect(levelEventFor(lighter, [old, lighter], 80, 'male')).toBeNull();
    const warm = set('benkpress', 120, 3, 'warmup');
    expect(levelEventFor(warm, [old, warm], 80, 'male')).toBeNull();
    const heavy = set('benkpress', 100, 5);
    const ev = levelEventFor(heavy, [old, heavy], 80, 'male')!;
    expect(ev.after.score).toBeGreaterThan(ev.before!.score);
    expect(ev.overallAfter.score).toBeGreaterThan(ev.overallBefore.score);
    const first = set('kneboy', 60, 5);
    expect(levelEventFor(first, [first], 80, 'male')!.before).toBeNull();
  });
});
