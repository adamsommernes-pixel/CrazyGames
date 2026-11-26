import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'dumbbell', title: 'Logg på sekunder', text: 'Forrige økt står ved siden av hvert set. Ett trykk, så er det logget.' },
  { icon: 'timer', title: 'Hviletimer', text: 'Starter av seg selv når du huker av et set.' },
  { icon: 'trophy', title: 'Rekorder og fremgang', text: 'Nye PR-er blir oppdaget automatisk. Grafer viser utviklingen.' },
];

/** Første side man ser, og siden man kommer til etter å ha logget ut. */
export function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-xl flex-col px-5">
      <header className="flex items-center gap-2 pt-6">
        <span className="grid size-9 place-items-center rounded-xl bg-green text-black shadow-glow">
          <Icon name="dumbbell" size={20} strokeWidth={2.4} />
        </span>
        <span className="font-num text-lg font-bold tracking-tight">Gym Logger</span>
      </header>

      <section className="pt-10">
        <h1 className="font-num text-[44px] leading-[1.02] font-bold tracking-tight">
          Logg hvert løft.
          <br />
          <span className="text-green">Se hver fremgang.</span>
        </h1>
        <p className="mt-4 max-w-sm text-lg text-muted">Treningsdagboka for gymmen. Rask nok til å bruke mellom settene, og virker uten dekning.</p>
      </section>

      <DemoCard />

      <ul className="mt-6 flex flex-col gap-4">
        {FEATURES.map((f, i) => (
          <li key={f.title} className="flex animate-rise gap-3" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-green">
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
          Lag konto
        </Button>
        <Button full variant="secondary" className="min-h-14" onClick={() => navigate('/login')}>
          Jeg har konto
        </Button>
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
    <div className="card mt-8 rounded-3xl p-4" aria-hidden="true">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-num text-lg font-bold text-green">Benkpress</span>
        <span className="text-sm text-faint">Forrige: 80 × 8</span>
      </div>
      <div className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2">
        <span className="font-num text-center font-bold text-muted">3</span>
        <span className={`font-num rounded-xl py-2.5 text-center text-xl font-bold transition-colors ${done ? 'bg-green-dim/60 text-green-light' : 'bg-raised'}`}>85 kg</span>
        <span className={`font-num rounded-xl py-2.5 text-center text-xl font-bold transition-colors ${done ? 'bg-green-dim/60 text-green-light' : 'bg-raised'}`}>8</span>
        <span className={`grid h-11 place-items-center rounded-xl transition-colors ${done ? 'animate-pop bg-green text-black shadow-glow' : 'bg-raised text-faint'}`}>
          <Icon name="check" strokeWidth={3} />
        </span>
      </div>
      <div className={`mt-3 flex h-6 items-center gap-1.5 transition-opacity ${done ? 'opacity-100' : 'opacity-0'}`}>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-dim px-2.5 py-0.5 text-xs font-semibold text-green-light">
          <Icon name="trophy" size={13} /> Ny rekord: 85 kg
        </span>
      </div>
    </div>
  );
}
