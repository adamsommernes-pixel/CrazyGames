// Passord lagres aldri i klartekst: PBKDF2-SHA256 med tilfeldig salt via WebCrypto.

const ITERATIONS = 210_000;

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password: string, salt: string, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations },
    key,
    256,
  );
  return toB64(bits);
}

/** Sammenligning i konstant tid, så tidsbruk ikke røper hvor mye som stemte. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 0–4: hvor sterkt passordet er, til styrkemåleren. */
export function passwordStrength(pw: string): number {
  if (pw.length < 8) return pw.length ? 1 : 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-zæøå]/.test(pw) && /[A-ZÆØÅ]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9æøåÆØÅ]/.test(pw)) score++;
  else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 0.5;
  return Math.min(4, Math.floor(score));
}
