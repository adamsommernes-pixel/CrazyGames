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
