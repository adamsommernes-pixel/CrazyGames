import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/ui';
import { t } from '../../i18n';
import { isStandalone, promptInstall, useCanInstall } from '../../lib/pwa';

const KEY = 'gym-install-hint-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Viser hvordan appen legges på hjemskjermen, når den kjøres i en vanlig nettleserfane. */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => __ARTIFACT__ || isStandalone() || readDismissed());
  const canInstall = useCanInstall();
  if (hidden) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent/40 bg-accent-soft/30 p-3">
      <Icon name="share" className="mt-0.5 shrink-0 text-accent" />
      <p className="flex-1 text-sm">
        <span className="font-semibold">{t('Installer appen', 'Install the app')}: </span>
        {ios
          ? t('trykk på Del-knappen i Safari og velg «Legg til på Hjem-skjerm».', 'tap the Share button in Safari and choose “Add to Home Screen”.')
          : t('åpne nettlesermenyen og velg «Installer app» eller «Legg til på startskjermen».', 'open the browser menu and choose “Install app” or “Add to Home screen”.')}{' '}
        {t('Da åpnes den i fullskjerm og virker uten nett.', 'It then opens full screen and works offline.')}
        {canInstall && (
          <button
            type="button"
            className="mt-2 flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 font-semibold text-on-accent"
            onClick={async () => {
              if (await promptInstall()) setHidden(true);
            }}
          >
            <Icon name="download" size={18} /> {t('Installer appen', 'Install the app')}
          </button>
        )}
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
