import { describe, expect, it } from 'vitest';
import { BACK, FRONT } from './anatomy';
import { MUSCLE_GROUPS } from '../../db/types';

describe('kroppskart', () => {
  it('alle muskelgrupper unntatt kondisjon har minst én del', () => {
    const groups = new Set([...FRONT, ...BACK].map((p) => p[0]));
    for (const g of MUSCLE_GROUPS.filter((g) => g !== 'Kondisjon' && g !== 'Annet')) expect(groups.has(g), g).toBe(true);
  });
  it('alle polygoner er gyldige og innenfor tegneflaten', () => {
    for (const [, , pts] of [...FRONT, ...BACK]) {
      expect(pts.length % 2).toBe(0);
      expect(pts.length).toBeGreaterThanOrEqual(6);
      pts.forEach((v, i) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(i % 2 ? 206 : 100);
      });
    }
  });
});
