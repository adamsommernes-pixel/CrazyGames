export type EnglishTuple = [slug: string, name: string, steps: string[], tips: string[], mistakes: string[]];

/** Short form for an English library entry. */
export function e(slug: string, name: string, steps: string[], tips: string[], mistakes: string[]): EnglishTuple {
  return [slug, name, steps, tips, mistakes];
}
