import type { Exercise, Sex } from '../db/types';
import { countsAsWork, estimate1RM, type SetLike } from './calc';
import { t } from '../i18n';

// Styrkenivå: beste beregnede 1RM i nøkkelløft, delt på kroppsvekt, sammenlignet med standarder.
// Rene funksjoner, ingen database. Live-delen ligger i strengthLive.ts.

export type Category = 'push' | 'pull' | 'legs';
export const CATEGORIES: Category[] = ['push', 'pull', 'legs'];
export const CATEGORY_LABEL: Record<Category, string> = {
  get push() { return t('Press', 'Push'); },
  get pull() { return t('Trekk', 'Pull'); },
  get legs() { return t('Bein', 'Legs'); },
};

export interface Tier {
  index: number; // 0–9
  min: number;
  name: string;
}

const TIER_NAMES: [string, string][] = [
  ['Nybegynner', 'Newbie'],
  ['Rookie', 'Rookie'],
  ['Stamgjest', 'Regular'],
  ['Gymrotte', 'Gym Rat'],
  ['Løfter', 'Lifter'],
  ['Sterk', 'Strong'],
  ['Beist', 'Beast'],
  ['Titan', 'Titan'],
  ['Elite', 'Elite'],
  ['Olympia', 'Olympia'],
];

export const TIER_COUNT = TIER_NAMES.length;

export function tierAt(index: number): Tier {
  const i = Math.max(0, Math.min(TIER_COUNT - 1, index));
  return { index: i, min: i * 10, name: t(...TIER_NAMES[i]) };
}

export function tierFor(score: number): Tier {
  return tierAt(Math.floor(Math.max(0, score) / 10));
}

/** 0–1: hvor langt man er kommet mot neste nivå. 1 på toppnivået. */
export function progressInTier(score: number): number {
  const tier = tierFor(score);
  if (tier.index === TIER_COUNT - 1) return 1;
  return Math.max(0, Math.min(1, (score - tier.min) / 10));
}

// Standarder: 1RM som andel av kroppsvekt ved poengsum 10, 30, 50, 70, 85 og 98
// (nybegynner, novise, middels, avansert, elite og verdensklasse). Olympia (90+) krever
// dermed nær verdensklasse i både press, trekk og bein.
type Anchors = [number, number, number, number, number, number];
const SCORES = [10, 30, 50, 70, 85, 98];

type AnchorId = 'bench' | 'squat' | 'deadlift' | 'ohp' | 'row' | 'pullup' | 'dip';

const STANDARDS: Record<AnchorId, { male: Anchors; female: Anchors; category: Category }> = {
  bench: { male: [0.5, 0.75, 1.0, 1.5, 1.9, 2.4], female: [0.3, 0.5, 0.8, 1.15, 1.5, 1.85], category: 'push' },
  ohp: { male: [0.35, 0.5, 0.7, 0.95, 1.2, 1.5], female: [0.2, 0.35, 0.5, 0.7, 0.95, 1.2], category: 'push' },
  dip: { male: [1.0, 1.2, 1.45, 1.8, 2.1, 2.5], female: [0.9, 1.05, 1.2, 1.5, 1.8, 2.1], category: 'push' },
  row: { male: [0.5, 0.7, 0.95, 1.3, 1.65, 2.0], female: [0.3, 0.5, 0.75, 1.05, 1.35, 1.7], category: 'pull' },
  pullup: { male: [1.0, 1.12, 1.3, 1.55, 1.85, 2.2], female: [0.9, 1.0, 1.15, 1.4, 1.65, 1.95], category: 'pull' },
  squat: { male: [0.75, 1.15, 1.5, 2.0, 2.6, 3.2], female: [0.5, 0.8, 1.2, 1.7, 2.3, 2.8], category: 'legs' },
  deadlift: { male: [1.0, 1.4, 1.85, 2.5, 3.0, 3.6], female: [0.65, 1.0, 1.45, 2.0, 2.6, 3.2], category: 'legs' },
};

/** Varianter (maskiner, manualer, hip thrust) kan gi høyst dette: Beist. Titan og over krever hovedløft. */
export const VARIANT_CAP = 69;
/** Sets som er mer enn så mye over verdensklasse regnes som tastefeil og teller ikke. */
const IMPLAUSIBLE = 1.5;
/** Høyeste antall reps som brukes til å beregne 1RM. */
export const MAX_REPS = 10;

/**
 * Rangerte øvelser (slug → ankerløft og faktor). Faktoren sier hvor tungt løftet er
 * sammenlignet med ankeret: 0,4 på manualbenk betyr at 40 kg per manual tilsvarer 100 kg benk.
 * `load: 'bw'` betyr at kroppsvekten legges til ekstravekten (pull-ups, dips).
 * `variant: true` gir maks VARIANT_CAP poeng.
 */
