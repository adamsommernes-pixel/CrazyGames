import type { SocialBackend } from './backend';
import {
  SocialError,
  type Activity,
  type Challenge,
  type ChallengeMember,
  type Follow,
  type LeaderboardRow,
  type Person,
  type Reaction,
  type SocialNotification,
  type SocialProfile,
  type Standing,
} from './types';
import { t } from '../i18n';
import { nameProblem } from './names';

// Falsk Sosialt: samme regler som 012_social.sql, men lagret på enheten (localStorage).
// Brukes i e2e-testene og ved utvikling uten Supabase: to lokale kontoer på samme enhet kan
// følge hverandre. Reglene her må speile databasen; fake.test.ts kjører de samme scenarioene.

interface Store {
  profiles: SocialProfile[];
  follows: Follow[];
  blocks: { blocker: string; blocked: string }[];
  reports: { reporter: string; target: string; reason: string; activity_id: string | null }[];
  activities: Activity[];
  reactions: Reaction[];
  challenges: Challenge[];
  members: ChallengeMember[];
  notifications: SocialNotification[];
}

const empty = (): Store => ({ profiles: [], follows: [], blocks: [], reports: [], activities: [], reactions: [], challenges: [], members: [], notifications: [] });

export interface FakeStorage {
  load(): Store | null;
  save(s: Store): void;
}

export const FAKE_KEY = 'repgrade-fake-social';
export const localStorageStore: FakeStorage = {
  load() {
    try {
      const raw = localStorage.getItem(FAKE_KEY);
      return raw ? (JSON.parse(raw) as Store) : null;
    } catch {
      return null;
    }
  },
  save(s) {
    try {
      localStorage.setItem(FAKE_KEY, JSON.stringify(s));
    } catch {
      /* fullt eller utilgjengelig */
    }
  },
};

export function memoryStore(): FakeStorage {
  let s: Store | null = null;
  return { load: () => (s ? structuredClone(s) : null), save: (n) => void (s = structuredClone(n)) };
}

const HANDLE = /^[a-z0-9_.]{3,20}$/;
const iso = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const fail = (nb: string, en: string): never => {
  throw new SocialError(t(nb, en));
};

