import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { db } from '../../db/dexie';
import { getProfile } from '../../db/repo';
import { Icon, type IconName } from '../../components/Icon';
import { useWhatsNewOpen } from '../../components/whatsNew';
import { setSocialMode } from '../../lib/socialMode';
import { socialAvailable } from '../../social';
import { SocialsVideoSheet } from '../home/NewsCard';
import { t } from '../../i18n';

// Én gang per konto: velg «Trening» (appen som før) eller «Sosial». Bare for kontoer som kan bruke
// Sosialt, og først når «Nytt i denne versjonen» er lukket. Valget kan endres under Profil → Kontotype.
export const CHOSEN_KEY = 'account-type-chosen';

export function AccountTypePrompt() {
  const user = useUser();
  const navigate = useNavigate();
  const newsOpen = useWhatsNewOpen();
  const [video, setVideo] = useState(false);
  const state = useLiveQuery(async () => ({ chosen: !!(await db.kv.get(CHOSEN_KEY)), social: (await getProfile(user.id))?.social === 1 }), [user.id]);
  if (!state || state.chosen || state.social || newsOpen || !socialAvailable(user)) return null;

  const choose = async (social: boolean) => {
    await db.kv.put({ key: CHOSEN_KEY, value: { social, at: new Date().toISOString() } });
    await setSocialMode(user.id, social);
    setVideo(false);
    if (social) navigate('/social');
  };

  return (
    <>
      <div role="dialog" aria-modal="true" aria-labelledby="account-type-title" className="pt-safe pb-safe fixed inset-0 z-[80] flex animate-fade items-end justify-center bg-black/75 sm:items-center">
        <div className="w-full max-w-xl animate-sheet rounded-t-2xl border-t border-line bg-surface px-5 pt-6 pb-6 sm:rounded-2xl">
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent uppercase">{t('Nytt', 'New')}</span>
          <h2 id="account-type-title" className="mt-2 text-2xl font-bold">
            {t('Velg kontotype', 'Choose your account type')}
          </h2>
          <p className="mt-1 text-muted">
            {t('RepGrade har fått Sosialt. Hvordan vil du bruke appen?', 'RepGrade now has Socials. How do you want to use the app?')}
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <Choice
              icon="users"
              title={t('Sosial', 'Social')}
              text={t('Følg venner og se øktene deres, ledertavler, utfordringer og merker. Du bestemmer hvem som ser deg.', 'Follow friends and see their workouts, leaderboards, challenges and badges. You decide who sees you.')}
              recommended
              onClick={() => void choose(true)}
            />
            <Choice icon="dumbbell" title={t('Trening', 'Training')} text={t('Bare din egen trening. Appen er som før.', 'Just your own training. The app stays as it is.')} onClick={() => void choose(false)} />
          </div>
          <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-accent" onClick={() => setVideo(true)}>
            <Icon name="play" size={16} />
            {t('Se filmen om Sosialt', 'Watch the Socials video')}
          </button>
          <p className="mt-3 text-center text-xs text-faint">{t('Du kan bytte når som helst under Profil → Kontotype.', 'You can switch any time under Profile → Account type.')}</p>
        </div>
      </div>
      <SocialsVideoSheet open={video} onClose={() => setVideo(false)} onTry={() => void choose(true)} />
    </>
  );
}

function Choice({ icon, title, text, recommended, onClick }: { icon: IconName; title: string; text: string; recommended?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition active:scale-[0.99] ${recommended ? 'border-accent bg-accent-soft/40' : 'border-line bg-raised'}`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${recommended ? 'bg-accent text-on-accent' : 'bg-surface text-muted'}`}>
        <Icon name={icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-faint" />
    </button>
  );
}
