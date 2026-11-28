import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { useUser } from '../../auth/AuthProvider';
import { Button, Sheet } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { AdVideo } from '../../components/AdVideo';
import { setSocialMode, useSocialMode } from '../../lib/socialMode';
import { socialAvailable } from '../../social';
import { t } from '../../i18n';

// «Sosialt er her»: øverst på Hjem for alle som kan bruke Sosialt (konto på nett), både med trenings-
// og sosial konto. Bilde fra reklamefilmen med ▶ (filmen åpnes med lyd), og «Prøv Sosialt» / «Åpne Sosialt».
// Kan først lukkes (×) etter at filmen er åpnet. Bytt NEWS_ID ved en ny nyhet, så vises kortet igjen for alle.
const NEWS_ID = 'socials-released-1.3';
const KEY = `news-dismissed:${NEWS_ID}`;
const WATCHED = `news-watched:${NEWS_ID}`;

/** Filmen i et ark, med «Prøv Sosialt» under (brukes fra Hjem og fra kontotype-valget). */
export function SocialsVideoSheet({ open, onClose, onTry }: { open: boolean; onClose: () => void; onTry?: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t('Sosialt', 'Socials')} tall>
      {open && (
        <div className="flex flex-col items-center gap-4 pb-2">
          <AdVideo src="ad/socials.mp4" poster="ad/socials-poster.jpg" className="h-[62vh]" />
          {onTry && (
            <Button full onClick={onTry}>
              {t('Prøv Sosialt', 'Try Socials')}
            </Button>
          )}
          <p className="text-center text-xs text-faint">{t('Du kan bytte når som helst under Profil → Kontotype.', 'You can switch any time under Profile → Account type.')}</p>
        </div>
      )}
    </Sheet>
  );
}

export function NewsCard() {
  const user = useUser();
  const social = useSocialMode();
  const navigate = useNavigate();
  const seen = useLiveQuery(async () => ({ dismissed: !!(await db.kv.get(KEY)), watched: !!(await db.kv.get(WATCHED)) }), [], { dismissed: true, watched: false });
  const [video, setVideo] = useState(false);
  if (seen.dismissed || !socialAvailable(user)) return null;
  const close = () => void db.kv.put({ key: KEY, value: new Date().toISOString() });
  const watch = () => {
    setVideo(true);
    void db.kv.put({ key: WATCHED, value: new Date().toISOString() });
  };
  const tryIt = () => void (social ? Promise.resolve() : setSocialMode(user.id, true)).then(() => navigate('/social'));
  const base = import.meta.env.BASE_URL;

  return (
    <>
      <section aria-labelledby="socials-news" className="card relative overflow-hidden rounded-xl border-accent/40">
        <div className="flex gap-3.5 p-3.5">
          <button
            type="button"
            onClick={watch}
            aria-label={t('Se filmen om Sosialt', 'Watch the Socials video')}
            className="relative w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-raised"
            style={{ aspectRatio: '9 / 16' }}
          >
            <img src={`${base}ad/socials-poster.jpg`} alt="" className="block h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/25">
              <span className="grid size-11 place-items-center rounded-full bg-accent text-on-accent shadow-lg">
                <Icon name="play" size={20} />
              </span>
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent uppercase">{t('Nytt', 'New')}</span>
            </div>
            <h2 id="socials-news" className="mt-1.5 text-lg leading-tight font-bold">
              {t('Sosialt er her', 'Socials is here')}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t(
                'Følg venner, se hele øktene deres, klatre på ledertavler, utfordre hverandre og vinn merker. Kroppsvekten din deles aldri.',
                'Follow friends, see their full workouts, climb the leaderboards, challenge each other and win badges. Your bodyweight is never shared.',
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="min-h-10 px-4 text-sm" onClick={tryIt}>
                {social ? t('Åpne Sosialt', 'Open Socials') : t('Prøv Sosialt', 'Try Socials')}
              </Button>
              <Button variant="secondary" icon="play" className="min-h-10 px-3.5 text-sm" onClick={watch}>
                {t('Se filmen', 'Watch the video')}
              </Button>
            </div>
          </div>
        </div>
        {seen.watched && (
          <button type="button" aria-label={t('Skjul nyheten', 'Hide the news')} onClick={close} className="absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-full text-faint">
            <Icon name="x" size={16} />
          </button>
        )}
      </section>
      <SocialsVideoSheet open={video} onClose={() => setVideo(false)} onTry={social ? undefined : tryIt} />
    </>
  );
}
