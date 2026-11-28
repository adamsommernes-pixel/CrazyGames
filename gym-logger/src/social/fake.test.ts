import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeSocial, memoryStore, type FakeStorage } from './fake';
import type { SocialBackend } from './backend';
import type { ActivityData, Visibility } from './types';

// Samme scenarioer som supabase/tests/1_social.sql, så den falske varianten oppfører seg som databasen.

const data = (volume_kg: number, lifts: Record<string, number> = {}): ActivityData => ({
  version: 1,
  duration_s: 3600,
  sets: 10,
  reps: 50,
  volume_kg,
  exercises: [],
  records: [],
  muscles: {},
  lifts,
  tier: null,
});
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let store: FakeStorage;
const as = (u: string): SocialBackend => createFakeSocial(() => u, store);
async function profile(u: string, visibility: Visibility, extra: Partial<{ score: number; lift_scores: Record<string, number> }> = {}) {
  await as(u).saveProfile({ handle: `user_${u.toLowerCase()}`, display_name: `User ${u}`, color: '#34c56a', visibility, is_16_plus: visibility > 1, ...extra });
}
async function publish(u: string, id: string, hoursAgo: number, d = data(1000)) {
  await as(u).publish({ id, name: id, started_at: ago(hoursAgo), ended_at: ago(hoursAgo - 1), data: d });
}
const seesFeed = async (viewer: string, owner: string) => (await as(viewer).feed()).some((a) => a.user_id === owner);

beforeEach(async () => {
  store = memoryStore();
  await profile('A', 1);
  await profile('B', 2, { score: 52, lift_scores: { 'ex-benkpress': 55 } });
  await profile('C', 3, { score: 71, lift_scores: { 'ex-benkpress': 70 } });
  await profile('D', 1);
  await publish('A', 'a1', 2, data(5000, { 'ex-kneboy': 120 }));
  await publish('B', 'b1', 3);
  await publish('C', 'c1', 3);
});

describe('profil', () => {
  it('avviser ugyldig og opptatt brukernavn, og nivå 2+ uten 16+', async () => {
    await expect(as('X').saveProfile({ handle: 'Ugyldig!', display_name: 'X', color: '#34c56a', visibility: 1, is_16_plus: false })).rejects.toThrow();
    await expect(as('X').saveProfile({ handle: 'user_a', display_name: 'X', color: '#34c56a', visibility: 1, is_16_plus: false })).rejects.toThrow(/taken|tatt/);
    await expect(as('X').saveProfile({ handle: 'ung', display_name: 'X', color: '#34c56a', visibility: 3, is_16_plus: false })).rejects.toThrow(/16/);
    expect(await as('X').handleAvailable('ledig_navn')).toBe(true);
    expect(await as('X').handleAvailable('user_a')).toBe(false);
  });

  it('finner private kontoer bare på eksakt brukernavn', async () => {
    expect((await as('D').findByHandle('@USER_A'))?.user_id).toBe('A');
    expect(await as('D').findByHandle('user_')).toBeNull();
  });

  it('viser profiler etter nivå', async () => {
    const seen = (await as('D').profiles(['A', 'B', 'C'])).map((p) => p.user_id).sort();
    expect(seen).toEqual(['B', 'C']);
    expect(await as('X').profiles(['A', 'B', 'C'])).toEqual([]);
  });
});

