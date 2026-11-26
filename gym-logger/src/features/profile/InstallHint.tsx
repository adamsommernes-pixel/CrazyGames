import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/ui';

const KEY = 'gym-install-hint-dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function readDismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Viser hvordan appen legges på hjemskjermen, når den kjøres i en vanlig nettleserfane. */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => isStandalone() || readDismissed());
  if (hidden) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-green/40 bg-green-dim/30 p-3">
      <Icon name="share" className="mt-0.5 shrink-0 text-green" />
      <p className="flex-1 text-sm">
        <span className="font-semibold">Installer appen: </span>
        {ios ? 'trykk på Del-knappen i Safari og velg «Legg til på Hjem-skjerm».' : 'åpne nettlesermenyen og velg «Installer app» eller «Legg til på startskjermen».'}{' '}
        Da åpnes den i fullskjerm og virker uten nett.
      </p>
      <IconButton
        icon="x"
        label="Skjul"
        className="-mt-2 -mr-2"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* ignorer */
          }
          setHidden(true);
        }}
      />
    </div>
  );
}
