import { useEffect, useState } from 'react';
import { useSetting } from '../lib/settings';
import { enableRestPush, pushStatus } from '../lib/push';
import { useUser } from '../auth/AuthProvider';
import { Button } from './ui';
import { Icon } from './Icon';
import { t } from '../i18n';

const ASKED_KEY = 'repgrade-push-asked';
const asked = () => {
  try {
    return !!localStorage.getItem(ASKED_KEY);
  } catch {
    return true;
  }
};
const markAsked = () => {
  try {
    localStorage.setItem(ASKED_KEY, new Date().toISOString());
  } catch {
    /* ignorer */
  }
};

/** Skal vi spørre? Bare med sky-konto, når varsler er mulig, ikke allerede på, ikke blokkert og ikke spurt før. */
export function shouldAskForPush(opts: { cloud: boolean; status: ReturnType<typeof pushStatus>; enabled: boolean; permission: string; asked: boolean }) {
  return opts.cloud && opts.status === 'ready' && !opts.enabled && opts.permission === 'default' && !opts.asked;
}

/**
 * «Få varsel når pausen er over»: vises én gang, første gang en hviletimer starter (da gir varselet
 * mening). «Slå på» ber om lov direkte i trykket, som iPhone krever.
 */
export function PushPrompt() {
  const user = useUser();
  const timer = useSetting('restTimer');
  const enabled = useSetting('restPush');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!timer || open) return;
    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    if (shouldAskForPush({ cloud: user.kind === 'cloud', status: pushStatus(), enabled, permission, asked: asked() })) {
      markAsked();
      setOpen(true);
    }
  }, [timer, enabled, open, user.kind]);

  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <PushPromptView
      busy={busy}
      error={error}
      onClose={close}
      onEnable={async () => {
        setBusy(true);
        setError(null);
        try {
          await enableRestPush();
          close();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** Selve dialogen (skilt ut så den kan vises i forhåndsvisning og skjermbilder). */
export function PushPromptView({ busy, error, onEnable, onClose }: { busy: boolean; error: string | null; onEnable: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center animate-fade bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="push-prompt-title">
      <div className="pb-safe w-full max-w-md animate-sheet rounded-2xl border border-line bg-surface p-5">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
          <Icon name="timer" size={28} />
        </div>
        <h2 id="push-prompt-title" className="mt-4 text-center text-xl font-bold">
          {t('Få beskjed når pausen er over', 'Get notified when rest is over')}
        </h2>
        <p className="mt-2 text-center text-sm text-muted">
          {t(
            'Lås telefonen eller bytt app mens du hviler. RepGrade sier fra med lyd og vibrasjon når det er tid for neste set.',
            'Lock your phone or switch apps while you rest. RepGrade lets you know with sound and vibration when it is time for the next set.',
          )}
        </p>
        <div className="mt-4 rounded-xl bg-raised px-3 py-2.5 text-sm">
          <span className="font-semibold">{t('Pausen er over', 'Rest is over')}</span>
          <span className="block text-muted">{t('Benkpress – neste set', 'Bench press – next set')}</span>
        </div>
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <Button
            full
            className="min-h-12 text-base"
            disabled={busy}
            onClick={onEnable}
          >
            {busy ? t('Slår på …', 'Turning on …') : t('Slå på varsler', 'Turn on notifications')}
          </Button>
          <Button full variant="ghost" onClick={onClose}>
            {t('Ikke nå', 'Not now')}
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-faint">{t('Du kan endre dette under Profil når som helst.', 'You can change this under Profile at any time.')}</p>
      </div>
    </div>
  );
}
