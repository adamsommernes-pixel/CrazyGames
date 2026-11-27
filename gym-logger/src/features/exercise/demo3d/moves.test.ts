import { describe, expect, it } from 'vitest';
import { MOVES, moveFor, sample } from './moves';
import { RADII, jointAngle, len, sub, type V3 } from './rig';
import { NB_NAMED } from '../../../db/library';

const PHASES = Array.from({ length: 101 }, (_, i) => i / 100);

/** Avstand fra punktet `p` til en stang langs x-aksen gjennom `bar` (sett fra siden). */
const barDist = (p: V3, bar: V3) => Math.hypot(p[1] - bar[1], p[2] - bar[2]);
/** Klaring (sett fra siden) mellom stanga og overflaten på et avsmalnende lem fra `a` (radius r[0]) til `b` (r[1]). */
function clearance(a: V3, b: V3, r: readonly [number, number], bar: V3) {
  let best = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    best = Math.min(best, barDist(p, bar) - (r[0] + (r[1] - r[0]) * t) - RADII.bar);
  }
  return best;
}
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

describe('3D-demoer', () => {
  it('finnes for akkurat de 12 store løftene', () => {
    expect(MOVES.map((m) => m.slug).sort()).toEqual([...NB_NAMED].sort());
    expect(moveFor('ex-kneboy')?.slug).toBe('kneboy');
    expect(moveFor('ex-triceps-pushdown')).toBeUndefined();
  });

  for (const move of MOVES) {
    describe(move.slug, () => {
      it('har gyldige nøkkelposisjoner i løkke', () => {
        expect(move.keys.length).toBeGreaterThanOrEqual(2);
        expect(move.keys[0].t).toBe(0);
        expect(move.keys.at(-1)!.t).toBe(1);
        for (let i = 1; i < move.keys.length; i++) expect(move.keys[i].t).toBeGreaterThanOrEqual(move.keys[i - 1].t);
        expect(move.keys[0].cue).toBeTruthy();
      });

      it('hendene når fram, føttene står og leddene er innenfor normale vinkler', () => {
        for (const p of PHASES) {
          const { joints: j } = sample(move, p);
          for (const s of [0, 1]) {
            // Inntil 0,6 % for langt (3 mm) mellom nøkkelposisjonene er ikke synlig.
            expect(j.stretch.arms[s], `arm ${s} ved ${p}`).toBeLessThanOrEqual(1.006);
            expect(j.stretch.legs[s], `bein ${s} ved ${p}`).toBeLessThanOrEqual(1.0);
            const knee = jointAngle(j.hips[s], j.knees[s], j.ankles[s]);
            const elbow = jointAngle(j.shoulders[s], j.elbows[s], j.wrists[s]);
            expect(knee, `kne ${s} ved ${p}`).toBeGreaterThanOrEqual(35);
            expect(elbow, `albue ${s} ved ${p}`).toBeGreaterThanOrEqual(25);
            expect(j.toes[s][1], `tå ${s} ved ${p}`).toBeGreaterThanOrEqual(-0.005);
            expect(j.heels[s][1], `hæl ${s} ved ${p}`).toBeGreaterThanOrEqual(-0.005);
            expect(j.knees[s][1], `kne over gulvet ${s} ved ${p}`).toBeGreaterThan(0.04);
          }
        }
      });

      if (move.props.includes('barbell')) {
        it('stanga går ikke gjennom hodet eller beina', () => {
          for (const p of PHASES) {
            const { joints: j } = sample(move, p);
            const bar = mid(j.wrists[0], j.wrists[1]);
            expect(len(sub(bar, j.head)), `hode ved ${p}`).toBeGreaterThanOrEqual(0.12);
            for (const s of [0, 1]) {
              // Stanga kan streife beina (inntil 5 mm), men ikke gå gjennom dem.
              expect(clearance(j.knees[s], j.ankles[s], RADII.shin, bar), `legg ${s} ved ${p}`).toBeGreaterThanOrEqual(-0.005);
              expect(clearance(j.hips[s], j.knees[s], RADII.thigh, bar), `lår ${s} ved ${p}`).toBeGreaterThanOrEqual(-0.005);
            }
          }
        });
      }
    });
  }
});
