import { BUILTIN_EXERCISES } from '../db/exercises';
import { exerciseName } from '../lib/exerciseName';
import { num, toDisplay } from '../lib/format';
import { RANKED } from '../lib/strength';
import { t } from '../i18n';
import type { Relations } from './graph';
import type { Challenge, ChallengeKind, ChallengeMember, Person } from './types';

// Utfordringer: typer, varighet, hvem som kan inviteres og hvordan resultatet skrives.
// Selve stillingen regnes ut av serveren (challenge_standings i 012_social.sql).

export const KINDS: ChallengeKind[] = ['goal', 'workouts', 'volume', 'weekly', 'lift'];

export function kindName(k: ChallengeKind): string {
  switch (k) {
    case 'workouts':
      return t('Flest økter', 'Most workouts');
    case 'volume':
      return t('Mest volum', 'Most volume');
    case 'weekly':
      return t('Ukemål', 'Weekly goal');
    case 'goal':
      return t('Først til målet', 'First to the goal');
    default:
      return t('Størst fremgang', 'Biggest gain');
  }
}

export function kindText(k: ChallengeKind, target?: number | null, exerciseId?: string | null): string {
  switch (k) {
    case 'workouts':
      return t('Den som deler flest økter i perioden, vinner.', 'Whoever shares the most workouts in the period wins.');
    case 'volume':
      return t('Mest løftet vekt (kg × reps) i perioden.', 'Most weight lifted (kg × reps) in the period.');
    case 'weekly':
      return t(`Flest uker med minst ${target ?? 3} økter.`, `Most weeks with at least ${target ?? 3} workouts.`);
    case 'goal':
      return t(
        `Den som først når ${target ? `${num(target, 1)} kg` : 'målvekten'} i beregnet 1RM i ${exerciseId ? liftName(exerciseId) : 'løftet'}, vinner.`,
        `The first to reach ${target ? `${num(target, 1)} kg` : 'the target'} estimated 1RM in ${exerciseId ? liftName(exerciseId) : 'the lift'} wins.`,
      );
    default:
      return t(
        `Størst økning i beregnet 1RM i ${exerciseId ? liftName(exerciseId) : 'løftet'}, fra før start til beste i perioden.`,
        `Biggest increase in estimated 1RM in ${exerciseId ? liftName(exerciseId) : 'the lift'}, from before the start to the best in the period.`,
      );
  }
}

const builtin = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
export const liftName = (id: string) => exerciseName(builtin.get(id) ?? { id, name: id, custom: 0 });

/**
 * Løft som kan brukes i løftutfordringer: de som teller i styrkenivået, unntatt de der
 * kroppsvekten er med i tallet (pull-ups), siden økta ikke deler det tallet.
 */
export const CHALLENGE_LIFTS: string[] = Object.entries(RANKED)
  .filter(([, r]) => r.load !== 'bw')
  .map(([slug]) => `ex-${slug}`)
  .filter((id) => builtin.has(id));

export const LENGTHS = [7, 14, 30] as const;
export type Length = (typeof LENGTHS)[number];
export const lengthName = (d: Length) => (d === 7 ? t('1 uke', '1 week') : d === 14 ? t('2 uker', '2 weeks') : t('1 måned', '1 month'));

export function defaultTitle(kind: ChallengeKind, days: Length, exerciseId?: string | null, target?: number | null): string {
  const len = lengthName(days);
  if (kind === 'lift' && exerciseId) return `${liftName(exerciseId)} – ${len}`.slice(0, 60);
  if (kind === 'goal' && exerciseId) return t(`Først til ${num(target ?? 0, 1)} kg ${liftName(exerciseId).toLowerCase()}`, `First to ${num(target ?? 0, 1)} kg ${liftName(exerciseId).toLowerCase()}`).slice(0, 60);
  return `${kindName(kind)} – ${len}`.slice(0, 60);
}

/** Hvem du kan utfordre: de du følger som følger deg tilbake, eller som har åpen konto. */
export function eligible(rel: Relations, people: Map<string, Person>): Person[] {
  return rel.following
    .map((id) => people.get(id))
    .filter((p): p is Person => !!p && (rel.followers.includes(p.user_id) || p.visibility === 3))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export function valueText(c: Pick<Challenge, 'kind'>, v: number, unit: 'kg' | 'lbs'): string {
  switch (c.kind) {
    case 'workouts':
      return t(`${num(v, 0)} ${v === 1 ? 'økt' : 'økter'}`, `${num(v, 0)} ${v === 1 ? 'workout' : 'workouts'}`);
    case 'volume':
      return `${num(toDisplay(v, unit), 0)} ${unit}`;
    case 'weekly':
      return t(`${num(v, 0)} ${v === 1 ? 'uke' : 'uker'}`, `${num(v, 0)} ${v === 1 ? 'week' : 'weeks'}`);
    case 'goal':
      return `${num(toDisplay(v, unit), 1)} ${unit}`;
    default:
      return `+${num(toDisplay(v, unit), 1)} ${unit}`;
  }
}

export type Phase = 'upcoming' | 'running' | 'ended';
export const phaseOf = (c: Pick<Challenge, 'starts_at' | 'ends_at'>, now = Date.now()): Phase =>
  now < Date.parse(c.starts_at) ? 'upcoming' : now >= Date.parse(c.ends_at) ? 'ended' : 'running';

export function timeLeft(c: Pick<Challenge, 'starts_at' | 'ends_at'>, now = Date.now()): string {
  const ms = Date.parse(c.ends_at) - now;
  if (ms <= 0) return t('Ferdig', 'Finished');
  const days = Math.ceil(ms / 86_400_000);
  if (days > 1) return t(`${days} dager igjen`, `${days} days left`);
  const h = Math.max(1, Math.ceil(ms / 3_600_000));
  return t(`${h} t igjen`, `${h} h left`);
}

/** Deler utfordringene inn for listene: invitasjoner til deg, pågående og ferdige. */
export function groupChallenges(cs: Challenge[], members: ChallengeMember[], me: string, now = Date.now()) {
  const status = (c: Challenge) => members.find((m) => m.challenge_id === c.id && m.user_id === me)?.status;
  const invites = cs.filter((c) => status(c) === 'invited' && phaseOf(c, now) !== 'ended');
  const active = cs.filter((c) => status(c) === 'joined' && phaseOf(c, now) !== 'ended').sort((a, b) => a.ends_at.localeCompare(b.ends_at));
  const ended = cs.filter((c) => status(c) === 'joined' && phaseOf(c, now) === 'ended').sort((a, b) => b.ends_at.localeCompare(a.ends_at));
  return { invites, active, ended };
}
