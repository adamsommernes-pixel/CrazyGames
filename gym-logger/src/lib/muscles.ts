import type { MuscleGroup } from '../db/types';

/**
 * Én fargetone per muskelgruppe. Brukes bare som små prikker og merker, så appens
 * svart-grønne uttrykk står urørt. Grønn er holdt av til aksenten.
 */
export const MUSCLE_COLOR: Record<MuscleGroup, string> = {
  Bryst: '#f87171',
  Rygg: '#818cf8',
  Skuldre: '#fbbf24',
  Biceps: '#c084fc',
  Triceps: '#f472b6',
  Underarmer: '#fb923c',
  Bein: '#2dd4bf',
  Rumpe: '#e879f9',
  Mage: '#facc15',
  Kondisjon: '#38bdf8',
  Annet: '#9ba59f',
};
