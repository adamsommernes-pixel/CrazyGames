// @brukernavn: 3–20 tegn, små bokstaver, tall, _ og punktum (samme regel som i databasen).

export const HANDLE_RE = /^[a-z0-9_.]{3,20}$/;

const FOLD: Record<string, string> = { æ: 'ae', ø: 'o', å: 'a', ä: 'a', ö: 'o', ü: 'u', ß: 'ss' };

/** Rydder det brukeren skriver: små bokstaver, uten @, æøå gjort om, ulovlige tegn fjernet. */
export function cleanHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[æøåäöüß]/g, (c) => FOLD[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 20);
}

/** Forslag ut fra navnet («Ola Nordmann» → «ola_nordmann»). Alltid gyldig format. */
export function suggestHandle(name: string): string {
  let h = cleanHandle(name.trim()).replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  if (!h) return 'lofter';
  if (h.length < 3) h += '123'.slice(0, 3 - h.length);
  return h.slice(0, 20);
}

/** Varianter å prøve når forslaget er tatt: ola_nordmann, ola_nordmann2, … */
export function handleCandidates(base: string, n = 6): string[] {
  return [base, ...Array.from({ length: n - 1 }, (_, i) => {
    const suffix = String(i + 2);
    return `${base.slice(0, 20 - suffix.length)}${suffix}`;
  })];
}

export const isValidHandle = (h: string) => HANDLE_RE.test(h);
