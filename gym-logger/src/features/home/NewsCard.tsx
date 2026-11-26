import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { Button, Sheet } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { t } from '../../i18n';

// «Vi har nyheter»: forteller hva som kommer i neste store oppdatering. Kan lukkes.
// Bytt NEWS_ID når det kommer en ny nyhet, så vises kortet igjen for alle.
const NEWS_ID = 'social-events-2026';
const KEY = `news-dismissed:${NEWS_ID}`;

const features = (): { icon: IconName; title: string; text: string; points: string[] }[] => [
  {
    icon: 'user',
    title: t('Sosial-fane med venner', 'Social tab with friends'),
    text: t('Følg vennene dine og se øktene deres når de trener.', 'Follow your friends and see their workouts as they train.'),
    points: [
      t('Se vennenes økter, rekorder og nye nivåer', "See your friends' workouts, records and new levels"),
      t('Lik og kommenter økter', 'Like and comment on workouts'),
      t('Heia hverandre fram', 'Cheer each other on'),
    ],
  },
  {
    icon: 'trophy',
    title: t('Utfordringer med venner', 'Challenges with friends'),
    text: t('Inviter venner til å konkurrere i styrke.', 'Invite friends to compete in strength.'),
    points: [
      t('Hvem løfter tyngst i benk, knebøy eller markløft?', 'Who lifts the most in bench, squat or deadlift?'),
      t('Konkurrer på volum, antall økter eller styrkenivå', 'Compete on volume, number of workouts or strength level'),
      t('Toppliste som oppdateres mens dere trener', 'A leaderboard that updates as you train'),
    ],
  },
  {
    icon: 'calendar',
    title: t('Åpne eventer', 'Public events'),
    text: t('Bli med på konkurranser for alle som bruker Repgrade.', 'Join competitions open to everyone using Repgrade.'),
    points: [
      t('F.eks. «Løft mest i desember»', 'For example “Lift the most in December”'),
      t('Se hvor du ligger på topplisten', 'See where you rank on the leaderboard'),
      t('Merker for deg som fullfører', 'Badges for those who finish'),
    ],
  },
];

export function NewsCard() {
  const dismissed = useLiveQuery(async () => !!(await db.kv.get(KEY)), [], true);
  const [open, setOpen] = useState(false);
  if (dismissed) return null;
  const close = () => void db.kv.put({ key: KEY, value: new Date().toISOString() });

  return (
    <>
      <section aria-labelledby="news-title">
        <h2 id="news-title" className="mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">
          {t('Nyheter og eventer', 'News and events')}
        </h2>
        <div className="card flex items-start gap-3 rounded-3xl p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-dim/50 text-green">
            <Icon name="sparkle" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t('Vi har nyheter!', 'We have news!')}</span>
              <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold tracking-wide text-green uppercase">{t('Kommer snart', 'Coming soon')}</span>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {t('Venner, utfordringer og åpne eventer er på vei til Repgrade.', 'Friends, challenges and public events are coming to Repgrade.')}
            </p>
            <button type="button" className="mt-2 text-sm font-semibold text-green" onClick={() => setOpen(true)}>
              {t('Les mer', 'Read more')}
            </button>
          </div>
          <button type="button" aria-label={t('Skjul nyheten', 'Hide the news')} onClick={close} className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-faint">
            <Icon name="x" size={16} />
          </button>
        </div>
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('Dette kommer', "What's coming")}>
        <div className="flex flex-col gap-4 pb-2">
          {features().map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-raised p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-green text-black">
                  <Icon name={f.icon} size={20} />
                </span>
                <h3 className="font-semibold">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted">{f.text}</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {f.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Icon name="check" size={16} className="mt-0.5 shrink-0 text-green" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-center text-xs text-faint">{t('Vi sier fra her i appen når det er klart.', "We'll let you know here in the app when it's ready.")}</p>
          <Button full onClick={() => setOpen(false)}>
            {t('Gleder meg!', "Can't wait!")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