describe('aktivitet og følging', () => {
  it('fremmede ser bare åpne kontoer', async () => {
    expect(await seesFeed('D', 'A')).toBe(false);
    expect(await seesFeed('D', 'B')).toBe(false);
    expect(await seesFeed('D', 'C')).toBe(true);
  });

  it('privat: forespørsel må godtas før økter vises', async () => {
    expect(await as('B').follow('A')).toBe('pending');
    expect(await seesFeed('B', 'A')).toBe(false);
    await as('D').acceptFollower('B'); // ikke D sin forespørsel
    expect(await seesFeed('B', 'A')).toBe(false);
    expect((await as('A').notifications()).map((n) => n.kind)).toEqual(['follow_request']);
    await as('A').acceptFollower('B');
    expect(await seesFeed('B', 'A')).toBe(true);
    expect((await as('B').notifications()).map((n) => n.kind)).toContain('follow_accepted');
  });

  it('åpen konto: følging godtas med en gang, og bytte til åpen godtar ventende', async () => {
    expect(await as('B').follow('C')).toBe('accepted');
    await as('D').follow('A');
    await profile('A', 3);
    expect((await as('A').follows()).find((f) => f.follower === 'D')?.status).toBe('accepted');
  });

  it('åpen → privat: følgere du ikke følger tilbake kan fjernes', async () => {
    await profile('A', 3);
    await as('B').follow('A');
    await as('D').follow('A');
    await profile('A', 1);
    expect((await as('A').followersNotFollowedBack()).map((p) => p.user_id)).toEqual(['B', 'D']);
    expect(await as('A').removeFollowers(['D'])).toBe(1);
    expect(await seesFeed('D', 'A')).toBe(false);
    expect(await seesFeed('B', 'A')).toBe(true);
  });

  it('treningskonto skjuler profilen, men beholder følgerne', async () => {
    await as('D').follow('C');
    await as('C').setActive(false);
    expect(await seesFeed('D', 'C')).toBe(false);
    expect(await as('D').findByHandle('user_c')).toBeNull();
    expect((await as('D').follows()).some((f) => f.followee === 'C')).toBe(true);
    await as('C').setActive(true);
    expect(await seesFeed('D', 'C')).toBe(true);
  });

  it('publisering er idempotent og kan trekkes tilbake', async () => {
    await publish('C', 'c1', 1, data(9000));
    expect((await as('C').feed({ userId: 'C' })).length).toBe(1);
    await as('C').unpublish('c1');
    expect(await seesFeed('D', 'C')).toBe(false);
  });
});

describe('reaksjoner og blokkering', () => {
  it('reaksjoner bare på økter du ser, ett varsel per økt', async () => {
    await expect(as('D').react('A', 'a1', '💪')).rejects.toThrow();
    await as('B').follow('A');
    await as('A').acceptFollower('B');
    await as('B').react('A', 'a1', '🔥');
    await as('B').react('A', 'a1', '💪');
    expect((await as('A').reactions([{ owner: 'A', id: 'a1' }])).map((r) => r.emoji)).toEqual(['💪']);
    expect((await as('A').notifications()).filter((n) => n.kind === 'reaction')).toHaveLength(1);
    await as('B').react('A', 'a1', null);
    expect(await as('A').reactions([{ owner: 'A', id: 'a1' }])).toEqual([]);
  });

  it('blokkering fjerner følging og reaksjoner, og skjuler brukeren', async () => {
    await as('B').follow('A');
    await as('A').acceptFollower('B');
    await as('B').react('A', 'a1', '🔥');
    await as('A').block('B');
    expect(await seesFeed('B', 'A')).toBe(false);
    expect(await as('B').findByHandle('user_a')).toBeNull();
    await expect(as('B').follow('A')).rejects.toThrow();
    expect(await as('A').reactions([{ owner: 'A', id: 'a1' }])).toEqual([]);
    await as('A').unblock('B');
    expect(await as('A').blocked()).toEqual([]);
  });
});

