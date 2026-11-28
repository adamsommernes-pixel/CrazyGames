import { describe, expect, it } from 'vitest';
import { CHALLENGE_LIFTS, defaultTitle, eligible, groupChallenges, phaseOf, timeLeft, valueText } from './challenges';
import type { Challenge, ChallengeMember, Person } from './types';

const p = (id: string, visibility: 1 | 2 | 3): Person => ({ user_id: id, handle: id.toLowerCase(), display_name: id, color: '#000000', visibility });

describe('utfordringer', () => {
  it('løft: de som teller i nivået, men ikke pull-ups (kroppsvekten er med i tallet)', () => {
    expect(CHALLENGE_LIFTS).toContain('ex-benkpress');
    expect(CHALLENGE_LIFTS).toContain('ex-kneboy');
    expect(CHALLENGE_LIFTS).not.toContain('ex-pull-ups');
    expect(CHALLENGE_LIFTS).not.toContain('ex-sidehev');
  });

  it('kan utfordre gjensidige følgere og åpne kontoer du følger', () => {
    const people = new Map([p('Mutual', 1), p('Open', 3), p('OneWay', 2), p('Follower', 1)].map((x) => [x.user_id, x]));
    const rel = { following: ['Mutual', 'Open', 'OneWay'], followers: ['Mutual', 'Follower'], requests: [], requested: [] };
    expect(eligible(rel, people).map((x) => x.user_id)).toEqual(['Mutual', 'Open']);
  });

  it('navn og verdier', () => {
    expect(defaultTitle('workouts', 7)).toBe('Flest økter – 1 uke');
    expect(defaultTitle('lift', 30, 'ex-kneboy')).toBe('Knebøy – 1 måned');
    expect(valueText({ kind: 'workouts' }, 1, 'kg')).toBe('1 økt');
    expect(valueText({ kind: 'volume' }, 12500, 'kg')).toMatch(/^12\s500 kg$/);
    expect(valueText({ kind: 'weekly' }, 2, 'kg')).toBe('2 uker');
    expect(valueText({ kind: 'lift' }, 7.5, 'kg')).toBe('+7,5 kg');
  });

  it('fase og tid igjen', () => {
    const now = Date.parse('2026-06-10T12:00:00Z');
    const c = { starts_at: '2026-06-08T00:00:00Z', ends_at: '2026-06-13T12:00:00Z' };
    expect(phaseOf(c, now)).toBe('running');
    expect(timeLeft(c, now)).toBe('3 dager igjen');
    expect(timeLeft({ ...c, ends_at: '2026-06-10T15:00:00Z' }, now)).toBe('3 t igjen');
    expect(phaseOf({ ...c, ends_at: '2026-06-09T00:00:00Z' }, now)).toBe('ended');
    expect(phaseOf({ starts_at: '2026-06-11T00:00:00Z', ends_at: '2026-06-20T00:00:00Z' }, now)).toBe('upcoming');
  });

  it('deler inn i invitasjoner, pågående og ferdige', () => {
    const now = Date.parse('2026-06-10T12:00:00Z');
    const ch = (id: string, ends: string): Challenge => ({ id, creator: 'X', kind: 'workouts', exercise_id: null, target: null, title: id, starts_at: '2026-06-01T00:00:00Z', ends_at: ends, created_at: '' });
    const m = (id: string, status: ChallengeMember['status']): ChallengeMember => ({ challenge_id: id, user_id: 'ME', status, invited_at: '', joined_at: null });
    const g = groupChallenges(
      [ch('inv', '2026-06-20T00:00:00Z'), ch('run', '2026-06-15T00:00:00Z'), ch('done', '2026-06-05T00:00:00Z'), ch('declined', '2026-06-20T00:00:00Z')],
      [m('inv', 'invited'), m('run', 'joined'), m('done', 'joined'), m('declined', 'declined')],
      'ME',
      now,
    );
    expect([g.invites, g.active, g.ended].map((l) => l.map((c) => c.id))).toEqual([['inv'], ['run'], ['done']]);
  });
});
