import { useCallback, useEffect, useRef, useState } from 'react';
import { social } from './index';
import { errorText } from './store';
import { rememberPerson } from './graph';
import type { Activity, Emoji, Person, Reaction } from './types';

// Feeden: økter du kan se (dine egne og de du følger, eller åpne kontoer), nyeste først, side for side.

export const PAGE = 20;

export interface FeedItem {
  activity: Activity;
  author: Person | undefined;
  reactions: Reaction[];
}

export function useFeed(opts: { userId?: string } = {}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const people = useRef(new Map<string, Person>());

  const load = useCallback(
    async (before?: string) => {
      const b = social();
      if (!b) return;
      try {
        const page = await b.feed({ before, limit: PAGE, userId: opts.userId });
        const missing = [...new Set(page.map((a) => a.user_id))].filter((id) => !people.current.has(id));
        if (missing.length) for (const p of await b.people(missing)) {
          people.current.set(p.user_id, p);
          rememberPerson(p);
        }
        const reactions = await b.reactions(page.map((a) => ({ owner: a.user_id, id: a.id })));
        const next = page.map((activity) => ({
          activity,
          author: people.current.get(activity.user_id),
          reactions: reactions.filter((r) => r.activity_owner === activity.user_id && r.activity_id === activity.id),
        }));
        setItems((prev) => (before ? [...prev, ...next] : next));
        setMore(page.length === PAGE);
        setStatus('ready');
        setError(null);
      } catch (e) {
        setError(errorText(e));
        setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
      }
    },
    [opts.userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);
  const loadMore = useCallback(() => load(items[items.length - 1]?.activity.started_at), [load, items]);

  /** Reager (eller fjern reaksjonen med samme emoji). Vises med en gang, rettes om serveren sier nei. */
  const react = useCallback(async (item: FeedItem, me: string, emoji: Emoji) => {
    const b = social();
    if (!b) return;
    const mine = item.reactions.find((r) => r.user_id === me);
    const next = mine?.emoji === emoji ? null : emoji;
    const key = (i: FeedItem) => `${i.activity.user_id}/${i.activity.id}`;
    const apply = (reactions: Reaction[]) => setItems((prev) => prev.map((i) => (key(i) === key(item) ? { ...i, reactions } : i)));
    const others = item.reactions.filter((r) => r.user_id !== me);
    apply(next ? [...others, { activity_owner: item.activity.user_id, activity_id: item.activity.id, user_id: me, emoji: next, created_at: new Date().toISOString() }] : others);
    try {
      await b.react(item.activity.user_id, item.activity.id, next);
    } catch (e) {
      apply(item.reactions);
      throw e;
    }
  }, []);

  const remove = useCallback((item: FeedItem) => setItems((prev) => prev.filter((i) => i !== item)), []);

  return { items, status, error, more, refresh, loadMore, react, remove };
}