describe('ledertavler og Oppdag', () => {
  it('bare nivå 2 og 3, og bare for dem', async () => {
    await expect(as('A').leaderboard('level')).rejects.toThrow();
    const rows = await as('B').leaderboard('level');
    expect(rows.map((r) => [r.rank, r.user_id])).toEqual([[1, 'C'], [2, 'B']]);
    expect((await as('B').leaderboard('lift', 'all', 'ex-benkpress')).length).toBe(2);
    expect((await as('B').leaderboard('level', 'following')).map((r) => r.user_id)).toEqual(['B']);
    await as('B').follow('C');
    expect((await as('B').leaderboard('level', 'following')).map((r) => r.user_id)).toEqual(['C', 'B']);
    expect((await as('B').leaderboard('workouts', 'all', undefined, ago(24))).length).toBe(2);
    // Mitt nivå: B (52 → nivå 5) og C (71 → nivå 7) er på hvert sitt nivå
    const withTier = (u: string, v: 2 | 3, tier: number, score: number) =>
      as(u).saveProfile({ handle: `user_${u.toLowerCase()}`, display_name: `User ${u}`, color: '#34c56a', visibility: v, is_16_plus: true, tier_index: tier, score });
    await withTier('B', 2, 5, 52);
    await withTier('C', 3, 7, 71);
    expect((await as('B').leaderboard('level', 'tier')).map((r) => r.user_id)).toEqual(['B']);
    await withTier('C', 3, 5, 58);
    expect((await as('B').leaderboard('level', 'tier')).map((r) => r.user_id)).toEqual(['C', 'B']);
  });

  it('fremgang: poeng nå minus poeng etter siste økt før perioden', async () => {
    await as('C').publish({ id: 'c0', name: 'gammel', started_at: ago(40 * 24), ended_at: ago(40 * 24 - 1), data: { ...data(1), tier: { index: 6, score: 60 } } });
    const rows = await as('B').leaderboard('gain', 'all', undefined, ago(30 * 24));
    expect(rows.map((r) => [r.user_id, r.value])).toEqual([['C', 11]]);
  });

  it('Oppdag: sist aktive først, de uten økter sist', async () => {
    await profile('E', 3);
    await profile('F', 3);
    await publish('F', 'f1', 1);
    expect((await as('D').discover()).map((p) => p.user_id)).toEqual(['F', 'C', 'E', 'B']);
    expect((await as('D').discover('user_e')).map((p) => p.user_id)).toEqual(['E']);
  });

  it('Oppdag viser åpne kontoer først, så andre 16+ (ikke under 16)', async () => {
    expect((await as('D').discover()).map((p) => p.user_id)).toEqual(['C', 'B']);
    expect(await as('D').discover('finnes-ikke')).toEqual([]);
    expect(await as('X').discover()).toEqual([]);
  });
});

describe('utfordringer', () => {
  const period = (daysBack: number) => ({ starts_at: ago(daysBack * 24), ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString() });

  it('bare gjensidige følgere og åpne kontoer kan utfordres', async () => {
    await expect(as('A').createChallenge({ kind: 'workouts', title: 'Test', invitees: ['D'], ...period(1) })).rejects.toThrow();
    const cid = await as('A').createChallenge({ kind: 'workouts', title: 'Mest', invitees: ['C', 'D'], ...period(1) });
    const { members } = await as('A').challenges();
    expect(members.map((m) => m.user_id).sort()).toEqual(['A', 'C']);
    expect((await as('D').challenges()).challenges).toEqual([]);
    await expect(as('D').standings(cid)).rejects.toThrow();
    await as('C').respondChallenge(cid, true);
    const st = await as('A').standings(cid);
    expect(st.find((s) => s.user_id === 'A')?.value).toBe(1);
    expect(st.find((s) => s.user_id === 'C')?.value).toBe(1);
  });

  it('løft og uke regnes som i databasen', async () => {
    for (const [a, b] of [['A', 'D'], ['D', 'A']]) {
      await as(a).follow(b);
      await as(b).acceptFollower(a);
    }
    await publish('A', 'a0', 240, data(4000, { 'ex-kneboy': 100 }));
    const lift = await as('A').createChallenge({ kind: 'lift', title: 'Knebøy', exercise_id: 'ex-kneboy', invitees: ['D'], ...period(1) });
    await as('D').respondChallenge(lift, true);
    const st = await as('A').standings(lift);
    expect(st.find((s) => s.user_id === 'A')?.value).toBe(20);
    expect(st.find((s) => s.user_id === 'D')?.value).toBe(0);
    const weekly = await as('A').createChallenge({ kind: 'weekly', title: 'Uke', target: 1, invitees: ['D'], ...period(20) });
    expect((await as('A').standings(weekly)).find((s) => s.user_id === 'A')?.value).toBe(2);
    // Først til 110 kg: A nådde det (120 for 2 t siden), D har ingen økter
    const goal = await as('A').createChallenge({ kind: 'goal', title: '110', exercise_id: 'ex-kneboy', target: 110, invitees: ['D'], ...period(1) });
    await as('D').respondChallenge(goal, true);
    const gs = await as('A').standings(goal);
    expect(gs[0]).toMatchObject({ user_id: 'A', rank: 1, value: 120 });
    expect(gs[0].reached_at).toBeTruthy();
    expect(gs[1]).toMatchObject({ user_id: 'D', rank: 2, reached_at: null });
    await expect(as('A').createChallenge({ kind: 'goal', title: 'x', exercise_id: 'ex-kneboy', invitees: ['D'], ...period(1) })).rejects.toThrow();
    await as('A').leaveChallenge(goal);
    await as('A').leaveChallenge(weekly);
    expect((await as('A').challenges()).challenges.map((c) => c.id)).toEqual([lift]);
  });
});

