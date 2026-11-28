import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseSocial } from '../../src/social/supabase';
import type { SocialBackend } from '../../src/social/backend';
import type { ActivityData, Visibility } from '../../src/social/types';

// Den ekte Sosialt-koden (src/social/supabase.ts) mot staging-databasen: de viktigste
// personvernreglene med ekte innlogging. Speiler supabase/tests/1_social.sql i kortform.

const URL = process.env.STAGING_SUPABASE_URL ?? '';
const KEY = process.env.STAGING_SUPABASE_KEY ?? '';
if (!URL) throw new Error('Sett STAGING_SUPABASE_URL');

// Er nøkkelen lagt inn av nettverksproxyen (KEY=proxy-injected), sendes den bare som «apikey».
const proxied = KEY === 'proxy-injected';
const fetchNoDummyBearer: typeof fetch = (input, init) => {
  if (!proxied) return fetch(input, init);
  const headers = new Headers(init?.headers);
  if (headers.get('Authorization') === `Bearer ${KEY}`) headers.delete('Authorization');
  return fetch(input, { ...init, headers });
};

const run = Math.random().toString(36).slice(2, 8);
interface U { name: string; sb: SupabaseClient; s: SocialBackend; id: string }
const users: Record<string, U> = {};

async function makeUser(name: string): Promise<U> {
  const sb = createClient(URL, KEY || 'proxy-injected', {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `rg-${run}-${name}` },
    global: { fetch: fetchNoDummyBearer },
  });
  const email = `rg-staging-${run}-${name.toLowerCase()}@example.com`;
  const { data, error } = await sb.auth.signUp({ email, password: `Staging-${run}-pw!` });
  if (error) throw new Error(`${name}: ${error.message}`);
  if (!data.session) throw new Error(`${name}: ingen innlogging etter registrering. Er «Confirm email» slått av i staging?`);
  return { name, sb, s: createSupabaseSocial(sb), id: data.user!.id };
}

const profile = (u: U, visibility: Visibility, extra: { score?: number; lift_scores?: Record<string, number> } = {}) =>
  u.s.saveProfile({ handle: `t${run}_${u.name.toLowerCase()}`, display_name: `Test ${u.name}`, color: '#34c56a', visibility, is_16_plus: visibility > 1, ...extra });

const data = (volume_kg: number): ActivityData => ({ version: 1, duration_s: 3600, sets: 5, reps: 25, volume_kg, exercises: [], records: [], muscles: {}, lifts: {}, tier: null });
const publish = (u: U, id: string) => u.s.publish({ id, name: id, started_at: new Date(Date.now() - 7_200_000).toISOString(), ended_at: new Date(Date.now() - 3_600_000).toISOString(), data: data(1000) });
const sees = async (viewer: U, owner: U) => (await viewer.s.feed({ userId: owner.id })).length > 0;

beforeAll(async () => {
  for (const n of ['A', 'B', 'C', 'D']) users[n] = await makeUser(n);
  const { A, B, C, D } = users;
  await profile(A, 1);
  await profile(B, 2, { score: 52, lift_scores: { 'ex-benkpress': 55 } });
  await profile(C, 3, { score: 71, lift_scores: { 'ex-benkpress': 70 } });
  await profile(D, 1);
  for (const u of [A, B, C]) await publish(u, `${u.name}-1`);
});

afterAll(async () => {
  // Slett testkontoene (og alt de laget, via «on delete cascade»).
  for (const u of Object.values(users)) {
    const { error } = await u.sb.rpc('delete_user');
    if (error) throw new Error(`Klarte ikke å slette testkontoen ${u.name}: ${error.message}`);
  }
  // Sjekk at de er borte: en ny innlogging skal feile.
  for (const u of Object.values(users)) {
    const email = `rg-staging-${run}-${u.name.toLowerCase()}@example.com`;
    const { error } = await u.sb.auth.signInWithPassword({ email, password: `Staging-${run}-pw!` });
    if (!error) throw new Error(`Testkontoen ${u.name} finnes fortsatt`);
  }
});