export const RANKED: Record<string, { anchor: AnchorId; factor: number; load?: 'bw'; variant?: true }> = {
  benkpress: { anchor: 'bench', factor: 1 },
  skrabenk: { anchor: 'bench', factor: 0.85 },
  'smal-benkpress': { anchor: 'bench', factor: 0.9 },
  'smith-benkpress': { anchor: 'bench', factor: 1.08, variant: true },
  'benkpress-med-manualer': { anchor: 'bench', factor: 0.4, variant: true },
  'skrabenk-med-manualer': { anchor: 'bench', factor: 0.35, variant: true },
  militaerpress: { anchor: 'ohp', factor: 1 },
  'sittende-militaerpress': { anchor: 'ohp', factor: 1 },
  'skulderpress-med-manualer': { anchor: 'ohp', factor: 0.38, variant: true },
  dips: { anchor: 'dip', factor: 1, load: 'bw' },
  stangroing: { anchor: 'row', factor: 1 },
  'pendlay-roing': { anchor: 'row', factor: 1 },
  't-bar-roing': { anchor: 'row', factor: 1.1, variant: true },
  'sittende-roing': { anchor: 'row', factor: 0.9, variant: true },
  'pull-ups': { anchor: 'pullup', factor: 1, load: 'bw' },
  'chin-ups': { anchor: 'pullup', factor: 1.05, load: 'bw' },
  nedtrekk: { anchor: 'pullup', factor: 0.95, variant: true },
  kneboy: { anchor: 'squat', factor: 1 },
  'box-squat': { anchor: 'squat', factor: 1 },
  frontboy: { anchor: 'squat', factor: 0.8 },
  'hack-squat': { anchor: 'squat', factor: 1.2, variant: true },
  beinpress: { anchor: 'squat', factor: 2.6, variant: true },
  'bulgarsk-splittboy': { anchor: 'squat', factor: 0.35, variant: true },
  markloft: { anchor: 'deadlift', factor: 1 },
  'sumo-markloft': { anchor: 'deadlift', factor: 1 },
  'trap-bar-markloft': { anchor: 'deadlift', factor: 1.05 },
  'rumensk-markloft': { anchor: 'deadlift', factor: 0.75 },
  'hip-thrust': { anchor: 'deadlift', factor: 1.5, variant: true },
};

const slugOf = (exerciseId: string) => exerciseId.replace(/^ex-/, '');
export const rankOf = (exerciseId: string) => RANKED[slugOf(exerciseId)];
export const isRanked = (exerciseId: string) => !!rankOf(exerciseId);

function anchorsFor(anchor: AnchorId, sex: Sex | null): Anchors {
  const s = STANDARDS[anchor];
  if (sex === 'male') return s.male;
  if (sex === 'female') return s.female;
  return s.male.map((m, i) => (m + s.female[i]) / 2) as Anchors;
}

/** Ratio (1RM / kroppsvekt, omregnet til ankerløftet) → poeng 0–100. Lineært mellom ankerpunktene. */
export function scoreFromRatio(ratio: number, anchors: readonly number[]): number {
  if (ratio <= 0) return 0;
  if (ratio <= anchors[0]) return (ratio / anchors[0]) * SCORES[0];
  for (let i = 1; i < anchors.length; i++) {
    if (ratio <= anchors[i]) return SCORES[i - 1] + ((ratio - anchors[i - 1]) / (anchors[i] - anchors[i - 1])) * (SCORES[i] - SCORES[i - 1]);
  }
  const last = anchors.length - 1;
  const slope = (SCORES[last] - SCORES[last - 1]) / (anchors[last] - anchors[last - 1]);
  return Math.min(100, SCORES[last] + (ratio - anchors[last]) * slope);
}

/** Omvendt: hvilken ratio trengs for en poengsum. */
export function ratioForScore(score: number, anchors: readonly number[]): number {
  if (score <= SCORES[0]) return (score / SCORES[0]) * anchors[0];
  for (let i = 1; i < anchors.length; i++) {
    if (score <= SCORES[i]) return anchors[i - 1] + ((score - SCORES[i - 1]) / (SCORES[i] - SCORES[i - 1])) * (anchors[i] - anchors[i - 1]);
  }
  const last = anchors.length - 1;
  const slope = (anchors[last] - anchors[last - 1]) / (SCORES[last] - SCORES[last - 1]);
  return anchors[last] + (score - SCORES[last]) * slope;
}

export const FALLBACK_BW: Record<'male' | 'female' | 'none', number> = { male: 80, female: 65, none: 72 };
export const fallbackBodyweight = (sex: Sex | null) => FALLBACK_BW[sex ?? 'none'];

export interface LiftScore {
  exerciseId: string;
  category: Category;
  /** Beste beregnede 1RM med kroppsvekt inkludert for pull-ups og dips. */
  e1rm: number;
  score: number;
  tier: Tier;
  /** Beregnet 1RM (samme måling som e1rm) som trengs for neste nivå, eller null på toppen. */
  nextTierKg: number | null;
  /** True når løftet er en variant som har nådd taket (Beist). */
  capped: boolean;
  /** True når kroppsvekten er med i tallet (vis «+ x kg ekstra»). */
  bodyweightLoad: boolean;
}

