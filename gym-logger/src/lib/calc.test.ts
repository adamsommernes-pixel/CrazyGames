import { describe, expect, it } from 'vitest';
import { best1RM, detectPRs, detectPRsInOrder, estimate1RM, heaviest, volume } from './calc';

const done = '2026-01-01T10:00:00Z';
const s = (weight: number, reps: number, extra: object = {}) => ({ weight, reps, completed_at: done, ...extra });

describe('estimate1RM', () => {
  it('gir vekten ved 1 rep', () => expect(estimate1RM(100, 1)).toBe(100));
  it('bruker Epley', () => expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 2));
  it('gir 0 for tomme sets', () => expect(estimate1RM(0, 5)).toBe(0));
});

describe('volum og tyngste', () => {
  const sets = [s(100, 5), s(60, 10, { is_warmup: 1 }), s(110, 3), { weight: 200, reps: 1, completed_at: null }];
  it('teller bare fullførte arbeidssett', () => {
    expect(volume(sets)).toBe(100 * 5 + 110 * 3);
    expect(heaviest(sets)).toBe(110);
    expect(best1RM(sets)).toBeCloseTo(estimate1RM(110, 3), 5);
  });
});

describe('detectPRs', () => {
  const history = [s(100, 5), s(90, 8)];
  it('ingen PR første gang', () => expect(detectPRs(s(50, 5), [])).toEqual([]));
  it('vekt-PR og 1RM-PR', () => expect(detectPRs(s(105, 5), history)).toEqual(['weight', '1rm']));
  it('reps-PR på samme vekt', () => expect(detectPRs(s(100, 6), history)).toEqual(['1rm', 'reps']));
  it('ingen PR for lettere og færre', () => expect(detectPRs(s(90, 7), history)).toEqual([]));
  it('oppvarming gir ikke PR', () => expect(detectPRs(s(200, 1, { is_warmup: 1 }), history)).toEqual([]));
});

describe('detectPRsInOrder', () => {
  it('merker bare ny beste i samme økt', () => {
    const session = [
      { id: 'a', weight: 105, reps: 3, completed_at: '2026-02-01T10:00:00Z' },
      { id: 'b', weight: 105, reps: 3, completed_at: '2026-02-01T10:05:00Z' },
      { id: 'c', weight: 107.5, reps: 2, completed_at: '2026-02-01T10:10:00Z' },
    ];
    const prs = detectPRsInOrder(session, [s(100, 5)]);
    expect(prs.get('a')).toContain('weight');
    expect(prs.has('b')).toBe(false);
    expect(prs.get('c')).toContain('weight');
  });
});
