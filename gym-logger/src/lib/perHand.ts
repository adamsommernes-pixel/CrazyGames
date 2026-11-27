import type { Exercise } from '../db/types';
import { t } from '../i18n';

// Manualer og kettlebells logges alltid med vekten på ÉN manual/kettlebell, også når du bruker to.
// Styrkeberegningen bygger på dette (f.eks. 40 kg per manual på manualbenk ≈ 100 kg benk), så
// logger noen begge til sammen, blir nivået dobbelt så høyt. Derfor sier appen det tydelig.

export type PerHand = 'dumbbell' | 'kettlebell';

export function perHand(ex: Pick<Exercise, 'equipment' | 'kind'> | null | undefined): PerHand | null {
  if (!ex || ex.kind === 'cardio') return null;
  if (ex.equipment === 'Manualer') return 'dumbbell';
  if (ex.equipment === 'Kettlebell') return 'kettlebell';
  return null;
}

/** Kort kolonnetittel: «kg/stk». */
export const perHandColumn = (unit: 'kg' | 'lbs') => t(`${unit}/stk`, `${unit} each`);

/** Forklaringen som vises i økta og på øvelsessiden. */
export const perHandHint = (p: PerHand) =>
  p === 'dumbbell'
    ? t('Logg vekten på én manual, ikke begge til sammen.', 'Log the weight of one dumbbell, not both together.')
    : t('Logg vekten på én kettlebell, ikke begge til sammen.', 'Log the weight of one kettlebell, not both together.');

/** Over dette (per manual) er det trolig to manualer lagt sammen. */
export const SUSPICIOUS_KG = 50;

/**
 * Manualøvelser sammenlignet med stangøvelsen: er vekten per manual høyere enn dette (andel av
 * stangløftets 1RM), er det trolig begge manualene lagt sammen.
 */
export const DUMBBELL_PAIRS: { dumbbell: string; barbell: string; max: number }[] = [
  { dumbbell: 'ex-benkpress-med-manualer', barbell: 'ex-benkpress', max: 0.6 },
  { dumbbell: 'ex-skrabenk-med-manualer', barbell: 'ex-skrabenk', max: 0.6 },
  { dumbbell: 'ex-skrabenk-med-manualer', barbell: 'ex-benkpress', max: 0.55 },
  { dumbbell: 'ex-skulderpress-med-manualer', barbell: 'ex-militaerpress', max: 0.6 },
  { dumbbell: 'ex-bicepscurl-med-manualer', barbell: 'ex-bicepscurl-med-stang', max: 0.65 },
  { dumbbell: 'ex-bulgarsk-splittboy', barbell: 'ex-kneboy', max: 0.5 },
];

/** Manualøvelser der vekten ser ut som begge manualene samlet. `best` er beste 1RM per øvelse. */
export function suspiciousDumbbells(best: Map<string, number>, checked: string[] = []) {
  const out = new Map<string, { dumbbell: string; barbell: string; dumbbellKg: number; barbellKg: number }>();
  for (const p of DUMBBELL_PAIRS) {
    const d = best.get(p.dumbbell);
    const b = best.get(p.barbell);
    if (!d || !b || checked.includes(p.dumbbell) || out.has(p.dumbbell)) continue;
    if (d > b * p.max) out.set(p.dumbbell, { dumbbell: p.dumbbell, barbell: p.barbell, dumbbellKg: d, barbellKg: b });
  }
  return [...out.values()];
}
