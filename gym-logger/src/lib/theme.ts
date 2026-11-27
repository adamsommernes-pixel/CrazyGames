// Brukerens egen appfarge. Én aksentfarge settes som CSS-variabler på <html>, og alle
// aksentklassene (bg-accent, text-accent, …) følger den. Fargen ligger i profilen og synkes.

export interface Swatch {
  hex: string;
  nb: string;
  en: string;
}

/** Kuraterte farger, alle lesbare mot den mørke bakgrunnen. */
export const SWATCHES: Swatch[] = [
  { hex: '#34c56a', nb: 'Grønn', en: 'Green' },
  { hex: '#4d9bf0', nb: 'Blå', en: 'Blue' },
  { hex: '#9b87f5', nb: 'Fiolett', en: 'Violet' },
  { hex: '#ef5f5f', nb: 'Rød', en: 'Red' },
  { hex: '#f08a3c', nb: 'Oransje', en: 'Orange' },
  { hex: '#e8c547', nb: 'Gul', en: 'Yellow' },
  { hex: '#ec6fa8', nb: 'Rosa', en: 'Pink' },
  { hex: '#e8e8e8', nb: 'Hvit', en: 'White' },
];

export const DEFAULT_ACCENT = SWATCHES[0].hex;
export const BG = '#0b0b0c';

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: RGB) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

function luminance([r, g, b]: RGB) {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Gyldig farge fra profilen, ellers standardfargen. Gamle profilfarger mappes til nærmeste nye. */
export function normalizeAccent(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return DEFAULT_ACCENT;
  if (SWATCHES.some((s) => s.hex.toLowerCase() === hex.toLowerCase())) return hex;
  // Nærmeste kuraterte farge (enkel avstand i RGB).
  const rgb = hexToRgb(hex);
  const d = (s: Swatch) => hexToRgb(s.hex).reduce((sum, v, i) => sum + (v - rgb[i]) ** 2, 0);
  return [...SWATCHES].sort((a, b) => d(a) - d(b))[0].hex;
}

export interface AccentPalette {
  accent: string;
  /** Dempet bakgrunn for valgt tilstand. */
  soft: string;
  /** Lysere variant for tekst på mørk bakgrunn. */
  strong: string;
  /** Tekst på aksentbakgrunn: svart eller hvit, det som gir best kontrast. */
  on: string;
}

export function accentPalette(hex: string): AccentPalette {
  const accent = normalizeAccent(hex);
  const rgb = hexToRgb(accent);
  return {
    accent,
    soft: toHex(mix(hexToRgb(BG), rgb, 0.22)),
    strong: toHex(mix(rgb, [255, 255, 255], 0.35)),
    on: contrast(accent, '#000000') >= contrast(accent, '#ffffff') ? '#0b0b0c' : '#ffffff',
  };
}

/** Setter aksentfargen for hele appen (CSS-variabler og nettleserens temafarge). */
export function applyAccent(hex: string | null | undefined) {
  const p = accentPalette(hex ?? DEFAULT_ACCENT);
  const root = document.documentElement.style;
  root.setProperty('--color-accent', p.accent);
  root.setProperty('--color-accent-soft', p.soft);
  root.setProperty('--color-accent-strong', p.strong);
  root.setProperty('--color-on-accent', p.on);
}

/** Aksentfargen akkurat nå (for canvas og SVG som tegnes utenfor CSS). */
export function currentAccent(): AccentPalette {
  const v = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() : '';
  return accentPalette(v || DEFAULT_ACCENT);
}
