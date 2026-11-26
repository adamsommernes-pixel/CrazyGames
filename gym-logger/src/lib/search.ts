/**
 * Gjør tekst sammenlignbar for søk: små bokstaver, æ/ø/å skrevet om, aksenter,
 * mellomrom og bindestreker fjernet. «kneboy» finner da «Knebøy», og «mark loft» finner «Markløft».
 */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchesSearch(text: string, query: string): boolean {
  const q = normalizeSearch(query);
  return !q || normalizeSearch(text).includes(q);
}
