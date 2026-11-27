import { useSyncExternalStore } from 'react';
import { Button, Sheet } from './ui';
import { Icon } from './Icon';
import { t } from '../i18n';

// «Hva er nytt»: når en ny versjon er lastet ned, hentes whats-new.json fra den nye versjonen
// (fila ligger ikke i offline-hurtigbufferen, så den kommer alltid fra nettet) og vises før
// brukeren oppdaterer.

export interface WhatsNew {
  version: string;
  items: { nb: string; en: string }[];
}

let current: { news: WhatsNew; update: () => void; later: () => void } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function parseWhatsNew(json: unknown): WhatsNew | null {
  const w = json as Partial<WhatsNew>;
  if (!w || typeof w.version !== 'string' || !Array.isArray(w.items)) return null;
  const items = w.items.filter((i) => i && typeof i.nb === 'string' && typeof i.en === 'string');
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
  const later = () => {
    close();
    state.later();
  };
  return (
    <Sheet open onClose={later} title={t(`Nytt i versjon ${state.news.version}`, `New in version ${state.news.version}`)}>
      <ul className="flex flex-col gap-3" data-whats-new>
        {state.news.items.map((i) => (
          <li key={i.nb} className="flex gap-3">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent" />
            <span>{t(i.nb, i.en)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">{t('Øktene dine er lagret. Oppdateringen tar et par sekunder.', 'Your workouts are saved. Updating takes a couple of seconds.')}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button full onClick={() => {
          close();
          state.update();
        }}>
          {t('Oppdater nå', 'Update now')}
        </Button>
        <Button full variant="ghost" onClick={later}>
          {t('Senere', 'Later')}
        </Button>
      </div>
    </Sheet>
  );
}
