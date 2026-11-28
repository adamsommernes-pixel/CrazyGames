import { useEffect, useSyncExternalStore } from 'react';
import { social } from './index';
import { errorText } from './store';
import type { Follow, FollowStatus, Person } from './types';

// Hvem du følger og hvem som følger deg, delt av alle skjermer i Sosialt.

export interface Relations {
  /** Forespørsler til deg som venter på svar (nyeste først). */
  requests: string[];
  /** Godtatte følgere. */
  followers: string[];
  /** Du følger (godtatt). */
  following: string[];
  /** Du har spurt, venter på svar. */
  requested: string[];
}

/** Ren funksjon: deler følgeradene inn i lister sett fra `me`. */
export function relations(follows: Follow[], me: string): Relations {
  const by = (a: Follow, b: Follow) => b.created_at.localeCompare(a.created_at);
  const sorted = [...follows].sort(by);
  return {
    requests: sorted.filter((f) => f.followee === me && f.status === 'pending').map((f) => f.follower),
    followers: sorted.filter((f) => f.followee === me && f.status === 'accepted').map((f) => f.follower),
    following: sorted.filter((f) => f.follower === me && f.status === 'accepted').map((f) => f.followee),
    requested: sorted.filter((f) => f.follower === me && f.status === 'pending').map((f) => f.followee),
  };
}

/** Din status overfor en annen bruker. */
export type Relation = 'self' | 'following' | 'requested' | 'follows-you' | 'none';
export function relationTo(r: Relations, me: string, other: string): Relation {
  if (other === me) return 'self';
  if (r.following.includes(other)) return 'following';
  if (r.requested.includes(other)) return 'requested';
  if (r.followers.includes(other)) return 'follows-you';
  return 'none';
}

export interface Graph {
  status: 'idle' | 'loading' | 'ready' | 'error';
  me: string | null;
  rel: Relations;
  /** Navn og brukernavn for alle i listene. */
  people: Map<string, Person>;
  blocked: string[];
  error: string | null;
}

const EMPTY: Relations = { requests: [], followers: [], following: [], requested: [] };
let state: Graph = { status: 'idle', me: null, rel: EMPTY, people: new Map(), blocked: [], error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<Graph>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function resetGraph() {
  set({ status: 'idle', me: null, rel: EMPTY, people: new Map(), blocked: [], error: null });
}

let loading: Promise<void> | null = null;
export function refreshGraph(): Promise<void> {
  const b = social();
  if (!b) return Promise.resolve();
  loading ??= (async () => {
    if (state.status !== 'ready') set({ status: 'loading', error: null });
    try {
      const [me, follows, blocked] = await Promise.all([b.userId(), b.follows(), b.blocked()]);
      if (!me) return;
      const rel = relations(follows, me);
      const ids = [...new Set([...rel.requests, ...rel.followers, ...rel.following, ...rel.requested, ...blocked])];
      // Blokkerte vises ikke via people(); de huskes med det vi visste fra før.
      const found = await b.people(ids);
      const people = new Map(state.people);
      for (const p of found) people.set(p.user_id, p);
      set({ status: 'ready', me, rel, people, blocked, error: null });
    } catch (e) {
      set({ status: state.status === 'ready' ? 'ready' : 'error', error: errorText(e) });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Husk en person vi har sett (f.eks. fra søk), så navnet kan vises i listene. */
export function rememberPerson(p: Person) {
  const people = new Map(state.people);
  people.set(p.user_id, { ...people.get(p.user_id), ...p });
  set({ people });
}

export function useGraph(): Graph & { refresh: () => Promise<void> } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (state.status === 'idle') void refreshGraph();
  }, []);
  return { ...s, refresh: refreshGraph };
}

// ---- Handlinger: kall serveren, oppdater listene etterpå ----

const act = async <T>(fn: () => Promise<T>): Promise<T> => {
  const b = social();
  if (!b) throw new Error('Sosialt er ikke tilgjengelig');
  try {
    return await fn();
  } finally {
    await refreshGraph();
  }
};

export const follow = (id: string): Promise<FollowStatus> => act(() => social()!.follow(id));
export const unfollow = (id: string) => act(() => social()!.unfollow(id));
export const acceptFollower = (id: string) => act(() => social()!.acceptFollower(id));
export const removeFollower = (id: string) => act(() => social()!.removeFollower(id));
export const block = (id: string) => act(() => social()!.block(id));
export const unblock = (id: string) => act(() => social()!.unblock(id));
