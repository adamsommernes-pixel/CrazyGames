/** Booking references: six characters without look-alikes (no 0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function createReference(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}

export function normalizeReference(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
