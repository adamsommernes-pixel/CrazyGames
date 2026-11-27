import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Logo } from '../../components/Logo';
import { t } from '../../i18n';

const features = (): { icon: IconName; title: string; text: string }[] => [
  { icon: 'dumbbell', title: t('Logg på sekunder', 'Log in seconds'), text: t('Forrige økt står ved siden av hvert set. Ett trykk, så er det logget.', 'Your last session sits next to every set. One tap and it is logged.') },
  { icon: 'timer', title: t('Hviletimer', 'Rest timer'), text: t('Starter av seg selv når du huker av et set.', 'Starts by itself when you tick off a set.') },
  { icon: 'trophy', title: t('Rekorder og fremgang', 'Records and progress'), text: t('Nye PR-er blir oppdaget automatisk. Grafer viser utviklingen.', 'New PRs are detected automatically. Charts show your progress.') },
];

/** Første side man ser, og siden man kommer til etter å ha logget ut. */
export function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-xl flex-col px-5">
      <header className="flex items-center gap-2 pt-6">
        <Logo size={36} anchor name={false} />
        <span className="font-num flex-1 text-lg font-bold tracking-tight">RepGrade</span>
        <LanguageToggle />
      </header>

      <section className="pt-10">
        <h1 className="text-[38px] leading-[1.05] font-bold tracking-tight">
          {t('Logg hvert løft.', 'Log every lift.')}
          <br />
          <span className="text-accent">{t('Se hver fremgang.', 'See every gain.')}</span>
        </h1>
        <p className="mt-4 max-w-sm text-lg text-muted">{t('Treningsdagboka for gymmen. Rask nok til å bruke mellom settene, og virker uten dekning.', 'The training log for the gym. Fast enough to use between sets, and it works without signal.')}</p>
      </section>

      <DemoCard />

      <ul className="mt-6 flex flex-col gap-4">
        {features().map((f, i) => (
          <li key={f.title} className="flex animate-rise gap-3" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-accent">
              <Icon name={f.icon} size={20} />
            </span>
            <span>
              <span className="block font-semibold">{f.title}</span>
              <span className="block text-sm text-muted">{f.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-2 pt-10 pb-6">
        <Button full className="min-h-14 text-lg" onClick={() => navigate('/signup')}>
          {t('Lag konto', 'Create account')}
        </Button>
        <Button full variant="secondary" className="min-h-14" onClick={() => navigate('/login')}>
          {t('Jeg har konto', 'I have an account')}
        </Button>
        <Link to="/privacy" className="mt-3 text-center text-sm text-faint underline">
          {t('Personvern', 'Privacy')}
        </Link>
      </div>
    </div>
  );
}

/** Liten levende demo: et set hukes av og blir en rekord. */
function DemoCard() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDone(true);
      return;
    }
    const id = setInterval(() => setDone((d) => !d), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="card mt-8 rounded-xl p-4" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-num text-lg font-bold text-accent">{t('Benkpress', 'Bench press')}</span>
        <span className="text-sm text-faint">{t('Forrige', 'Last')}: 80 × 8</span>
      </div>
      <div className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2">
        <span className="font-num text-center font-bold text-muted">3</span>
        <span className={`font-num rounded-xl py-2.5 text-center text-xl font-bold transition-colors ${done ? 'bg-accent-soft/60 text-accent-strong' : 'bg-raised'}`}>85 kg</span>
        <span className={`font-num rounded-xl py-2.5 text-center text-xl font-bold transition-colors ${done ? 'bg-accent-soft/60 text-accent-strong' : 'bg-raised'}`}>8</span>
        <span className={`grid h-11 place-items-center rounded-xl transition-colors ${done ? 'animate-pop bg-accent text-on-accent' : 'bg-raised text-faint'}`}>
          <Icon name="check" strokeWidth={3} />
        </span>
      </div>
      <div className={`mt-3 flex h-6 items-center gap-1.5 transition-opacity ${done ? 'opacity-100' : 'opacity-0'}`}>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
          <Icon name="trophy" size={13} /> {t('Ny rekord', 'New record')}: 85 kg
        </span>
      </div>
    </div>
  );
}
