export interface SetLike {
  weight: number;
  reps: number;
  set_type?: string;
  completed_at?: string | null;
}

/** Beregnet 1RM etter Epley. Ett rep = selve vekten. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Sets som teller: fullført, ikke oppvarming, og med reps. */
export function countsAsWork(s: SetLike): boolean {
  return !!s.completed_at && s.set_type !== 'warmup' && s.reps > 0;
}

export function volume(sets: SetLike[]): number {
  return sets.filter(countsAsWork).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function heaviest(sets: SetLike[]): number {
  return sets.filter(countsAsWork).reduce((m, s) => Math.max(m, s.weight), 0);
}

export function best1RM(sets: SetLike[]): number {
  return sets.filter(countsAsWork).reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0);
}

export type PRKind = 'weight' | '1rm' | 'reps';

export const PR_LABEL: Record<PRKind, string> = {
  weight: 'Tyngste',
  '1rm': 'Beste 1RM',
  reps: 'Flest reps',
};

const EPS = 1e-9;

/**
 * Hvilke rekorder settet slår, sammenlignet med alle tidligere sets på samme øvelse.
 * - weight: tyngre enn noen gang
 * - 1rm: høyere beregnet 1RM enn noen gang
 * - reps: flere reps enn før på denne vekten eller tyngre (bare når vekten er løftet før)
 * Første gang en øvelse logges gir ingen PR, ellers blir alt en rekord.
 */
export function detectPRs(set: SetLike, prior: SetLike[]): PRKind[] {
  if (!countsAsWork(set)) return [];
  const work = prior.filter(countsAsWork);
  if (work.length === 0) return [];
  const prs: PRKind[] = [];
  if (set.weight > heaviest(work) + EPS) prs.push('weight');
  if (estimate1RM(set.weight, set.reps) > best1RM(work) + EPS) prs.push('1rm');
  const atOrAbove = work.filter((s) => s.weight >= set.weight - EPS);
  if (atOrAbove.length > 0 && set.reps > Math.max(...atOrAbove.map((s) => s.reps))) prs.push('reps');
  return prs;
}

/**
 * PR-er for alle sets i én økt. Hvert set sammenlignes med historikken pluss
 * sets som ble fullført tidligere i samme økt, så bare ekte nye bestenoteringer merkes.
 */
export function detectPRsInOrder<T extends SetLike & { id: string }>(
  sessionSets: T[],
  history: SetLike[],
): Map<string, PRKind[]> {
  const result = new Map<string, PRKind[]>();
  const done = sessionSets
    .filter(countsAsWork)
    .sort((a, b) => (a.completed_at! < b.completed_at! ? -1 : 1));
  const seen: SetLike[] = [...history];
  for (const s of done) {
    const prs = detectPRs(s, seen);
    if (prs.length) result.set(s.id, prs);
    seen.push(s);
  }
  return result;
}
