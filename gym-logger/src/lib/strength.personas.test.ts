import { describe, expect, it } from 'vitest';
import { isImplausible, strengthProfile } from './strength';
import type { Sex } from '../db/types';

// Realistiske løftere, slik at nivåene føles rettferdige og Olympia er vanskelig.
// Tall er 1RM i kg (eller ekstravekt × reps for pull-ups og dips).

type Lift = [slug: string, weight: number, reps?: number];
interface Persona {
  name: string;
  sex: Sex;
  bw: number;
  lifts: Lift[];
  /** Laveste og høyeste godkjente nivå (0 = Nybegynner … 9 = Olympia). */
  tiers: [number, number];
}

const P: Persona[] = [
  // Menn, 80 kg
  { name: 'M første måned', sex: 'male', bw: 80, tiers: [0, 1], lifts: [['benkpress', 40], ['kneboy', 50], ['stangroing', 40], ['nedtrekk', 50]] },
  { name: 'M 6 måneder', sex: 'male', bw: 80, tiers: [2, 3], lifts: [['benkpress', 65], ['kneboy', 90], ['markloft', 110], ['pull-ups', 0, 5]] },
  { name: 'M 2 år', sex: 'male', bw: 80, tiers: [4, 5], lifts: [['benkpress', 90], ['kneboy', 120], ['markloft', 150], ['pull-ups', 10, 5]] },
  { name: 'M avansert', sex: 'male', bw: 80, tiers: [6, 7], lifts: [['benkpress', 120], ['kneboy', 160], ['markloft', 200], ['pull-ups', 30, 5]] },
  { name: 'M nasjonalt nivå', sex: 'male', bw: 80, tiers: [8, 8], lifts: [['benkpress', 160], ['kneboy', 210], ['markloft', 240], ['pull-ups', 40, 5]] },
  { name: 'M verdensklasse', sex: 'male', bw: 80, tiers: [9, 9], lifts: [['benkpress', 195], ['kneboy', 260], ['markloft', 290], ['pull-ups', 60, 5]] },
  { name: 'M bare maskiner (beinpress og nedtrekk teller)', sex: 'male', bw: 80, tiers: [1, 3], lifts: [['beinpress', 300], ['hip-thrust', 200], ['smith-benkpress', 100], ['nedtrekk', 90]] },
  { name: 'M enorme maskintall (maks Sterk)', sex: 'male', bw: 80, tiers: [3, 4], lifts: [['beinpress', 600], ['hip-thrust', 400], ['smith-benkpress', 200], ['nedtrekk', 160]] },
  { name: 'M bare benk', sex: 'male', bw: 80, tiers: [1, 3], lifts: [['benkpress', 120]] },
  // Kvinner, 62 kg
  { name: 'K første måned', sex: 'female', bw: 62, tiers: [0, 1], lifts: [['benkpress', 20], ['kneboy', 30], ['stangroing', 20], ['nedtrekk', 30]] },
  { name: 'K 6 måneder', sex: 'female', bw: 62, tiers: [2, 3], lifts: [['benkpress', 35], ['kneboy', 60], ['markloft', 75], ['stangroing', 35]] },
  { name: 'K 2 år', sex: 'female', bw: 62, tiers: [4, 5], lifts: [['benkpress', 50], ['kneboy', 85], ['markloft', 105], ['pull-ups', 0, 3]] },
  { name: 'K avansert', sex: 'female', bw: 62, tiers: [6, 7], lifts: [['benkpress', 62], ['kneboy', 100], ['markloft', 125], ['pull-ups', 8, 5]] },
  { name: 'K verdensklasse', sex: 'female', bw: 62, tiers: [9, 9], lifts: [['benkpress', 100], ['kneboy', 165], ['markloft', 190], ['pull-ups', 35, 5]] },
];

const profileOf = (p: Persona) =>
  strengthProfile(
    p.lifts.map(([slug, weight, reps = 1], i) => ({ id: `${i}`, exercise_id: `ex-${slug}`, weight, reps, set_type: 'normal', completed_at: new Date().toISOString() })),
    p.bw,
    p.sex,
  );

describe('strength personas', () => {
  it('prints the table', () => {
    const rows = P.map((p) => {
      const s = profileOf(p);
      return `${p.name.padEnd(22)} ${s.score.toFixed(1).padStart(5)}  ${s.tier.name.padEnd(11)} push ${s.categories.push.toFixed(0).padStart(3)} pull ${s.categories.pull.toFixed(0).padStart(3)} legs ${s.categories.legs.toFixed(0).padStart(3)}`;
    });
    console.log('\n' + rows.join('\n'));
  });

  for (const p of P) {
    it(`${p.name} lands in the expected levels`, () => {
      const s = profileOf(p);
      expect(s.tier.index, `${p.name}: ${s.score.toFixed(1)} ${s.tier.name}`).toBeGreaterThanOrEqual(p.tiers[0]);
      expect(s.tier.index, `${p.name}: ${s.score.toFixed(1)} ${s.tier.name}`).toBeLessThanOrEqual(p.tiers[1]);
    });
  }

  it('Elite in all three is not enough for Olympia', () => {
    const s = profileOf({ name: '', sex: 'male', bw: 80, tiers: [0, 0], lifts: [['benkpress', 152], ['stangroing', 132], ['kneboy', 208]] });
    expect(s.tier.name).toBe('Elite');
  });

  it('ignores typos', () => {
    const typo = { id: 't', exercise_id: 'ex-benkpress', weight: 1000, reps: 1, set_type: 'normal', completed_at: new Date().toISOString() };
    expect(isImplausible(typo, 80, 'male')).toBe(true);
    expect(isImplausible({ ...typo, weight: 200 }, 80, 'male')).toBe(false);
    expect(strengthProfile([typo], 80, 'male').lifts).toHaveLength(0);
  });
});
