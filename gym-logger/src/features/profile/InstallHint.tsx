import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/ui';
import { t } from '../../i18n';

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
        <span className="font-semibold">{t('Installer appen', 'Install the app')}: </span>
        {ios
          ? t('trykk på Del-knappen i Safari og velg «Legg til på Hjem-skjerm».', 'tap the Share button in Safari and choose “Add to Home Screen”.')
          : t('åpne nettlesermenyen og velg «Installer app» eller «Legg til på startskjermen».', 'open the browser menu and choose “Install app” or “Add to Home screen”.')}{' '}
        {t('Da åpnes den i fullskjerm og virker uten nett.', 'It then opens full screen and works offline.')}
      </p>
      <IconButton
        icon="x"
        label={t('Skjul', 'Hide')}
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
