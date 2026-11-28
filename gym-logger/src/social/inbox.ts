import { useEffect, useSyncExternalStore } from 'react';
import { social } from './index';
import { rememberPerson } from './graph';
import type { Person, SocialNotification } from './types';
import { t } from '../i18n';

// Innboksen i appen: varsler fra serveren (notifications-tabellen), delt av bjella, bunnmenyen og innbokssiden.

export interface Inbox {
  items: SocialNotification[];
  people: Map<string, Person>;
  unread: number;
  loaded: boolean;
}

let state: Inbox = { items: [], people: new Map(), unread: 0, loaded: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<Inbox>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function resetInbox() {
  set({ items: [], people: new Map(), unread: 0, loaded: false });
}

let loading: Promise<void> | null = null;
export function refreshInbox(): Promise<void> {
  const b = social();
  if (!b) return Promise.resolve();
  loading ??= (async () => {
    try {
      const items = await b.notifications();
      const missing = [...new Set(items.map((n) => n.actor).filter((a): a is string => !!a))].filter((id) => !state.people.has(id));
      const people = new Map(state.people);
      if (missing.length) for (const p of await b.people(missing)) {
        people.set(p.user_id, p);
        rememberPerson(p);
      }
      set({ items, people, unread: items.filter((n) => !n.read_at).length, loaded: true });
    } catch {
      /* uten nett: behold det vi har */
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Merk alt som lest (når innboksen åpnes). */
export async function markAllRead() {
  const b = social();
  if (!b || !state.unread) return;
  const now = new Date().toISOString();
  set({ unread: 0, items: state.items.map((n) => (n.read_at ? n : { ...n, read_at: now })) });
  await b.markRead().catch(() => {});
}

export function useInbox(): Inbox {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Usynlig komponent (sosial konto): henter varsler ved oppstart, når appen åpnes igjen og hvert minutt. */
export function InboxPoller() {
  useEffect(() => {
    void refreshInbox();
    const onVisible = () => document.visibilityState === 'visible' && void refreshInbox();
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(() => document.visibilityState === 'visible' && void refreshInbox(), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, []);
  return null;
}

/** Teksten og hvor et varsel leder, uten React (testes for seg). */
export function describe(n: SocialNotification, actor: Person | undefined): { text: string; to: string; tab?: 'feed' | 'people' } {
  const who = actor?.display_name ?? t('Noen', 'Someone');
  const title = typeof n.payload.title === 'string' ? n.payload.title : '';
  const profile = actor ? `/u/${actor.handle}` : '/social';
  switch (n.kind) {
    case 'follow_request':
      return { text: t(`${who} vil følge deg`, `${who} wants to follow you`), to: '/social', tab: 'people' };
    case 'follow_accepted':
      return { text: t(`${who} godtok forespørselen din`, `${who} accepted your request`), to: profile };
    case 'new_follower':
      return { text: t(`${who} følger deg nå`, `${who} started following you`), to: profile };
    case 'reaction':
      return { text: t(`${who} ga ${String(n.payload.emoji ?? '💪')} på økta di`, `${who} gave ${String(n.payload.emoji ?? '💪')} to your workout`), to: '/social', tab: 'feed' };
    case 'challenge_invite':
      return { text: t(`${who} utfordret deg: «${title}»`, `${who} challenged you: “${title}”`), to: `/challenge/${String(n.payload.challenge_id ?? '')}` };
    case 'challenge_joined':
      return { text: t(`${who} ble med i «${title}»`, `${who} joined “${title}”`), to: `/challenge/${String(n.payload.challenge_id ?? '')}` };
  }
}
