export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateResult {
  /** Skiver på hver side, tyngste først. */
  perSide: number[];
  /** Vekt som ikke lar seg legge på med skivene (per side × 2). */
  remainder: number;
  /** Faktisk vekt med skivene. */
  achieved: number;
}

/** Hvilke skiver som skal på hver side for å nå målvekten. Grådig: tyngste skive først. */
export function platesPerSide(target: number, bar = 20, available = DEFAULT_PLATES): PlateResult {
  const plates = [...available].filter((p) => p > 0).sort((a, b) => b - a);
  let side = Math.max(0, (target - bar) / 2);
  const perSide: number[] = [];
  for (const p of plates) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  const loaded = perSide.reduce((s, p) => s + p, 0) * 2;
  const achieved = Math.round((Math.max(bar, target <= bar ? bar : bar + loaded)) * 100) / 100;
  return { perSide, remainder: Math.round(Math.max(0, target - achieved) * 100) / 100, achieved };
}
