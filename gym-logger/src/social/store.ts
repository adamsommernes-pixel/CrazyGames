import { useEffect, useSyncExternalStore } from 'react';
import { social } from './index';
import { SocialError, type SocialProfile, type SocialProfileInput } from './types';
import { t } from '../i18n';

// Din egen sosiale profil, hentet fra serveren og delt av alle skjermer (som synkstatusen i db/sync.ts).

export interface MySocial {
  status: 'idle' | 'loading' | 'ready' | 'error';
  profile: SocialProfile | null;
  error: string | null;
}

let state: MySocial = { status: 'idle', profile: null, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<MySocial>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const errorText = (e: unknown) =>
  e instanceof SocialError ? e.message : navigator.onLine ? t('Noe gikk galt. Prøv igjen.', 'Something went wrong. Try again.') : t('Ingen nettforbindelse.', 'No internet connection.');

/** Ved inn- og utlogging. */
export function resetMySocial() {
  set({ status: 'idle', profile: null, error: null });
}

let loading: Promise<void> | null = null;
export function refreshMySocial(): Promise<void> {
  const b = social();
  if (!b) return Promise.resolve();
  loading ??= (async () => {
    if (state.status !== 'ready') set({ status: 'loading', error: null });
    try {
      set({ status: 'ready', profile: await b.myProfile(), error: null });
    } catch (e) {
      set({ status: state.profile ? 'ready' : 'error', error: errorText(e) });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Lagrer (lager eller endrer) profilen. Kaster SocialError med en melding som kan vises. */
export async function saveMySocial(input: SocialProfileInput): Promise<SocialProfile> {
  const b = social();
  if (!b) throw new SocialError(t('Sosialt er ikke tilgjengelig.', 'Social is not available.'));
  const profile = await b.saveProfile(input);
  set({ status: 'ready', profile, error: null });
  return profile;
}

/** Det appen kan endre, ut fra en lagret profil (til delvise oppdateringer). */
export const inputOf = (p: SocialProfile): SocialProfileInput => ({
  handle: p.handle,
  display_name: p.display_name,
  color: p.color,
  visibility: p.visibility,
  is_16_plus: p.is_16_plus,
  tier_index: p.tier_index,
  score: p.score,
  lift_scores: p.lift_scores,
  share_from: p.share_from,
});

export function useMySocial(): MySocial & { refresh: () => Promise<void> } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (state.status === 'idle') void refreshMySocial();
  }, []);
  return { ...s, refresh: refreshMySocial };
}
