const LB_PER_KG = 2.20462262;

/** Vekt lagres alltid i kg. Viser i valgt enhet, avrundet til én desimal. */
export function toDisplay(kg: number, unit: 'kg' | 'lbs'): number {
  const v = unit === 'lbs' ? kg * LB_PER_KG : kg;
  return Math.round(v * 10) / 10;
}

export function fromDisplay(value: number, unit: 'kg' | 'lbs'): number {
  return unit === 'lbs' ? value / LB_PER_KG : value;
}

/** Tall med komma som desimaltegn, uten unødvendige desimaler. */
export function num(n: number, decimals = 1): string {
  return n.toLocaleString('nb-NO', { maximumFractionDigits: decimals });
}

/** Leser tall skrevet med komma eller punktum. */
export function parseNum(s: string): number {
  const n = parseFloat(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function weight(kg: number, unit: 'kg' | 'lbs'): string {
  return `${num(toDisplay(kg, unit))} ${unit}`;
}

export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function durationShort(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} t ${min % 60} min`;
}

export function dateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export function monthYear(iso: string): string {
  const s = new Date(iso).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «1 øvelse», «3 øvelser». */
export function plural(n: number, one: string, many: string): string {
  return `${num(n, 0)} ${n === 1 ? one : many}`;
}

/** Standardnavn på en økt ut fra tid på døgnet. */
export function defaultWorkoutName(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Nattøkt';
  if (h < 11) return 'Morgenøkt';
  if (h < 17) return 'Ettermiddagsøkt';
  return 'Kveldsøkt';
}
