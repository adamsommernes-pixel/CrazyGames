import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { SocialBackend } from './backend';
import { SocialError, type Activity, type Follow, type LeaderboardRow, type Person, type SocialProfile, type Standing } from './types';
import { t } from '../i18n';

/** Gjør databasefeil forståelige. Reglene selv ligger i 012_social.sql. */
export function socialMessage(e: Pick<PostgrestError, 'message' | 'code'>): string {
  const m = e.message.toLowerCase();
  if (m.includes('social_profiles_handle_key')) return t('Brukernavnet er tatt.', 'That username is taken.');
  if (m.includes('handle_check')) return t('Brukernavnet kan ha 3–20 tegn: små bokstaver, tall, _ og punktum.', 'Usernames are 3–20 characters: lowercase letters, numbers, _ and dots.');
  if (m.includes('ikke tillatt')) return t('Navnet eller brukernavnet er ikke tillatt.', 'The name or username is not allowed.');
  if (m.includes('under_16_private')) return t('Under 16 år kan du bare ha privat konto.', 'Under 16 you can only have a private account.');
  if (m.includes('fant ikke brukeren')) return t('Fant ikke brukeren.', 'User not found.');
  if (m.includes('mangler sosial profil')) return t('Lag en sosial profil først.', 'Create a social profile first.');
  if (m.includes('ledertavler krever')) return t('Ledertavler krever synlighet «Ledertavler» eller «Åpen».', 'Leaderboards need the “Leaderboards” or “Open” setting.');
  if (m.includes('ingen av dem kan utfordres')) return t('Du kan bare utfordre gjensidige følgere og åpne kontoer.', 'You can only challenge mutual followers and open accounts.');
  if (m.includes('inviter 1–50')) return t('Inviter mellom 1 og 50 personer.', 'Invite between 1 and 50 people.');
  if (m.includes('ikke med i utfordringen')) return t('Du er ikke med i denne utfordringen.', "You're not in this challenge.");
  if (m.includes('does not exist') || m.includes('could not find the') || m.includes('schema cache'))
    return t('Sosialt er ikke satt opp i databasen ennå (012_social.sql).', 'Social is not set up in the database yet (012_social.sql).');
  if (m.includes('failed to fetch') || m.includes('network')) return t('Ingen nettforbindelse.', 'No internet connection.');
  return e.message;
}

