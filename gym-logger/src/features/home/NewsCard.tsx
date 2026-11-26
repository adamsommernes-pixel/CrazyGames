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
      <section aria-labelledby="news-title" className="relative overflow-hidden rounded-3xl border border-green/40 bg-gradient-to-br from-green-dim/60 via-surface to-surface p-5">
        <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-green/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green px-2.5 py-1 text-[11px] font-bold tracking-wider text-black uppercase">
            <Icon name="sparkle" size={13} /> {t('Kommer snart', 'Coming soon')}
          </span>
          <button type="button" aria-label={t('Skjul nyheten', 'Hide the news')} onClick={close} className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-muted">
            <Icon name="x" size={18} />
          </button>
        </div>
        <h2 id="news-title" className="font-num relative mt-3 text-2xl font-bold">
          {t('Vi har nyheter!', 'We have news!')}
        </h2>
        <p className="relative mt-1 text-sm text-muted">
          {t('Neste store oppdatering gjør Repgrade sosialt: venner, utfordringer og eventer.', 'The next big update makes Repgrade social: friends, challenges and events.')}
        </p>
        <ul className="relative mt-4 flex flex-col gap-2.5">
          {features().map((f) => (
            <li key={f.title} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-raised text-green">
                <Icon name={f.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{f.title}</span>
                <span className="block text-xs text-muted">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <Button full variant="secondary" className="relative mt-4" onClick={() => setOpen(true)}>
          {t('Les mer', 'Read more')}
        </Button>
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