// Samme scenarioer som supabase/tests/2_suggestions.sql.
describe('forslag', () => {
  beforeEach(async () => {
    store = memoryStore();
    const mk = (u: string, name: string, visibility: Visibility, is_16_plus = true) =>
      as(u).saveProfile({ handle: name.toLowerCase(), display_name: name, color: '#34c56a', visibility, is_16_plus, tier_index: 4 });
    await mk('M', 'Meg', 1);
    await mk('F', 'Frida', 3);
    await mk('G', 'Geir', 3);
    await mk('S', 'Sara', 1);
    await mk('T', 'Tor', 1);
    await mk('O', 'Ola', 3);
    await mk('N', 'Nina', 1);
    await as('N').setSuggestable(false);
    await mk('U', 'Ung', 1, false);
    await mk('Q', 'Quinn', 1);
    await mk('BL', 'Blokk', 3);
    await mk('W', 'Walter', 3);
    await as('W').setActive(false);
    await as('M').follow('F');
    await as('M').follow('G');
    for (const f of ['F', 'G']) {
      await as(f).follow('S');
      await as('S').acceptFollower(f);
    }
    await as('F').follow('O');
    await as('T').follow('M');
    await as('M').acceptFollower('T');
    await as('M').follow('Q');
    await as('F').follow('U');
    await as('U').acceptFollower('F');
    await as('M').block('BL');
  });

  it('felles venner først, så de som følger deg; ikke fulgte, blokkerte, under 16, avslåtte eller skjulte', async () => {
    const list = await as('M').suggestions();
    expect(list.map((p) => p.handle)).toEqual(['sara', 'ola', 'tor']);
    expect(list[0]).toMatchObject({ mutual_count: 2, mutual_names: ['Frida', 'Geir'], follows_you: false, tier_index: null, visibility: 1 });
    expect(list[1]).toMatchObject({ mutual_count: 1, tier_index: 4 });
    expect(list[2]).toMatchObject({ mutual_count: 0, follows_you: true });
    expect(await as('M').suggestions(1)).toHaveLength(1);
    expect(await seesFeed('M', 'S')).toBe(false);
  });

  it('søk finner private som kan foreslås, men ikke nivået deres', async () => {
    expect((await as('M').discover('sara')).map((p) => [p.handle, p.tier_index])).toEqual([['sara', null]]);
    expect(await as('M').discover('nina')).toEqual([]);
    expect(await as('M').discover('ung')).toEqual([]);
    expect(await as('M').discover('blokk')).toEqual([]);
  });

  it('kan slås av for private, men åpne vises uansett', async () => {
    await as('S').setSuggestable(false);
    await as('O').setSuggestable(false);
    expect((await as('M').suggestions()).map((p) => p.handle)).toEqual(['ola', 'tor']);
  });

  it('antall følgere og fulgte', async () => {
    expect(await as('M').followCounts('S')).toEqual({ followers: 2, following: 0 });
    expect(await as('M').followCounts('M')).toEqual({ followers: 1, following: 2 });
    expect(await as('M').followCounts('BL')).toBeNull();
    expect(await as('M').followCounts('W')).toBeNull();
  });

  it('navnet på den som ga kudos vises, men ikke nivået', async () => {
    await as('F').publish({ id: 'f1', name: 'f1', started_at: ago(2), ended_at: ago(1), data: data(1) });
    await as('N').react('F', 'f1', '🔥');
    expect((await as('M').people(['N'])).map((p) => [p.handle, p.tier_index])).toEqual([['nina', null]]);
  });
});