export interface StrengthProfile {
  score: number;
  tier: Tier;
  progress: number;
  categories: Record<Category, number>;
  lifts: LiftScore[];
  missing: Category[];
}

type RankSet = SetLike & { exercise_id: string };

/** Last som teller for et set (kroppsvekt lagt til for pull-ups og dips). */
const loadOf = (s: RankSet, bw: number) => (rankOf(s.exercise_id)?.load === 'bw' ? bw + s.weight : s.weight);

/**
 * True når settet er urealistisk tungt (mer enn 1,5 × verdensklasse for kroppsvekten),
 * sannsynligvis en tastefeil. Slike sets teller ikke i nivået.
 */
export function isImplausible(s: RankSet, bw: number, sex: Sex | null): boolean {
  const rank = rankOf(s.exercise_id);
  if (!rank || bw <= 0 || s.reps <= 0) return false;
  const world = anchorsFor(rank.anchor, sex === 'female' ? 'female' : 'male')[5];
  return loadOf(s, bw) / bw / rank.factor > world * IMPLAUSIBLE;
}

/** Beste 1RM per rangert øvelse. Bare arbeidssett med 1–10 reps som ikke er tastefeil teller. */
export function bestLifts(sets: RankSet[], bw: number, sex: Sex | null = null): Map<string, number> {
  const best = new Map<string, number>();
  for (const s of sets) {
    const rank = rankOf(s.exercise_id);
    if (!rank || !countsAsWork(s) || s.reps > MAX_REPS || isImplausible(s, bw, sex)) continue;
    const e = estimate1RM(loadOf(s, bw), s.reps);
    if (e > (best.get(s.exercise_id) ?? 0)) best.set(s.exercise_id, e);
  }
  return best;
}

export function liftScore(exerciseId: string, e1rm: number, bw: number, sex: Sex | null): LiftScore | null {
  const rank = rankOf(exerciseId);
  if (!rank || bw <= 0) return null;
  const anchors = anchorsFor(rank.anchor, sex);
  const raw = scoreFromRatio(e1rm / bw / rank.factor, anchors);
  const score = rank.variant ? Math.min(VARIANT_CAP, raw) : raw;
  const tier = tierFor(score);
  const capped = rank.variant && tier.index >= tierFor(VARIANT_CAP).index;
  const next = tier.index < TIER_COUNT - 1 && !capped ? ratioForScore(tier.min + 10, anchors) * rank.factor * bw : null;
  return {
    exerciseId,
    capped: !!capped,
    category: STANDARDS[rank.anchor].category,
    e1rm,
    score,
    tier,
    nextTierKg: next,
    bodyweightLoad: rank.load === 'bw',
  };
}

export function strengthProfile(
  sets: RankSet[],
  bw: number,
  sex: Sex | null,
  exercises?: Map<string, Exercise>,
): StrengthProfile {
  const lifts: LiftScore[] = [];
  for (const [id, e1rm] of bestLifts(sets, bw, sex)) {
    if (exercises && !exercises.has(id)) continue;
    const ls = liftScore(id, e1rm, bw, sex);
    if (ls) lifts.push(ls);
  }
  lifts.sort((a, b) => b.score - a.score);
  const categories = { push: 0, pull: 0, legs: 0 } as Record<Category, number>;
  for (const l of lifts) categories[l.category] = Math.max(categories[l.category], l.score);
  const missing = CATEGORIES.filter((c) => !lifts.some((l) => l.category === c));
  const score = CATEGORIES.reduce((s, c) => s + categories[c], 0) / CATEGORIES.length;
  return { score, tier: tierFor(score), progress: progressInTier(score), categories, lifts, missing };
}

export interface LevelEvent {
  exerciseId: string;
  before: LiftScore | null;
  after: LiftScore;
  overallBefore: StrengthProfile;
  overallAfter: StrengthProfile;
  weight: number;
  reps: number;
}

/**
 * Sammenligner før og etter et nytt set. Gir en hendelse bare når settet ga ny beste 1RM
 * på en rangert øvelse.
 */
export function levelEventFor(
  newSet: RankSet & { id: string },
  allSets: (RankSet & { id: string })[],
  bw: number,
  sex: Sex | null,
): LevelEvent | null {
  if (!isRanked(newSet.exercise_id) || !countsAsWork(newSet)) return null;
  const others = allSets.filter((s) => s.id !== newSet.id);
  const withNew = [...others, newSet];
  const beforeBest = bestLifts(others, bw, sex).get(newSet.exercise_id) ?? 0;
  const afterBest = bestLifts(withNew, bw, sex).get(newSet.exercise_id) ?? 0;
  if (afterBest <= beforeBest + 1e-9) return null;
  const after = liftScore(newSet.exercise_id, afterBest, bw, sex)!;
  return {
    exerciseId: newSet.exercise_id,
    before: beforeBest > 0 ? liftScore(newSet.exercise_id, beforeBest, bw, sex) : null,
    after,
    overallBefore: strengthProfile(others, bw, sex),
    overallAfter: strengthProfile(withNew, bw, sex),
    weight: newSet.weight,
    reps: newSet.reps,
  };
}
