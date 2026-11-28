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

// «Sosialt er her»: på Hjem for dem som kan bruke Sosialt (konto på nett) men fortsatt har treningskonto.
// Kan lukkes. Bytt NEWS_ID ved en ny nyhet, så vises kortet igjen for alle.
const NEWS_ID = 'socials-released-1.3';
const KEY = `news-dismissed:${NEWS_ID}`;

export function NewsCard() {
  const user = useUser();
  const social = useSocialMode();
  const navigate = useNavigate();
  const dismissed = useLiveQuery(async () => !!(await db.kv.get(KEY)), [], true);
  const [video, setVideo] = useState(false);
  if (dismissed || social || !socialAvailable(user)) return null;
  const close = () => void db.kv.put({ key: KEY, value: new Date().toISOString() });

  return (
    <>
      <section aria-labelledby="news-title">
        <h2 id="news-title" className="mb-2 px-1 text-[15px] font-semibold text-ink">
          {t('Nyheter', 'News')}
        </h2>
        <div className="card flex items-start gap-3 rounded-xl border-accent/30 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">
            <Icon name="users" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t('Sosialt er her', 'Socials is here')}</span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-strong">{t('Nytt', 'New')}</span>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {t(
                'Følg venner og se hele øktene deres, klatre på ledertavler, utfordre hverandre og vinn merker. Kroppsvekten din deles aldri.',
                'Follow friends and see their full workouts, climb the leaderboards, challenge each other and win badges. Your bodyweight is never shared.',
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="min-h-10 px-4 text-sm" onClick={() => void setSocialMode(user.id, true).then(() => navigate('/social'))}>
                {t('Prøv Sosialt', 'Try Socials')}
              </Button>
              <Button variant="secondary" icon="play" className="min-h-10 px-4 text-sm" onClick={() => setVideo(true)}>
                {t('Se filmen', 'Watch the video')}
              </Button>
            </div>
          </div>
          <button type="button" aria-label={t('Skjul nyheten', 'Hide the news')} onClick={close} className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-faint">
            <Icon name="x" size={16} />
          </button>
        </div>
      </section>

      <Sheet open={video} onClose={() => setVideo(false)} title={t('Sosialt', 'Socials')} tall>
        {video && (
          <div className="flex flex-col items-center gap-4 pb-2">
            <AdVideo src="ad/socials.mp4" poster="ad/socials-poster.jpg" className="h-[62vh]" />
            <Button full onClick={() => void setSocialMode(user.id, true).then(() => navigate('/social'))}>
              {t('Prøv Sosialt', 'Try Socials')}
            </Button>
            <p className="text-center text-xs text-faint">{t('Du kan bytte tilbake under Profil → Kontotype.', 'You can switch back under Profile → Account type.')}</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
