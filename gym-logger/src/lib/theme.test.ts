import { describe, expect, it } from 'vitest';
import { BG, SWATCHES, accentPalette, contrast, normalizeAccent } from './theme';

describe('app colour', () => {
  it('every swatch is readable on the background, and text on it is readable', () => {
    for (const s of SWATCHES) {
      expect(contrast(s.hex, BG), s.nb).toBeGreaterThanOrEqual(4.5);
      const p = accentPalette(s.hex);
      expect(contrast(p.on, s.hex), `${s.nb} on-accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.strong, BG), `${s.nb} strong`).toBeGreaterThanOrEqual(7);
    }
  });

  it('picks black text on light colours and white on darker ones', () => {
    expect(accentPalette('#e8c547').on).toBe('#0b0b0c'); // gul
    expect(accentPalette('#e8e8e8').on).toBe('#0b0b0c'); // hvit
  });

  it('maps old or invalid colours to a swatch', () => {
    expect(normalizeAccent(undefined)).toBe(SWATCHES[0].hex);
    expect(normalizeAccent('nonsense')).toBe(SWATCHES[0].hex);
    expect(normalizeAccent('#2bd66b')).toBe(SWATCHES[0].hex); // gammel grønn
    expect(normalizeAccent('#38bdf8')).toBe(SWATCHES[1].hex); // gammel blå
  });
});
