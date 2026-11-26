import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../auth/types';
import { db, now } from '../../db/dexie';
import { PROFILE_COLORS, createStarterRoutines, logBodyweight, saveProfile } from '../../db/repo';
import { importLegacy, legacyWorkoutCount } from '../../db/legacy';
import { pickTemplate, TEMPLATES } from '../../db/templates';
import { EXPERIENCE, EXPERIENCE_LABEL, GOALS, GOAL_LABEL, type Experience, type Goal } from '../../db/types';
import { setSetting } from '../../lib/settings';
import { fromDisplay, parseNum } from '../../lib/format';
import { Button, Chip, IconButton, inputClass } from '../../components/ui';
import { Avatar, StepDots } from '../../components/widgets';
import { Icon, type IconName } from '../../components/Icon';

const GOAL_INFO: Record<Goal, { icon: IconName; text: string }> = {
  strength: { icon: 'dumbbell', text: 'Tunge løft, få reps, lang hvile.' },
  hypertrophy: { icon: 'flame', text: 'Moderat vekt, 8–12 reps.' },
  general: { icon: 'target', text: 'Allsidig trening og god form.' },
  endurance: { icon: 'timer', text: 'Flere reps, kortere hvile.' },
};

const STEPS = 4;

/** Kort oppstart etter registrering: navn, mål, frekvens og enhet. Ender med ferdige rutiner. */
export function Onboarding({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [goal, setGoal] = useState<Goal>('hypertrophy');
  const [perWeek, setPerWeek] = useState(3);
  const [experience, setExperience] = useState<Experience>('beginner');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [bodyweight, setBodyweight] = useState('');
  const [legacy, setLegacy] = useState(0);
  const [moveLegacy, setMoveLegacy] = useState(true);
  const [starter, setStarter] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void legacyWorkoutCount().then(setLegacy);
  }, []);

  const finish = async () => {
    setBusy(true);
    await setSetting('unit', unit);
    if (legacy > 0 && moveLegacy) await importLegacy(db);
    if (starter) await createStarterRoutines(goal, perWeek);
    const bw = parseNum(bodyweight);
    if (bw > 0) await logBodyweight(fromDisplay(bw, unit));
    await saveProfile(user.id, {
      name: name.trim() || user.name,
      color,
      goal,
      weekly_target: perWeek,
      experience,
      bodyweight_kg: bw > 0 ? fromDisplay(bw, unit) : null,
      created_at: user.created_at,
      onboarded_at: now(),
    });
    navigate('/', { replace: true });
  };

  const template = TEMPLATES[pickTemplate(perWeek)];
  const canNext = step !== 0 || name.trim().length > 0;

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-xl flex-col px-5">
      <div className="flex h-14 items-center justify-between">
        {step > 0 ? <IconButton icon="back" label="Forrige steg" className="-ml-2" onClick={() => setStep(step - 1)} /> : <span />}
        <StepDots step={step} total={STEPS + 1} />
        <span className="w-11" />
      </div>

      <div key={step} className="animate-rise flex flex-1 flex-col">
        {step === 0 && (
          <Step title={`Hei${user.name ? `, ${user.name.split(' ')[0]}` : ''}!`} text="Hva vil du kalles, og hvilken farge vil du ha?">
            <div className="flex items-center gap-4">
              <Avatar name={name || '?'} color={color} size={64} />
              <input id="ob-name" aria-label="Navn" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mt-5 flex gap-3" role="radiogroup" aria-label="Profilfarge">
              {PROFILE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={c === color}
                  aria-label={`Farge ${c}`}
                  className={`size-10 rounded-full transition ${c === color ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title="Hva er målet ditt?" text="Vi tilpasser sets, reps og hvile etter det.">
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Mål">
              {GOALS.map((g) => (
                <Choice key={g} selected={goal === g} onClick={() => setGoal(g)} icon={GOAL_INFO[g].icon} title={GOAL_LABEL[g]} text={GOAL_INFO[g].text} />
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="Hvor ofte vil du trene?" text="Ukemålet ditt. Du kan endre det senere.">
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Økter per uke">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={perWeek === n}
                  onClick={() => setPerWeek(n)}
                  className={`font-num flex aspect-square flex-col items-center justify-center rounded-2xl border text-2xl font-bold transition ${
                    perWeek === n ? 'border-green bg-green text-black shadow-glow' : 'border-line bg-raised'
                  }`}
                >
                  {n}
                  <span className={`text-[10px] font-medium ${perWeek === n ? 'text-black/70' : 'text-faint'}`}>/uke</span>
                </button>
              ))}
            </div>
            <h3 className="mt-8 mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Erfaring</h3>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE.map((e) => (
                <Chip key={e} active={experience === e} onClick={() => setExperience(e)}>
                  {EXPERIENCE_LABEL[e]}
                </Chip>
              ))}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Litt om deg" text="Brukes til grafer og kroppsvekt-loggen. Kroppsvekt er valgfritt.">
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Vektenhet</h3>
            <div className="flex gap-2">
              <Chip active={unit === 'kg'} onClick={() => setUnit('kg')}>
                Kilo (kg)
              </Chip>
              <Chip active={unit === 'lbs'} onClick={() => setUnit('lbs')}>
                Pund (lbs)
              </Chip>
            </div>
            <label className="mt-6 flex flex-col gap-1.5">
              <span className="text-sm text-muted">Kroppsvekt ({unit})</span>
              <input id="ob-bodyweight" className={inputClass} inputMode="decimal" placeholder="Valgfritt" value={bodyweight} onChange={(e) => setBodyweight(e.target.value)} />
            </label>
          </Step>
        )}

        {step === 4 && (
          <Step title="Klart!" text="Dette får du å starte med:">
            <div className="flex flex-col gap-2">
              <Toggle checked={starter} onChange={setStarter} title={`Startrutiner: ${template.map((t) => t.name).join(', ')}`} text={`Laget for ${perWeek} økter i uka og målet «${GOAL_LABEL[goal].toLowerCase()}».`} />
              {legacy > 0 && (
                <Toggle checked={moveLegacy} onChange={setMoveLegacy} title={`Flytt ${legacy} økt${legacy === 1 ? '' : 'er'} fra før`} text="Det finnes treningsdata på denne enheten fra før du hadde konto." />
              )}
            </div>
          </Step>
        )}
      </div>

      <div className="py-6">
        {step < STEPS ? (
          <Button full className="min-h-14 text-lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Fortsett
          </Button>
        ) : (
          <Button full className="min-h-14 text-lg" disabled={busy} onClick={() => void finish()}>
            {busy ? 'Gjør klar …' : 'Start å trene'}
          </Button>
        )}
      </div>
    </div>
  );
}

function Step({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="pt-6">
      <h1 className="font-num text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 mb-8 text-muted">{text}</p>
      {children}
    </section>
  );
}

function Choice({ selected, onClick, icon, title, text }: { selected: boolean; onClick: () => void; icon: IconName; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${selected ? 'border-green bg-green-dim/40' : 'border-line bg-surface'}`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${selected ? 'bg-green text-black' : 'bg-raised text-green'}`}>
        <Icon name={icon} />
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <span className={`grid size-6 place-items-center rounded-full border-2 ${selected ? 'border-green bg-green text-black' : 'border-line'}`}>
        {selected && <Icon name="check" size={14} strokeWidth={3.5} />}
      </span>
    </button>
  );
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${checked ? 'border-green/60 bg-green-dim/30' : 'border-line bg-surface'}`}
    >
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 ${checked ? 'border-green bg-green text-black' : 'border-line'}`}>
        {checked && <Icon name="check" size={14} strokeWidth={3.5} />}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}