export function createFakeSocial(uid: () => string | null, storage: FakeStorage = localStorageStore, clock: () => number = Date.now): SocialBackend {
  const read = () => storage.load() ?? empty();
  const tx = <T>(fn: (s: Store) => T): T => {
    const s = read();
    const r = fn(s);
    storage.save(s);
    return r;
  };
  const me = () => uid() ?? fail('Du er ikke logget inn.', "You're not logged in.");

  // ---- Reglene (speiler SQL-funksjonene) ----
  const prof = (s: Store, u: string) => s.profiles.find((p) => p.user_id === u);
  const hasSocial = (s: Store, u: string) => !!prof(s, u)?.active;
  const isBlocked = (s: Store, a: string, b: string) => s.blocks.some((x) => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a));
  const follows = (s: Store, a: string, b: string, status?: Follow['status']) => s.follows.some((f) => f.follower === a && f.followee === b && (!status || f.status === status));
  const canSee = (s: Store, viewer: string, owner: string) => {
    if (viewer === owner) return true;
    const o = prof(s, owner);
    return hasSocial(s, viewer) && !!o?.active && (o.visibility === 3 || follows(s, viewer, owner, 'accepted')) && !isBlocked(s, viewer, owner);
  };
  const mutual = (s: Store, a: string, b: string) => follows(s, a, b, 'accepted') && follows(s, b, a, 'accepted');
  const canChallenge = (s: Store, a: string, b: string) =>
    a !== b && hasSocial(s, a) && hasSocial(s, b) && !isBlocked(s, a, b) && (mutual(s, a, b) || prof(s, b)?.visibility === 3);
  const inChallenge = (s: Store, c: string, u: string) => s.challenges.some((x) => x.id === c && x.creator === u) || s.members.some((m) => m.challenge_id === c && m.user_id === u);
  const notify = (s: Store, target: string, kind: SocialNotification['kind'], actor: string, payload: Record<string, unknown> = {}) => {
    if (target !== actor) s.notifications.push({ id: id(), user_id: target, kind, actor, payload, read_at: null, created_at: iso() });
  };
  const person = (p: SocialProfile): Person => ({ user_id: p.user_id, handle: p.handle, display_name: p.display_name, color: p.color, visibility: p.visibility });
  const profileVisible = (s: Store, viewer: string, p: SocialProfile) =>
    p.user_id === viewer || canSee(s, viewer, p.user_id) || (p.active && p.visibility >= 2 && !isBlocked(s, viewer, p.user_id) && hasSocial(s, viewer));

  return {
    kind: 'fake',
    userId: async () => uid(),

    async myProfile() {
      return prof(read(), me()) ?? null;
    },
    async saveProfile(input) {
      const u = me();
      const handle = input.handle.toLowerCase().trim();
      if (!HANDLE.test(handle)) fail('Brukernavnet kan ha 3–20 tegn: små bokstaver, tall, _ og punktum.', 'Usernames are 3–20 characters: lowercase letters, numbers, _ and dots.');
      if (input.visibility !== 1 && !input.is_16_plus) fail('Under 16 år kan du bare ha privat konto.', 'Under 16 you can only have a private account.');
      if (nameProblem(handle, input.display_name)) fail('Navnet eller brukernavnet er ikke tillatt.', 'The name or username is not allowed.');
      return tx((s) => {
        if (s.profiles.some((p) => p.handle === handle && p.user_id !== u)) fail('Brukernavnet er tatt.', 'That username is taken.');
        const prev = prof(s, u);
        const next: SocialProfile = {
          tier_index: null,
          score: null,
          lift_scores: {},
          share_from: null,
          created_at: iso(),
          active: true,
          ...prev,
          ...input,
          handle,
          display_name: input.display_name.trim(),
          user_id: u,
          updated_at: iso(),
        };
        s.profiles = [...s.profiles.filter((p) => p.user_id !== u), next];
        // Bytte til Åpen godtar ventende forespørsler.
        if (next.visibility === 3 && prev?.visibility !== 3) {
          for (const f of s.follows) {
            if (f.followee === u && f.status === 'pending') {
              f.status = 'accepted';
              f.accepted_at = iso();
              notify(s, f.follower, 'follow_accepted', u);
            }
          }
        }
        return next;
      });
    },
    async handleAvailable(handle) {
      const u = me();
      const h = handle.toLowerCase();
      return HANDLE.test(h) && !nameProblem(h, '') && !read().profiles.some((p) => p.handle === h && p.user_id !== u);
    },
    async setActive(active) {
      const u = me();
      tx((s) => {
        const p = prof(s, u);
        if (p) p.active = active;
      });
    },
    async profiles(ids) {
      const s = read();
      const u = me();
      return s.profiles.filter((p) => ids.includes(p.user_id) && profileVisible(s, u, p));
    },

    async findByHandle(handle) {
      const s = read();
      const u = me();
      const h = handle.trim().replace(/^@/, '').trim().toLowerCase();
      const p = s.profiles.find((x) => x.handle === h && x.active && !isBlocked(s, u, x.user_id));
      return p ? person(p) : null;
    },
    async discover(query = '') {
      const s = read();
      const u = me();
      if (!hasSocial(s, u)) return [];
      const q = query.trim().toLowerCase();
      const last = (owner: string) => s.activities.filter((a) => a.user_id === owner).reduce((m, a) => (a.started_at > m ? a.started_at : m), '');
      return s.profiles
        .filter((p) => p.visibility === 3 && p.active && p.user_id !== u && !isBlocked(s, u, p.user_id))
        .filter((p) => !q || p.handle.includes(q) || p.display_name.toLowerCase().includes(q))
        .sort((a, b) => last(b.user_id).localeCompare(last(a.user_id)) || a.display_name.localeCompare(b.display_name))
        .map((p) => ({ ...person(p), tier_index: p.tier_index, following: follows(s, u, p.user_id) }));
    },
    async people(ids) {
      const s = read();
      const u = me();
      const related = (o: string) =>
        follows(s, u, o) || follows(s, o, u) || s.members.some((a) => a.user_id === u && s.members.some((b) => b.challenge_id === a.challenge_id && b.user_id === o));
      return s.profiles
        .filter((p) => ids.includes(p.user_id) && p.active && !isBlocked(s, u, p.user_id))
        .filter((p) => p.user_id === u || canSee(s, u, p.user_id) || p.visibility >= 2 || related(p.user_id))
        .map((p) => ({ ...person(p), tier_index: canSee(s, u, p.user_id) || p.visibility >= 2 ? p.tier_index : null }));
    },

    async follows() {
      const u = me();
      return read().follows.filter((f) => f.follower === u || f.followee === u);
    },
    async follow(target) {
      const u = me();
      return tx((s) => {
        if (u === target) fail('Ugyldig.', 'Invalid.');
        if (!hasSocial(s, u)) fail('Lag en sosial profil først.', 'Create a social profile first.');
        const p = prof(s, target);
        if (!p?.active || isBlocked(s, u, target)) fail('Fant ikke brukeren.', 'User not found.');
        let f = s.follows.find((x) => x.follower === u && x.followee === target);
        if (!f) {
          const status = p!.visibility === 3 ? 'accepted' : 'pending';
          f = { follower: u, followee: target, status, created_at: iso(), accepted_at: status === 'accepted' ? iso() : null };
          s.follows.push(f);
          notify(s, target, status === 'accepted' ? 'new_follower' : 'follow_request', u);
        }
        return f.status;
      });
    },
    async unfollow(target) {
      const u = me();
      tx((s) => void (s.follows = s.follows.filter((f) => !(f.follower === u && f.followee === target))));
    },
    async acceptFollower(requester) {
      const u = me();
      tx((s) => {
        const f = s.follows.find((x) => x.follower === requester && x.followee === u && x.status === 'pending');
        if (f) {
          f.status = 'accepted';
          f.accepted_at = iso();
          notify(s, requester, 'follow_accepted', u);
        }
      });
    },
    async removeFollower(requester) {
      const u = me();
      tx((s) => void (s.follows = s.follows.filter((f) => !(f.follower === requester && f.followee === u))));
    },
    async followersNotFollowedBack() {
      const s = read();
      const u = me();
      return s.follows
        .filter((f) => f.followee === u && f.status === 'accepted' && !follows(s, u, f.follower, 'accepted'))
        .map((f) => prof(s, f.follower))
        .filter((p): p is SocialProfile => !!p)
        .map(person)
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
    async removeFollowers(ids) {
      const u = me();
      return tx((s) => {
        const before = s.follows.length;
        s.follows = s.follows.filter((f) => !(f.followee === u && ids.includes(f.follower)));
        return before - s.follows.length;
      });
    },

    async blocked() {
      const u = me();
      return read().blocks.filter((b) => b.blocker === u).map((b) => b.blocked);
    },
    async block(target) {
      const u = me();
      tx((s) => {
        if (!s.blocks.some((b) => b.blocker === u && b.blocked === target)) s.blocks.push({ blocker: u, blocked: target });
        const pair = (a: string, b: string) => (a === u && b === target) || (a === target && b === u);
        s.follows = s.follows.filter((f) => !pair(f.follower, f.followee));
        s.reactions = s.reactions.filter((r) => !pair(r.user_id, r.activity_owner));
        s.notifications = s.notifications.filter((n) => !(n.actor && pair(n.user_id, n.actor)));
      });
    },
    async unblock(target) {
      const u = me();
      tx((s) => void (s.blocks = s.blocks.filter((b) => !(b.blocker === u && b.blocked === target))));
    },
    async report(target, reason, activityId) {
      const u = me();
      tx((s) => void s.reports.push({ reporter: u, target, reason, activity_id: activityId ?? null }));
    },

    async publish(a) {
      const u = me();
      tx((s) => {
        if (!prof(s, u)) fail('Lag en sosial profil først.', 'Create a social profile first.');
        const prev = s.activities.find((x) => x.user_id === u && x.id === a.id);
        s.activities = [...s.activities.filter((x) => !(x.user_id === u && x.id === a.id)), { ...a, user_id: u, created_at: prev?.created_at ?? iso(), updated_at: iso() }];
      });
    },
    async unpublish(activityId) {
      const u = me();
      tx((s) => {
        s.activities = s.activities.filter((x) => !(x.user_id === u && x.id === activityId));
        s.reactions = s.reactions.filter((r) => !(r.activity_owner === u && r.activity_id === activityId));
      });
    },
    async feed({ before, limit = 20, userId } = {}) {
      const s = read();
      const u = me();
      return s.activities
        .filter((a) => canSee(s, u, a.user_id) && (!before || a.started_at < before) && (!userId || a.user_id === userId))
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, limit);
    },
    async reactions(keys) {
      const s = read();
      const u = me();
      const wanted = new Set(keys.map((k) => `${k.owner}/${k.id}`));
      return s.reactions.filter((r) => wanted.has(`${r.activity_owner}/${r.activity_id}`) && canSee(s, u, r.activity_owner));
    },
    async react(owner, activityId, emoji) {
      const u = me();
      tx((s) => {
        const rest = s.reactions.filter((r) => !(r.activity_owner === owner && r.activity_id === activityId && r.user_id === u));
        if (!emoji) return void (s.reactions = rest);
        if (!canSee(s, u, owner) || !s.activities.some((a) => a.user_id === owner && a.id === activityId)) fail('Fant ikke økta.', 'Workout not found.');
        const isNew = rest.length === s.reactions.length;
        s.reactions = [...rest, { activity_owner: owner, activity_id: activityId, user_id: u, emoji, created_at: iso() }];
        const already = s.notifications.some((n) => n.user_id === owner && n.actor === u && n.kind === 'reaction' && n.payload.activity_id === activityId);
        if (isNew && !already) notify(s, owner, 'reaction', u, { activity_id: activityId, emoji });
      });
    },

    async notifications() {
      const u = me();
      return read()
        .notifications.filter((n) => n.user_id === u)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 100);
    },
    async markRead(ids) {
      const u = me();
      tx((s) => {
        for (const n of s.notifications) if (n.user_id === u && !n.read_at && (!ids || ids.includes(n.id))) n.read_at = iso();
      });
    },

    async leaderboard(board, scope = 'all', exercise, since) {
      const s = read();
      const u = me();
      const mine = prof(s, u);
      if (!mine?.active || mine.visibility < 2) fail('Ledertavler krever synlighet «Ledertavler» eller «Åpen».', 'Leaderboards need the “Leaderboards” or “Open” setting.');
      const from = since ?? new Date(new Date(clock()).getFullYear(), new Date(clock()).getMonth(), 1).toISOString();
      const tierScore = (a: Activity) => a.data.tier?.score ?? null;
      const value = (p: SocialProfile): number | null => {
        if (board === 'level') return p.score;
        if (board === 'gain') {
          if (p.score === null) return null;
          const own = s.activities.filter((a) => a.user_id === p.user_id && tierScore(a) !== null).sort((a, b) => a.started_at.localeCompare(b.started_at));
          const before = own.filter((a) => a.started_at < from).pop();
          const first = own.find((a) => a.started_at >= from);
          const base = before ? tierScore(before) : first ? tierScore(first) : null;
          return base === null ? null : p.score - base;
        }
        if (board === 'lift') return exercise ? (p.lift_scores[exercise] ?? null) : null;
        return s.activities.filter((a) => a.user_id === p.user_id && a.started_at >= from).length;
      };
      const rows = s.profiles
        .filter((p) => p.active && p.visibility >= 2 && !isBlocked(s, u, p.user_id))
        .filter((p) => scope === 'all' || p.user_id === u || (scope === 'tier' ? p.tier_index === mine!.tier_index : follows(s, u, p.user_id, 'accepted')))
        .map((p) => ({ p, v: value(p) }))
        .filter((x): x is { p: SocialProfile; v: number } => x.v !== null && x.v > 0)
        .sort((a, b) => b.v - a.v || a.p.display_name.localeCompare(b.p.display_name));
      return rows.map(({ p, v }): LeaderboardRow => ({
        rank: rows.findIndex((r) => r.v === v) + 1,
        user_id: p.user_id,
        handle: p.handle,
        display_name: p.display_name,
        color: p.color,
        tier_index: p.tier_index,
        value: Math.round(v * 10) / 10,
      }));
    },

    async challenges() {
      const s = read();
      const u = me();
      const challenges = s.challenges.filter((c) => inChallenge(s, c.id, u)).sort((a, b) => b.ends_at.localeCompare(a.ends_at));
      const ids = new Set(challenges.map((c) => c.id));
      return { challenges, members: s.members.filter((m) => ids.has(m.challenge_id)) };
    },
    async createChallenge(c) {
      const u = me();
      return tx((s) => {
        if (!hasSocial(s, u)) fail('Lag en sosial profil først.', 'Create a social profile first.');
        if (!c.invitees.length || c.invitees.length > 50) fail('Inviter mellom 1 og 50 personer.', 'Invite between 1 and 50 people.');
        const start = Date.parse(c.starts_at);
        const end = Date.parse(c.ends_at);
        if (!(end > start) || end > start + 366 * 86_400_000) fail('Ugyldig periode.', 'Invalid period.');
        if ((c.kind === 'lift' || c.kind === 'goal') && !c.exercise_id) fail('Velg et løft.', 'Choose a lift.');
        if (c.kind === 'goal' && !(c.target && c.target > 0 && c.target <= 1000)) fail('Velg en målvekt.', 'Choose a target weight.');
        if (c.kind === 'weekly' && !(c.target && c.target >= 1 && c.target <= 14)) fail('Velg antall økter per uke.', 'Choose workouts per week.');
        const title = c.title.trim();
        if (!title || title.length > 60) fail('Gi utfordringen et navn.', 'Give the challenge a name.');
        const invited = [...new Set(c.invitees)].filter((x) => canChallenge(s, u, x));
        if (!invited.length) fail('Du kan bare utfordre gjensidige følgere og åpne kontoer.', 'You can only challenge mutual followers and open accounts.');
        const cid = id();
        s.challenges.push({ id: cid, creator: u, kind: c.kind, exercise_id: c.exercise_id ?? null, target: c.target ?? null, title, starts_at: c.starts_at, ends_at: c.ends_at, created_at: iso() });
        s.members.push({ challenge_id: cid, user_id: u, status: 'joined', invited_at: iso(), joined_at: iso() });
        for (const x of invited) {
          s.members.push({ challenge_id: cid, user_id: x, status: 'invited', invited_at: iso(), joined_at: null });
          notify(s, x, 'challenge_invite', u, { challenge_id: cid, title });
        }
        return cid;
      });
    },
    async respondChallenge(cid, accept) {
      const u = me();
      tx((s) => {
        const m = s.members.find((x) => x.challenge_id === cid && x.user_id === u && x.status === 'invited');
        if (!m) return;
        m.status = accept ? 'joined' : 'declined';
        m.joined_at = accept ? iso() : null;
        const c = s.challenges.find((x) => x.id === cid);
        if (accept && c) notify(s, c.creator, 'challenge_joined', u, { challenge_id: cid, title: c.title });
      });
    },
    async leaveChallenge(cid) {
      const u = me();
      tx((s) => {
        if (s.challenges.some((c) => c.id === cid && c.creator === u)) {
          s.challenges = s.challenges.filter((c) => c.id !== cid);
          s.members = s.members.filter((m) => m.challenge_id !== cid);
        } else s.members = s.members.filter((m) => !(m.challenge_id === cid && m.user_id === u));
      });
    },
    async standings(cid) {
      const s = read();
      const u = me();
      if (!inChallenge(s, cid, u)) fail('Du er ikke med i denne utfordringen.', "You're not in this challenge.");
      const c = s.challenges.find((x) => x.id === cid)!;
      const joined = s.members.filter((m) => m.challenge_id === cid && m.status === 'joined').map((m) => m.user_id);
      const inside = (owner: string) => s.activities.filter((a) => a.user_id === owner && a.started_at >= c.starts_at && a.started_at < c.ends_at);
      const lift = (a: Activity) => (c.exercise_id ? a.data.lifts?.[c.exercise_id] : undefined);
      const reached = (owner: string): string | null => {
        if (c.kind !== 'goal') return null;
        const hit = inside(owner).filter((a) => (lift(a) ?? 0) >= (c.target ?? Infinity)).map((a) => a.started_at).sort();
        return hit[0] ?? null;
      };
      const value = (owner: string): number => {
        const acts = inside(owner);
        switch (c.kind) {
          case 'goal':
            return Math.max(0, ...acts.map((a) => lift(a) ?? 0));
          case 'workouts':
            return acts.length;
          case 'volume':
            return acts.reduce((sum, a) => sum + (a.data.volume_kg ?? 0), 0);
          case 'weekly': {
            const weeks = new Map<string, number>();
            for (const a of acts) {
              const d = new Date(a.started_at);
              const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
              const k = monday.toISOString().slice(0, 10);
              weeks.set(k, (weeks.get(k) ?? 0) + 1);
            }
            return [...weeks.values()].filter((n) => n >= (c.target ?? 1)).length;
          }
          case 'lift': {
            const best = Math.max(0, ...acts.map((a) => lift(a) ?? 0));
            const prior = s.activities.filter((a) => a.user_id === owner && a.started_at < c.starts_at).map((a) => lift(a) ?? 0);
            const firstInside = [...acts].filter((a) => lift(a) !== undefined).sort((a, b) => a.started_at.localeCompare(b.started_at))[0];
            const base = prior.some((v) => v > 0) ? Math.max(...prior) : firstInside ? (lift(firstInside) ?? 0) : 0;
            return Math.max(0, best - base);
          }
        }
      };
      const rows = joined
        .map((x) => ({ user_id: x, value: Math.round(value(x) * 10) / 10, reached_at: reached(x) }))
        .sort((a, b) => {
          // Nådd målet først (tidligst øverst), så de som ikke har nådd det, etter beste løft.
          if (a.reached_at && b.reached_at && a.reached_at !== b.reached_at) return a.reached_at < b.reached_at ? -1 : 1;
          if (!!a.reached_at !== !!b.reached_at) return a.reached_at ? -1 : 1;
          return b.value - a.value;
        });
      const same = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.reached_at === b.reached_at && a.value === b.value;
      return rows.map((r): Standing => ({ ...r, rank: rows.findIndex((x) => same(x, r)) + 1 }));
    },
  };
}
