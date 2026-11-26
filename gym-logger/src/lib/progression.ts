import type { Equipment } from '../db/types';
import { platesPerSide } from './plates';

const LB = 0.45359237;

/** Hvor mye vekten bør øke per steg, i kg. Stang: 2,5 kg (5 lbs). Annet: 1 kg (2 lbs). */
export function stepFor(equipment: Equipment | undefined, unit: 'kg' | 'lbs'): number {
  const barbell = equipment === 'Stang';
  if (unit === 'lbs') return (barbell ? 5 : 2) * LB;
  return barbell ? 2.5 : 1;
}

interface WorkSet {
  weight: number;
  reps: number;
}

/**
 * Foreslått ny arbeidsvekt (kg) basert på forrige økt: hvis alle arbeidssett nådde
 * mål-reps, øk med ett steg. Ellers, eller uten mål eller historikk, ingen forslag.
 */
export function suggestNext(lastWork: WorkSet[], targetReps: number | null | undefined, stepKg: number): number | null {
  const sets = lastWork.filter((s) => s.weight > 0 && s.reps > 0);
  if (!sets.length || !targetReps || targetReps <= 0) return null;
  const top = Math.max(...sets.map((s) => s.weight));
  if (!sets.every((s) => s.reps >= targetReps)) return null;
  return Math.round((top + stepKg) * 1000) / 1000;
}

const WARMUP_SCHEME = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
];

/**
 * Oppvarmingssett før en tung arbeidsvekt (kg): 40/60/80 %, avrundet ned til noe som
 * faktisk kan lastes på stanga. Hopper over sett som blir like eller bare stang to ganger.
 */
export function warmupSets(workKg: number, barKg: number, plates: number[]): WorkSet[] {
  if (workKg <= barKg) return [];
  const out: WorkSet[] = [];
  for (const { pct, reps } of WARMUP_SCHEME) {
    const weight = Math.max(barKg, platesPerSide(workKg * pct, barKg, plates).achieved);
    if (weight >= workKg) continue;
    if (out.some((s) => s.weight === weight)) continue;
    out.push({ weight, reps });
  }
  return out;
}