describe('staging: ekte Supabase', () => {
  it('profiler: unikt brukernavn og 16+-regelen håndheves av databasen', async () => {
    const { A, D } = users;
    await expect(D.s.saveProfile({ handle: `t${run}_a`, display_name: 'Kopi', color: '#34c56a', visibility: 1, is_16_plus: false })).rejects.toThrow(/taken|tatt/i);
    await expect(A.s.saveProfile({ handle: `t${run}_a`, display_name: 'A', color: '#34c56a', visibility: 3, is_16_plus: false })).rejects.toThrow(/16/);
    expect(await D.s.handleAvailable(`t${run}_ledig`)).toBe(true);
    expect((await D.s.findByHandle(`@T${run}_A`))?.user_id).toBe(A.id);
  });

  it('fremmede ser bare åpne kontoer', async () => {
    const { A, B, C, D } = users;
    expect(await sees(D, A)).toBe(false);
    expect(await sees(D, B)).toBe(false);
    expect(await sees(D, C)).toBe(true);
    expect((await D.s.profiles([A.id, B.id, C.id])).map((p) => p.user_id).sort()).toEqual([B.id, C.id].sort());
  });

  it('forespørsel må godtas, og varsler kommer fram', async () => {
    const { A, B } = users;
    expect(await B.s.follow(A.id)).toBe('pending');
    expect(await sees(B, A)).toBe(false);
    expect((await A.s.notifications()).some((n) => n.kind === 'follow_request' && n.actor === B.id)).toBe(true);
    await A.s.acceptFollower(B.id);
    expect(await sees(B, A)).toBe(true);
    // Innboks: merk som lest, og B ser ikke As varsler
    await A.s.markRead();
    expect((await A.s.notifications()).every((n) => n.read_at)).toBe(true);
    expect((await B.s.notifications()).some((n) => n.user_id === A.id)).toBe(false);
    await B.s.react(A.id, 'A-1', '🔥');
    expect((await A.s.reactions([{ owner: A.id, id: 'A-1' }])).map((r) => r.emoji)).toEqual(['🔥']);
    // Bytt reaksjon (oppdatering), så fjern den
    await B.s.react(A.id, 'A-1', '💪');
    expect((await A.s.reactions([{ owner: A.id, id: 'A-1' }])).map((r) => r.emoji)).toEqual(['💪']);
    await B.s.react(A.id, 'A-1', null);
    expect(await A.s.reactions([{ owner: A.id, id: 'A-1' }])).toEqual([]);
    // Publiser på nytt (samme id = oppdatering), og fjern fra feeden
    await publish(A, 'A-1');
    expect((await B.s.feed({ userId: A.id })).length).toBe(1);
    await A.s.unpublish('A-1');
    expect(await sees(B, A)).toBe(false);
    await publish(A, 'A-1');
  });

  it('kan ikke skrive direkte i follows eller late som en annen', async () => {
    const { A, D } = users;
    const r = await D.sb.from('follows').insert({ follower: D.id, followee: A.id, status: 'accepted' });
    expect(r.error?.message).toMatch(/permission denied/);
    const r2 = await D.sb.from('activities').insert({ user_id: A.id, id: 'falsk', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), data: {} });
    expect(r2.error?.message).toMatch(/row-level security/);
  });

  it('folkelister: navn for følgere, forespørsler og rapportering', async () => {
    const { A, B, D } = users;
    expect((await A.s.people([B.id])).map((p) => p.handle)).toEqual([`t${run}_b`]);
    // D har ingen tilknytning til A (privat): får ikke navnet via people()
    expect(await D.s.people([A.id])).toEqual([]);
    await D.s.report(A.id, 'spam: test');
    const r = await D.sb.from('reports').select('*');
    expect(r.error?.message).toMatch(/permission denied/);
  });

  it('blokkering fjerner tilgangen', async () => {
    const { A, B } = users;
    await A.s.block(B.id);
    expect(await A.s.blocked()).toEqual([B.id]);
    expect(await sees(B, A)).toBe(false);
    expect(await B.s.findByHandle(`t${run}_a`)).toBeNull();
    await A.s.unblock(B.id);
  });

  it('ledertavler: bare nivå 2 og 3', async () => {
    const { A, B, C } = users;
    await expect(A.s.leaderboard('level')).rejects.toThrow();
    const rows = await B.s.leaderboard('level');
    const mine = rows.filter((r) => [B.id, C.id].includes(r.user_id));
    expect(mine.map((r) => r.user_id)).toEqual([C.id, B.id]);
    expect(rows.some((r) => r.user_id === A.id)).toBe(false);
  });

  it('ledertavle «Fremgang» og deling fra-dato', async () => {
    const { B, C } = users;
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    await C.s.publish({ id: 'C-old', name: 'gammel', started_at: old, ended_at: old, data: { ...data(1), tier: { index: 6, score: 60 } } });
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    expect((await B.s.leaderboard('gain', 'all', undefined, since)).find((r) => r.user_id === C.id)?.value).toBe(11);
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const p = await C.s.saveProfile({ handle: `t${run}_c`, display_name: 'Test C', color: '#34c56a', visibility: 3, is_16_plus: true, score: 71, lift_scores: { 'ex-benkpress': 70 }, share_from: from });
    expect(Date.parse(p.share_from!)).toBe(Date.parse(from));
  });

  it('Oppdag: bare åpne kontoer, søk på navn og brukernavn', async () => {
    const { A, B, C, D } = users;
    const ids = (await D.s.discover(`t${run}_`)).map((p) => p.user_id);
    expect(ids).toEqual([C.id]);
    expect(ids).not.toContain(A.id);
    expect(ids).not.toContain(B.id);
    expect((await D.s.discover(`Test C`)).some((p) => p.user_id === C.id)).toBe(true);
  });

  it('treningskonto skjuler profilen (profiles.social = 0)', async () => {
    const { C, D } = users;
    const now = new Date().toISOString();
    const up = (social: number) => C.sb.from('profiles').upsert({ id: C.id, user_id: C.id, updated_at: now, social }, { onConflict: 'id' });
    expect((await up(0)).error).toBeNull();
    expect(await sees(D, C)).toBe(false);
    expect((await up(1)).error).toBeNull();
    expect(await sees(D, C)).toBe(true);
  });

  it('utfordringer: åpne kontoer kan utfordres, stillingen regnes av serveren', async () => {
    const { A, C, D } = users;
    const cid = await A.s.createChallenge({ kind: 'workouts', title: 'Staging', starts_at: new Date(Date.now() - 86_400_000).toISOString(), ends_at: new Date(Date.now() + 86_400_000).toISOString(), invitees: [C.id, D.id] });
    const { members } = await A.s.challenges();
    expect(members.filter((m) => m.challenge_id === cid).map((m) => m.user_id).sort()).toEqual([A.id, C.id].sort());
    await C.s.respondChallenge(cid, true);
    const st = await A.s.standings(cid);
    expect(st.find((s) => s.user_id === A.id)?.value).toBe(1);
    await expect(D.s.standings(cid)).rejects.toThrow();
    // Forlat (deltaker) og avlys (den som laget den)
    await C.s.leaveChallenge(cid);
    expect((await A.s.challenges()).members.filter((m) => m.challenge_id === cid).map((m) => m.user_id)).toEqual([A.id]);
    await A.s.leaveChallenge(cid);
    expect((await A.s.challenges()).challenges.some((c) => c.id === cid)).toBe(false);
  });

  it('løftutfordring regnes fra delte 1RM-tall', async () => {
    const { A, C } = users;
    const at = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    await A.s.publish({ id: 'A-lift0', name: 'før', started_at: at(72), ended_at: at(71), data: { ...data(1), lifts: { 'ex-kneboy': 100 } } });
    await A.s.publish({ id: 'A-lift1', name: 'nå', started_at: at(2), ended_at: at(1), data: { ...data(1), lifts: { 'ex-kneboy': 112.5 } } });
    const cid = await A.s.createChallenge({ kind: 'lift', title: 'Knebøy', exercise_id: 'ex-kneboy', starts_at: at(24), ends_at: new Date(Date.now() + 86_400_000).toISOString(), invitees: [C.id] });
    expect((await A.s.standings(cid)).find((s) => s.user_id === A.id)?.value).toBe(12.5);
    await A.s.leaveChallenge(cid);
  });
});
