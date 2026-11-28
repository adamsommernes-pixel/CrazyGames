import { useEffect, useSyncExternalStore } from 'react';
import { social } from './index';
import { rememberPerson } from './graph';
import type { Suggestion } from './types';
import { t } from '../i18n';

// Forslag til folk å følge, delt av feeden (kort hver 4. økt) og Folk-fanen.
// Hentes én gang per økt i appen; de du skjuler (×) huskes på enheten.

export interface Suggestions {
  status: 'idle' | 'loading' | 'ready' | 'error';
  list: Suggestion[];
}

const HIDDEN_KEY = 'repgrade-suggestions-hidden';
let state: Suggestions = { status: 'idle', list: [] };
let me = '';
const listeners = new Set<() => void>();
const set = (patch: Partial<Suggestions>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

function hidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(`${HIDDEN_KEY}:${me}`) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function resetSuggestions() {
  me = '';
  set({ status: 'idle', list: [] });
}

let loading: Promise<void> | null = null;
export function refreshSuggestions(): Promise<void> {
  const b = social();
  if (!b) return Promise.resolve();
  loading ??= (async () => {
    if (state.status !== 'ready') set({ status: 'loading' });
    try {
      me = (await b.userId()) ?? '';
      const skip = hidden();
      const list = (await b.suggestions(40)).filter((p) => !skip.has(p.user_id));
      for (const p of list) rememberPerson(p);
      set({ status: 'ready', list });
    } catch {
      // F.eks. før 013 er kjørt: ingen forslag, ingen feilmelding i feeden.
      set({ status: state.status === 'ready' ? 'ready' : 'error' });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Skjul en person fra forslagene (huskes på enheten). */
export function hideSuggestion(userId: string) {
  const h = hidden();
  h.add(userId);
  try {
    localStorage.setItem(`${HIDDEN_KEY}:${me}`, JSON.stringify([...h].slice(-500)));
  } catch {
    /* fullt */
  }
  set({ list: state.list.filter((p) => p.user_id !== userId) });
}

export function useSuggestions(enabled = true): Suggestions {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (enabled && state.status === 'idle') void refreshSuggestions();
  }, [enabled]);
  return s;
}

/** «Følges av Frida og Geir», «Følger deg», osv. */
export function suggestionReason(p: Suggestion): string {
  const [a, b] = p.mutual_names;
  if (p.mutual_count >= 3 && a) return t(`Følges av ${a} + ${p.mutual_count - 1} til`, `Followed by ${a} + ${p.mutual_count - 1} more`);
  if (p.mutual_count === 2 && a && b) return t(`Følges av ${a} og ${b}`, `Followed by ${a} and ${b}`);
  if (p.mutual_count >= 1 && a) return t(`Følges av ${a}`, `Followed by ${a}`);
  if (p.follows_you) return t('Følger deg', 'Follows you');
  if (p.visibility === 3) return t('Åpen konto', 'Open account');
  return t('Foreslått for deg', 'Suggested for you');
}

/** Hvilke forslag som vises i kort nr. `n` (0, 1, 2 …) i feeden: nye folk i hvert kort, null når de er brukt opp. */
export function suggestionChunk<T>(list: T[], n: number, size = 6): T[] | null {
  const chunk = list.slice(n * size, (n + 1) * size);
  return chunk.length >= 2 || (n === 0 && chunk.length) ? chunk : null;
}
