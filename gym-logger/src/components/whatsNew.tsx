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

export interface WhatsNew {
  version: string;
  items: { nb: string; en: string; icon?: IconName }[];
}

let current: { news: WhatsNew; update: () => void; later: () => void } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function parseWhatsNew(json: unknown): WhatsNew | null {
  const w = json as Partial<WhatsNew>;
  if (!w || typeof w.version !== 'string' || !Array.isArray(w.items)) return null;
  const items = w.items
    .filter((i) => i && typeof i.nb === 'string' && typeof i.en === 'string')
    .map((i) => ({ nb: i.nb, en: i.en, icon: typeof i.icon === 'string' && isIconName(i.icon) ? i.icon : undefined }));
  return items.length ? { version: w.version, items } : null;
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

export function showWhatsNew(news: WhatsNew, update: () => void, later: () => void) {
  current = { news, update, later };
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
          {state.news.items.map((i) => (
            <li key={i.nb} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong">
                <Icon name={i.icon ?? 'check'} size={18} />
              </span>
              <span className="pt-1.5 leading-snug">{t(i.nb, i.en)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 pt-2 pb-5">
          <p className="mb-1 text-center text-xs text-muted">{t('Øktene dine er lagret. Oppdateringen tar et par sekunder.', 'Your workouts are saved. Updating takes a couple of seconds.')}</p>
          <Button
            full
            className="min-h-13 text-lg"
            onClick={() => {
              close();
              state.update();
            }}
          >
            {t('Oppdater nå', 'Update now')}
          </Button>
          <Button full variant="ghost" onClick={later}>
            {t('Senere', 'Later')}
          </Button>
        </div>
      </div>
    </div>
  );
}
