import type { SetType } from '../db/types';

/** Fargen for hver set-type. Brukes i set-raden (merket W/D/F) og i set-menyen. */
export const SET_TYPE_COLOR: Record<SetType, string> = {
  normal: 'var(--color-accent)',
  warmup: 'var(--color-warn)',
  drop: '#38bdf8',
  failure: 'var(--color-danger)',
};

/** Myk bakgrunn i typens farge. */
export const setTypeSoft = (type: SetType, pct = 18) => `color-mix(in srgb, ${SET_TYPE_COLOR[type]} ${pct}%, transparent)`;
