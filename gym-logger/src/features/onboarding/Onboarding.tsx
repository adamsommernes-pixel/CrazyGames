import { ColorPicker } from '../../components/ColorPicker';
import { applyAccent } from '../../lib/theme';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../auth/types';
import { db, now } from '../../db/dexie';
import { PROFILE_COLORS, PROGRAMS_SEEN_KEY, applyProgram, logBodyweight, saveProfile } from '../../db/repo';
import { importLegacy, legacyWorkoutCount } from '../../db/legacy';
import { recommendedProgramId } from '../../db/programs';
import { GOAL_INFO } from '../profile/choices';
import { ProgramList } from '../routines/ProgramList';
import { EXPERIENCE, EXPERIENCE_LABEL, GOALS, GOAL_LABEL, type Experience, type Goal, type Sex } from '../../db/types';
import { setSetting } from '../../lib/settings';
import { fromDisplay, parseNum } from '../../lib/format';
import { Button, Chip, IconButton, inputClass } from '../../components/ui';
import { Avatar, StepDots } from '../../components/widgets';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Icon, type IconName } from '../../components/Icon';
import { t } from '../../i18n';
import { SexPicker } from '../profile/SexPicker';
import { HealthConsent } from '../legal/HealthConsent';

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
  const [sex, setSex] = useState<Sex | null>(null);
  const [consent, setConsent] = useState(false);
  const [legacy, setLegacy] = useState(0);
  const [moveLegacy, setMoveLegacy] = useState(true);
  // Valgt program; null = følg anbefalingen til brukeren velger selv.
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void legacyWorkoutCount().then(setLegacy);
  }, []);

  const finish = async () => {
    setBusy(true);
    await setSetting('unit', unit);
    if (legacy > 0 && moveLegacy) await importLegacy(db);
    if (program !== 'none') await applyProgram(program, goal);
    else await db.kv.put({ key: PROGRAMS_SEEN_KEY, value: now() });
    const bw = parseNum(bodyweight);
    if (bw > 0) await logBodyweight(fromDisplay(bw, unit));
    await saveProfile(user.id, {
      name: name.trim() || user.name,
      color,
      goal,
      weekly_target: perWeek,
      experience,
      sex,
      health_consent_at: user.kind === 'cloud' && consent ? now() : null,
      bodyweight_kg: bw > 0 ? fromDisplay(bw, unit) : null,
      created_at: user.created_at,
      onboarded_at: now(),
    });
    navigate('/', { replace: true });
  };

  const program = picked ?? (goal === 'own' ? 'none' : recommendedProgramId(perWeek, experience, goal));
  const canNext = step !== 0 || name.trim().length > 0;

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-xl flex-col px-5">
      <div className="flex h-14 items-center justify-between">
        {step > 0 ? <IconButton icon="back" label={t('Forrige steg', 'Previous step')} className="-ml-2" onClick={() => setStep(step - 1)} /> : <span />}
        <StepDots step={step} total={STEPS + 1} />
        <span className="w-11" />
      </div>

      <div key={step} className="animate-rise flex flex-1 flex-col">
        {step === 0 && (
          <>
          <div className="mb-2 flex justify-end">
            <LanguageToggle size="md" />
          </div>
          <Step title={`${t('Hei', 'Hi')}${user.name ? `, ${user.name.split(' ')[0]}` : ''}!`} text={t('Hva vil du kalles, og hvilken farge vil du ha?', 'What should we call you, and which colour do you want?')}>
            <div className="flex items-center gap-4">
              <Avatar name={name || '?'} color={color} size={64} />
              <input id="ob-name" aria-label={t('Navn', 'Name')} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <h3 className="mt-8 mb-1 text-[15px] font-semibold">{t('Appfarge', 'App colour')}</h3>
            <p className="mb-3 text-sm text-muted">{t('Brukes på knapper og grafer. Du kan bytte når som helst under Profil.', 'Used for buttons and charts. You can change it any time under Profile.')}</p>
            <ColorPicker value={color} label={t('Appfarge', 'App colour')} onChange={(c) => { setColor(c); applyAccent(c); }} />
          </Step>
          </>
        )}

        {step === 1 && (
          <Step title={t('Hva er målet ditt?', 'What is your goal?')} text={t('Vi tilpasser sets, reps og hvile etter det.', 'We tailor sets, reps and rest to it.')}>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('Mål', 'Goal')}>
              {GOALS.map((g) => (
                <Choice key={g} selected={goal === g} onClick={() => setGoal(g)} icon={GOAL_INFO[g].icon} title={GOAL_LABEL[g]} text={GOAL_INFO[g].text} />
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title={t('Hvor ofte vil du trene?', 'How often do you want to train?')} text={t('Ukemålet ditt. Du kan endre det senere.', 'Your weekly goal. You can change it later.')}>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('Økter per uke', 'Workouts per week')}>
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={perWeek === n}
                  onClick={() => setPerWeek(n)}
                  className={`font-num flex aspect-square flex-col items-center justify-center rounded-2xl border text-2xl font-bold transition ${
                    perWeek === n ? 'border-accent bg-accent text-on-accent' : 'border-line bg-raised'
                  }`}
                >
                  {n}
                  <span className={`text-[10px] font-medium ${perWeek === n ? 'text-on-accent/70' : 'text-faint'}`}>{t('/uke', '/week')}</span>
                </button>
              ))}
            </div>
            <h3 className="mt-8 mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t('Erfaring', 'Experience')}</h3>
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
          <Step title={t('Litt om deg', 'A bit about you')} text={t('Brukes til grafer og styrkenivået ditt. Alt her er valgfritt.', 'Used for charts and your strength level. Everything here is optional.')}>
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t('Vektenhet', 'Weight unit')}</h3>
            <div className="flex gap-2">
              <Chip active={unit === 'kg'} onClick={() => setUnit('kg')}>
                {t('Kilo (kg)', 'Kilograms (kg)')}
              </Chip>
              <Chip active={unit === 'lbs'} onClick={() => setUnit('lbs')}>
                {t('Pund (lbs)', 'Pounds (lbs)')}
              </Chip>
            </div>
            <label className="mt-6 flex flex-col gap-1.5">
              <span className="text-sm text-muted">{t('Kroppsvekt', 'Bodyweight')} ({unit})</span>
              <input id="ob-bodyweight" className={inputClass} inputMode="decimal" placeholder={t('Valgfritt', 'Optional')} value={bodyweight} onChange={(e) => setBodyweight(e.target.value)} />
            </label>
            <SexPicker value={sex} onChange={setSex} />
            {user.kind === 'cloud' && <HealthConsent checked={consent} onChange={setConsent} />}
          </Step>
        )}

        {step === 4 && (
          <Step
            title={t('Velg program', 'Choose a program')}
            text={t(`Splitter som passer ${perWeek} økter i uka. Du kan bytte når som helst under Rutiner.`, `Splits that fit ${perWeek} workouts a week. You can switch any time under Routines.`)}
          >
            <ProgramList days={perWeek} experience={experience} goal={goal} selected={program} onSelect={setPicked} allowNone />
            <div className="mt-2 flex flex-col gap-2">
              {legacy > 0 && (
                <Toggle checked={moveLegacy} onChange={setMoveLegacy} title={t(`Flytt ${legacy} økt${legacy === 1 ? '' : 'er'} fra før`, `Move ${legacy} earlier workout${legacy === 1 ? '' : 's'}`)} text={t('Det finnes treningsdata på denne enheten fra før du hadde konto.', 'There is training data on this device from before you had an account.')} />
              )}
            </div>
          </Step>
        )}
      </div>

      <div className="py-6">
        {step < STEPS ? (
          <Button full className="min-h-14 text-lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
            {t('Fortsett', 'Continue')}
          </Button>
        ) : (
          <Button full className="min-h-14 text-lg" disabled={busy} onClick={() => void finish()}>
            {busy ? t('Gjør klar …', 'Getting ready …') : t('Start å trene', 'Start training')}
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
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${selected ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface'}`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${selected ? 'bg-accent text-on-accent' : 'bg-raised text-accent'}`}>
        <Icon name={icon} />
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <span className={`grid size-6 place-items-center rounded-full border-2 ${selected ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}>
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
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${checked ? 'border-accent/60 bg-accent-soft/30' : 'border-line bg-surface'}`}
    >
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 ${checked ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}>
        {checked && <Icon name="check" size={14} strokeWidth={3.5} />}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}