function check<T>(r: { data: T; error: PostgrestError | null }): T {
  if (r.error) throw new SocialError(socialMessage(r.error));
  return r.data;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toProfile = (r: Record<string, unknown>): SocialProfile =>
  ({ ...r, score: num(r.score), lift_scores: (r.lift_scores as Record<string, number>) ?? {} }) as SocialProfile;

export function createSupabaseSocial(sb: SupabaseClient): SocialBackend {
  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;
  const me = async () => {
    const id = await uid();
    if (!id) throw new SocialError(t('Du er ikke logget inn.', "You're not logged in."));
    return id;
  };

  return {
    kind: 'supabase',
    userId: uid,

    async myProfile() {
      const id = await me();
      const data = check(await sb.from('social_profiles').select('*').eq('user_id', id).maybeSingle());
      return data ? toProfile(data) : null;
    },
    async saveProfile(input) {
      const id = await me();
      const row = { ...input, handle: input.handle.toLowerCase().trim(), display_name: input.display_name.trim(), user_id: id };
      return toProfile(check(await sb.from('social_profiles').upsert(row, { onConflict: 'user_id' }).select().single()) as Record<string, unknown>);
    },
    async handleAvailable(handle) {
      return !!check(await sb.rpc('handle_available', { h: handle }));
    },
    // Serveren følger profiles.social, som sendes med vanlig synk.
    async setActive() {},
    async profiles(ids) {
      if (!ids.length) return [];
      return (check(await sb.from('social_profiles').select('*').in('user_id', ids)) ?? []).map(toProfile);
    },

    async findByHandle(handle) {
      const rows = check(await sb.rpc('find_by_handle', { h: handle })) as Person[] | null;
      return rows?.[0] ?? null;
    },
    async discover(query = '') {
      return (check(await sb.rpc('discover', { q: query })) as Person[] | null) ?? [];
    },
    async people(ids) {
      if (!ids.length) return [];
      return (check(await sb.rpc('people', { ids })) as Person[] | null) ?? [];
    },

    async follows() {
      return (check(await sb.from('follows').select('*')) as Follow[] | null) ?? [];
    },
    async follow(userId) {
      return check(await sb.rpc('follow_user', { target: userId })) as 'pending' | 'accepted';
    },
    async unfollow(userId) {
      check(await sb.rpc('unfollow_user', { target: userId }));
    },
    async acceptFollower(userId) {
      check(await sb.rpc('accept_follower', { requester: userId }));
    },
    async removeFollower(userId) {
      check(await sb.rpc('remove_follower', { requester: userId }));
    },
    async followersNotFollowedBack() {
      return (check(await sb.rpc('followers_not_followed_back')) as Person[] | null) ?? [];
    },
    async removeFollowers(ids) {
      return Number(check(await sb.rpc('remove_followers', { requesters: ids })) ?? 0);
    },

    async blocked() {
      return ((check(await sb.from('blocks').select('blocked')) as { blocked: string }[] | null) ?? []).map((r) => r.blocked);
    },
    async block(userId) {
      check(await sb.rpc('block_user', { target: userId }));
    },
    async unblock(userId) {
      check(await sb.rpc('unblock_user', { target: userId }));
    },
    async report(target, reason, activityId) {
      check(await sb.from('reports').insert({ reporter: await me(), target, reason, activity_id: activityId ?? null }));
    },

    async publish(a) {
      check(await sb.from('activities').upsert({ ...a, user_id: await me() }, { onConflict: 'user_id,id' }));
    },
    async unpublish(id) {
      check(await sb.from('activities').delete().eq('user_id', await me()).eq('id', id));
    },
    async feed({ before, limit = 20, userId } = {}) {
      let q = sb.from('activities').select('*').order('started_at', { ascending: false }).limit(limit);
      if (before) q = q.lt('started_at', before);
      if (userId) q = q.eq('user_id', userId);
      return (check(await q) as Activity[] | null) ?? [];
    },
    async reactions(keys) {
      if (!keys.length) return [];
      const owners = [...new Set(keys.map((k) => k.owner))];
      const ids = [...new Set(keys.map((k) => k.id))];
      const rows = (check(await sb.from('reactions').select('*').in('activity_owner', owners).in('activity_id', ids)) ?? []) as import('./types').Reaction[];
      const wanted = new Set(keys.map((k) => `${k.owner}/${k.id}`));
      return rows.filter((r) => wanted.has(`${r.activity_owner}/${r.activity_id}`));
    },
    async react(owner, activityId, emoji) {
      const id = await me();
      if (!emoji) {
        check(await sb.from('reactions').delete().eq('activity_owner', owner).eq('activity_id', activityId).eq('user_id', id));
        return;
      }
      check(await sb.from('reactions').upsert({ activity_owner: owner, activity_id: activityId, user_id: id, emoji }, { onConflict: 'activity_owner,activity_id,user_id' }));
    },

    async notifications() {
      return (check(await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) ?? []) as import('./types').SocialNotification[];
    },
    async markRead(ids) {
      let q = sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (ids) q = q.in('id', ids);
      check(await q);
    },

    async leaderboard(board, scope = 'all', exercise, since) {
      const args: Record<string, unknown> = { board, scope };
      if (exercise) args.exercise = exercise;
      if (since) args.since = since;
      const rows = (check(await sb.rpc('leaderboard', args)) ?? []) as LeaderboardRow[];
      return rows.map((r) => ({ ...r, rank: Number(r.rank), value: Number(r.value) }));
    },

    async challenges() {
      const challenges = (check(await sb.from('challenges').select('*').order('ends_at', { ascending: false })) ?? []) as import('./types').Challenge[];
      if (!challenges.length) return { challenges, members: [] };
      const members = (check(await sb.from('challenge_members').select('*').in('challenge_id', challenges.map((c) => c.id))) ?? []) as import('./types').ChallengeMember[];
      return { challenges: challenges.map((c) => ({ ...c, target: num(c.target) })), members };
    },
    async createChallenge(c) {
      return check(
        await sb.rpc('create_challenge', {
          kind: c.kind,
          title: c.title,
          starts_at: c.starts_at,
          ends_at: c.ends_at,
          invitees: c.invitees,
          exercise_id: c.exercise_id ?? null,
          target: c.target ?? null,
        }),
      ) as string;
    },
    async respondChallenge(id, accept) {
      check(await sb.rpc('respond_challenge', { challenge: id, accept }));
    },
    async leaveChallenge(id) {
      check(await sb.rpc('leave_challenge', { challenge: id }));
    },
    async standings(id) {
      const rows = (check(await sb.rpc('challenge_standings', { challenge: id })) ?? []) as Standing[];
      return rows.map((r) => ({ ...r, rank: Number(r.rank), value: Number(r.value) }));
    },
  };
}
