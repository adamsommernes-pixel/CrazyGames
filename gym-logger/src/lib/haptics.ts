import { getSetting } from './settings';

/** Kort vibrasjon (Android). iPhone-nettlesere støtter ikke vibrasjon, så der skjer ingenting. */
export async function buzz(pattern: number | number[] = 12) {
  try {
    if (await getSetting('haptics')) navigator.vibrate?.(pattern);
  } catch {
    /* ignorer */
  }
}
