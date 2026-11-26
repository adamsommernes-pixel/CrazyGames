import { describe, expect, it } from 'vitest';
import { stepFor, suggestNext, warmupSets } from './progression';
import { DEFAULT_PLATES } from './plates';

describe('stepFor', () => {
  it('stang 2,5 kg, annet 1 kg', () => {
    expect(stepFor('Stang', 'kg')).toBe(2.5);
    expect(stepFor('Manualer', 'kg')).toBe(1);
    expect(stepFor('Stang', 'lbs')).toBeCloseTo(2.268, 3);
  });
});

describe('suggestNext', () => {
  const set = (weight: number, reps: number) => ({ weight, reps });
  it('alle sett nådde målet → ett steg opp', () => expect(suggestNext([set(100, 5), set(100, 5), set(100, 6)], 5, 2.5)).toBe(102.5));
  it('ett sett under målet → ingen forslag', () => expect(suggestNext([set(100, 5), set(100, 4)], 5, 2.5)).toBeNull());
  it('første gang → ingen forslag', () => expect(suggestNext([], 5, 2.5)).toBeNull());
  it('uten mål → ingen forslag', () => expect(suggestNext([set(100, 5)], null, 2.5)).toBeNull());
  it('bruker tyngste vekt', () => expect(suggestNext([set(90, 8), set(100, 8)], 8, 1)).toBe(101));
});

describe('warmupSets', () => {
  it('100 kg gir 40/60/80 % avrundet til skiver', () =>
    expect(warmupSets(100, 20, DEFAULT_PLATES)).toEqual([
      { weight: 40, reps: 8 },
      { weight: 60, reps: 5 },
      { weight: 80, reps: 3 },
    ]));
  it('lette vekter: aldri under stang, ingen duplikater', () => {
    const w = warmupSets(40, 20, DEFAULT_PLATES);
    expect(w.every((s) => s.weight >= 20 && s.weight < 40)).toBe(true);
    expect(new Set(w.map((s) => s.weight)).size).toBe(w.length);
  });
  it('arbeidsvekt lik stang → ingen oppvarming', () => expect(warmupSets(20, 20, DEFAULT_PLATES)).toEqual([]));
});
