import { useSyncExternalStore } from 'react';
import { useEffect } from 'react';
import { Button } from './ui';
import { Icon, isIconName, type IconName } from './Icon';
import { Logo } from './Logo';
import { lockScroll, unlockScroll } from '../lib/scrollLock';
import { t } from '../i18n';

// «Hva er nytt»: når en ny versjon er lastet ned, hentes whats-new.json fra den nye versjonen
// (fila ligger ikke i offline-hurtigbufferen, så den kommer alltid fra nettet) og vises før
// brukeren oppdaterer.

export interface Release {
  version: string;
  items: { nb: string; en: string; icon?: IconName }[];
}

/** Nyhetsfila: nyeste versjon øverst (`version`/`items`) og eldre versjoner i `history`. */
export interface WhatsNew extends Release {
  /** Alle versjoner, nyeste først (den nyeste er den samme som version/items). */
  releases: Release[];
}

/** Sammenligner versjoner som «1.10.2» riktig (ikke som tekst). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Versjonene brukeren ikke har sett nyhetene for, nyeste først (høyst `max`). Uten kjent
 * forrige versjon vises bare den nyeste. Slik får de som hoppet over en versjon med seg alt.
 */
export function releasesSince(news: WhatsNew, seen: string | null, max = 3): Release[] {
  if (!seen) return news.releases.slice(0, 1);
  return news.releases.filter((r) => compareVersions(r.version, seen) > 0).slice(0, max);
}

// mode «update»: før oppdatering (Oppdater nå / Senere). «info»: etter oppdatering (bare Fortsett).
let current: { news: WhatsNew; releases: Release[]; update: () => void; later: () => void; mode: 'update' | 'info' } | null = null;

/** Siste versjon brukeren har sett nyhetene for (per enhet). */
const SEEN_KEY = 'repgrade-seen-version';
export const seenVersion = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
export const markVersionSeen = (v: string) => {
  try {
    localStorage.setItem(SEEN_KEY, v);
  } catch {
    /* lagring utilgjengelig */
  }
};

/**
 * Skal «Nytt i versjon X» vises etter oppdatering? Bare når brukeren har brukt appen før
 * (har økter) og ikke har sett nyhetene for denne versjonen, f.eks. fordi forrige versjon bare
 * viste et lite varsel. Nye brukere får ingen nyhetsliste.
 */
export function shouldShowAfterUpdate(current: string, seen: string | null, hasWorkouts: boolean): boolean {
  // seen === null: ny telefon eller ny nettleser (alle som oppdaterte fra 1.1 har en sett-versjon). Ingen nyheter da.
  return seen !== null && compareVersions(current, seen) > 0 && hasWorkouts;
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function parseRelease(json: unknown): Release | null {
  const w = json as Partial<Release>;
  if (!w || typeof w.version !== 'string' || !Array.isArray(w.items)) return null;
  const items = w.items
    .filter((i) => i && typeof i.nb === 'string' && typeof i.en === 'string')
    .map((i) => ({ nb: i.nb, en: i.en, icon: typeof i.icon === 'string' && isIconName(i.icon) ? i.icon : undefined }));
  return items.length ? { version: w.version, items } : null;
}

export function parseWhatsNew(json: unknown): WhatsNew | null {
  const latest = parseRelease(json);
  if (!latest) return null;
  const history = (json as { history?: unknown[] }).history;
  const older = Array.isArray(history) ? (history.map(parseRelease).filter(Boolean) as Release[]) : [];
  const releases = [latest, ...older].sort((a, b) => compareVersions(b.version, a.version));
  return { ...latest, releases };
}

/** Henter nyhetene for den nye versjonen. null hvis fila mangler eller ikke kan leses. */
export async function fetchWhatsNew(): Promise<WhatsNew | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}whats-new.json`, { cache: 'no-store' });
    return res.ok ? parseWhatsNew(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Viser nyhetene. `seen` er siste versjon brukeren har sett nyheter for (alt nyere vises, høyst 3). */
export function showWhatsNew(news: WhatsNew, update: () => void, later: () => void, mode: 'update' | 'info' = 'update', seen: string | null = null) {
  const releases = releasesSince(news, seen);
  current = { news, releases: releases.length ? releases : news.releases.slice(0, 1), update, later, mode };
  emit();
}

const close = () => {
  current = null;
  emit();
};

export function WhatsNewHost() {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  if (!state) return null;
  return <WhatsNewScreen state={state} />;
}

/** Fullskjerm «Nytt i denne versjonen» med stor oppdater-knapp. */
function WhatsNewScreen({ state }: { state: NonNullable<typeof current> }) {
  useEffect(() => {
    lockScroll();
    return unlockScroll;
  }, []);
  const later = () => {
    close();
    state.later();
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title" className="pt-safe pb-safe fixed inset-0 z-[90] flex animate-fade flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col px-5">
        <div className="flex flex-col items-center pt-8 text-center">
          <Logo size={56} name={false} />
          <div className="mt-3 text-sm font-semibold text-muted">
            RepGrade <span className="font-num">{state.news.version}</span>
          </div>
          <h2 id="whats-new-title" className="mt-1 text-2xl font-bold">
            {t('Nytt i denne versjonen', 'New in this version')}
          </h2>
        </div>
        <ul className="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4" data-whats-new>
          {state.releases.map((r, ri) => (
            <li key={r.version} className="flex flex-col gap-3">
              {state.releases.length > 1 && (
                <div className={`text-xs font-semibold text-faint ${ri ? 'pt-2' : ''}`}>
                  {t('Versjon', 'Version')} <span className="font-num">{r.version}</span>
                </div>
              )}
              <ul className="flex flex-col gap-3">
                {r.items.map((i) => (
                    <li key={i.nb} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong">
                        <Icon name={i.icon ?? 'check'} size={18} />
                      </span>
                      <span className="pt-1.5 leading-snug">{t(i.nb, i.en)}</span>
                    </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 pt-2 pb-5">
          {state.mode === 'update' && (
            <p className="mb-1 text-center text-xs text-muted">{t('Øktene dine er lagret. Oppdateringen tar et par sekunder.', 'Your workouts are saved. Updating takes a couple of seconds.')}</p>
          )}
          {state.mode === 'update' ? (
            <>
              <Button
                full
                className="min-h-13 text-lg"
                onClick={() => {
                  // Nyhetene er sett nå, så de vises ikke en gang til etter oppdateringen.
                  markVersionSeen(state.news.version);
                  close();
                  state.update();
                }}
              >
                {t('Oppdater nå', 'Update now')}
              </Button>
              <Button full variant="ghost" onClick={later}>
                {t('Senere', 'Later')}
              </Button>
            </>
          ) : (
            <Button full className="min-h-13 text-lg" onClick={later}>
              {t('Fortsett', 'Continue')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
