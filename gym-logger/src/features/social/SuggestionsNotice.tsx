import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { Button } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { showToast } from '../../components/toast';
import { useWhatsNewOpen } from '../../components/whatsNew';
import { errorText, setMySuggestable, useMySocial } from '../../social/store';
import { t } from '../../i18n';

// Én gang per konto (1.4): private kontoer på 16+ kan nå foreslås for andre. Sier det rett ut og lar
// brukeren slå det av med én gang. Vises ikke for åpne kontoer (uendret) eller under 16 (foreslås aldri).
export const NOTICE_KEY = 'notice:suggestions-1.4';

export function SuggestionsNotice() {
  const { profile } = useMySocial();
  const newsOpen = useWhatsNewOpen();
  const seen = useLiveQuery(async () => !!(await db.kv.get(NOTICE_KEY)), [], true);
  const [busy, setBusy] = useState(false);
  if (seen || newsOpen || !profile || !profile.is_16_plus || profile.visibility === 3 || profile.suggestable === false) return null;

  const done = async (keep: boolean) => {
    setBusy(true);
    try {
      if (!keep) {
        await setMySuggestable(false);
        showToast(t('Du vises ikke i forslag', "You won't show up in suggestions"));
      }
      await db.kv.put({ key: NOTICE_KEY, value: { keep, at: new Date().toISOString() } });
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sugg-notice-title" className="pt-safe pb-safe fixed inset-0 z-[80] flex animate-fade items-end justify-center bg-black/75 sm:items-center">
      <div className="w-full max-w-xl animate-sheet rounded-t-2xl border-t border-line bg-surface px-5 pt-6 pb-6 sm:rounded-2xl">
        <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="users" size={24} />
        </span>
        <h2 id="sugg-notice-title" className="mt-3 text-2xl font-bold">
          {t('Nytt: Folk du kanskje kjenner', 'New: People you may know')}
        </h2>
        <p className="mt-2 text-muted">
          {t(
            'For at venner skal finne hverandre, kan alle sosiale kontoer på 16 år eller eldre nå foreslås for andre og finnes i navnesøk – også private kontoer.',
            'To help friends find each other, every social account aged 16 or over can now be suggested to others and found by name – private accounts too.',
          )}
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          <li className="flex gap-2">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent" />
            {t('Andre ser bare navnet, @brukernavnet og fargen din.', 'Others only see your name, @username and colour.')}
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent" />
            {t('Øktene og nivået ditt er fortsatt skjult til du godtar en forespørsel.', 'Your workouts and level stay hidden until you accept a request.')}
          </li>
          <li className="flex gap-2">
            <Icon name="check" size={18} className="mt-0.5 shrink-0 text-accent" />
            {t('Du kan slå det av når som helst under Profil → Vis meg i forslag.', 'You can turn it off any time under Profile → Show me in suggestions.')}
          </li>
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <Button full disabled={busy} onClick={() => void done(true)}>
            {t('Greit', 'Got it')}
          </Button>
          <Button full variant="secondary" disabled={busy} onClick={() => void done(false)}>
            {t('Ikke vis meg i forslag', "Don't show me in suggestions")}
          </Button>
        </div>
      </div>
    </div>
  );
}
