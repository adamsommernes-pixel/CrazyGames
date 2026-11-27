import { Link } from 'react-router-dom';
import { Card, Page, SectionTitle } from '../../components/ui';
import { TierEmblem, tierAccent } from '../../components/TierBadge';
import { useStrength } from '../../lib/strengthLive';
import { ACTIVE_DAYS, CATEGORIES, type StrengthProfile, CATEGORY_LABEL, TIER_COUNT, tierAt, tierFor, type Category } from '../../lib/strength';
import { useExerciseMap } from '../workout/ExercisePicker';
import { exerciseName } from '../../lib/exerciseName';
import { setSetting, useSetting } from '../../lib/settings';
import { DumbbellCheck } from './DumbbellCheck';
import { num, toDisplay } from '../../lib/format';
import { t } from '../../i18n';

/** Styrkenivå: nåværende nivå, stigen, kategoriene og hvert rangert løft. */
export function LevelPage() {
  const data = useStrength();
  const exMap = useExerciseMap();
  const unit = useSetting('unit');
  if (!data) return <Page title={t('Styrkenivå', 'Strength level')} back>{null}</Page>;
  const { profile: s, bwKnown, sex, bw } = data;
  const next = s.tier.index < TIER_COUNT - 1 ? tierAt(s.tier.index + 1) : null;
  const accent = tierAccent(s.tier.index);
  const kg = (v: number) => `${num(toDisplay(v, unit), 1)} ${unit}`;

  return (
    <Page title={t('Styrkenivå', 'Strength level')} back>
      <div className="flex flex-col items-center pt-1 pb-2 text-center">
        <div className="relative grid place-items-center">
          <span className="relative">
            <TierEmblem index={s.tier.index} size={96} />
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-bold" style={{ color: accent }}>
          {s.tier.name}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t('Nivå', 'Level')} {s.tier.index + 1} / {TIER_COUNT} · <span className="font-num">{num(s.score, 1)}</span> {t('poeng', 'points')}
        </p>
        {next && (
          <div className="mt-4 w-full max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full" style={{ width: `${s.progress * 100}%`, background: accent }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {t(`${num(next.min - s.score, 1)} poeng til ${next.name}`, `${num(next.min - s.score, 1)} points to ${next.name}`)}
            </p>
          </div>
        )}
        <a href="#levels" onClick={(e) => { e.preventDefault(); document.getElementById('levels')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-3 text-xs font-medium text-accent">
          {t('Slik fungerer nivåene ↓', 'How the levels work ↓')}
        </a>
      </div>

      <div className="mt-4">
        <DumbbellCheck />
      </div>
      <LiftSections lifts={s.lifts} bw={bw} unit={unit} names={(id) => exerciseName(exMap.get(id))} />

      <SectionTitle>{t('Kategorier', 'Categories')}</SectionTitle>
      <Card className="flex flex-col gap-3 p-3.5">
        {CATEGORIES.map((c) => {
          const score = s.categories[c];
          const tier = tierFor(score);
          return (
            <div key={c}>
              <div className="flex items-baseline justify-between text-sm">
                <span>
                  <span className="font-semibold">{CATEGORY_LABEL[c]}</span>{' '}
                  <span className="text-xs text-faint">{CATEGORY_LIFTS[c]()}</span>
                </span>
                <span className="text-muted">
                  {s.missing.includes(c) ? t('Ikke logget', 'Not logged') : `${tier.name} · ${num(score, 0)}`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full" style={{ width: `${score}%`, background: tierAccent(tier.index) }} />
              </div>
            </div>
          );
        })}
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        {s.missing.length > 0 && (
          <Note>
            {t(
              `Tren ${s.missing.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(' og ')}-løft (se listen under) for å låse opp full rangering. En kategori uten løft de siste ${ACTIVE_DAYS} dagene teller som 0.`,
              `Train ${s.missing.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(' and ')} lifts (see the list below) to unlock your full rank. A category with no lift in the last ${ACTIVE_DAYS} days counts as 0.`,
            )}
          </Note>
        )}
        {!bwKnown && (
          <Note>
            {t('Legg inn kroppsvekt for presis rangering. Nå brukes', 'Add your bodyweight for an accurate rank. Using')} {kg(bw)}.{' '}
            <Link to="/bodyweight" className="font-semibold text-accent underline">
              {t('Logg kroppsvekt', 'Log bodyweight')}
            </Link>
          </Note>
        )}
        {sex === null && (
          <Note>
            {t('Standardene er et snitt av menn og kvinner fordi kjønn ikke er valgt.', 'The standards are an average of men and women because no sex is set.')}{' '}
            <Link to="/profile/edit" className="font-semibold text-accent underline">
              {t('Rediger profil', 'Edit profile')}
            </Link>
          </Note>
        )}
      </div>

      <div id="levels" className="scroll-mt-16" />
      <SectionTitle>{t('Nivåene', 'The levels')}</SectionTitle>
      <Card className="divide-y divide-line">
        {Array.from({ length: TIER_COUNT }, (_, i) => TIER_COUNT - 1 - i).map((i) => {
          const tier = tierAt(i);
          const current = i === s.tier.index;
          const reached = i <= s.tier.index;
          return (
            <div
              key={i}
              aria-current={current ? 'true' : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 ${current ? 'bg-accent-soft/30' : ''} ${reached ? '' : 'opacity-45'}`}
            >
              <TierEmblem index={i} size={32} />
              <span className="flex-1 font-semibold" style={current ? { color: tierAccent(i) } : undefined}>
                {tier.name}
              </span>
              <span className="font-num text-xs text-faint">{i === TIER_COUNT - 1 ? `${tier.min}+` : `${tier.min}–${tier.min + 9}`}</span>
              {current && <span className="text-xs font-semibold text-accent">{t('Du', 'You')}</span>}
            </div>
          );
        })}
      </Card>

      <SectionTitle>{t('Slik regnes det', 'How it works')}</SectionTitle>
      <Card className="flex flex-col gap-2 p-3.5 text-sm text-muted">
        <p>
          {t(
            'Vi tar ditt beste beregnede 1RM (fra sets med 1–10 reps) i nøkkelløft og deler på kroppsvekten. Det sammenlignes med vanlige styrkestandarder og gir 0–100 poeng per løft.',
            'We take your best estimated 1RM (from sets of 1–10 reps) in key lifts and divide it by your bodyweight. That is compared with common strength standards and gives 0–100 points per lift.',
          )}
        </p>
        <p>
          {t(
            'Nivået er snittet av det beste løftet i press, trekk og bein, så en balansert kropp kommer høyest. For pull-ups teller kroppsvekten med.',
            'Your level is the average of your best lift in push, pull and legs, so a balanced body ranks highest. For pull-ups your bodyweight counts too.',
          )}
        </p>
        <p>
          {t(
            `Disse løftene teller: se listen under Kategorier, og øvelsene er merket med «Nivå» i appen. Alt annet logges som vanlig, men gir ikke nivå. Et løft må være trent de siste ${ACTIVE_DAYS} dagene for å telle; ellers vises det grått. Olympia krever nær verdensklasse i alle tre kategoriene.`,
            `These lifts count: see the list under Categories; the exercises are marked “Level” in the app. Everything else is logged as usual but gives no level. A lift must be trained in the last ${ACTIVE_DAYS} days to count; otherwise it is shown in grey. Olympia needs close to world-class strength in all three categories.`,
          )}
        </p>
      </Card>
    </Page>
  );
}

/** Hvilke løft som teller i hver kategori. */
const CATEGORY_LIFTS: Record<Category, () => string> = {
  push: () => t('benk, skråbenk og smal benk (stang), benk og skråbenk med manualer, militærpress', 'bench, incline and close-grip bench (barbell), dumbbell bench and incline, overhead press'),
  pull: () => t('pull-ups, stangroing, nedtrekk, bicepscurl med manualer', 'pull-ups, barbell row, lat pulldown, dumbbell curl'),
  legs: () => t('knebøy, markløft, sumo- og trap bar-markløft, rumensk markløft, bulgarsk splittbøy, beinpress, hack squat, beinspark', 'squat, deadlift, sumo and trap bar deadlift, Romanian deadlift, Bulgarian split squat, leg press, hack squat, leg extension'),
};

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">{children}</p>;
}

type Lift = StrengthProfile['lifts'][number];

/** Et løft er «lagt bort» hvis brukeren har sagt det, og ikke har trent det etterpå. */
export const isRetired = (l: Lift, retired: Record<string, string>) => !!retired[l.exerciseId] && (!l.lastAt || l.lastAt <= retired[l.exerciseId]);

/** Løftene delt i seksjoner: hovedløft, maskinløft (maks Sterk), teller ikke nå, og trener ikke lenger. */
function LiftSections({ lifts, bw, unit, names }: { lifts: Lift[]; bw: number; unit: 'kg' | 'lbs'; names: (id: string) => string }) {
  const retired = useSetting('retiredLifts');
  const setRetired = (id: string, on: boolean) => {
    const next = { ...retired };
    if (on) next[id] = new Date().toISOString();
    else delete next[id];
    void setSetting('retiredLifts', next);
  };
  const live = lifts.filter((l) => !isRetired(l, retired));
  const main = live.filter((l) => !l.machine && l.active);
  const machines = live.filter((l) => l.machine);
  const inactive = live.filter((l) => !l.machine && !l.active);
  const gone = lifts.filter((l) => isRetired(l, retired));
  const row = (l: Lift, extra?: React.ReactNode) => <LiftRow key={l.exerciseId} l={l} bw={bw} unit={unit} name={names(l.exerciseId)} extra={extra} />;

  if (lifts.length === 0) {
    return (
      <>
        <SectionTitle>{t('Dine løft', 'Your lifts')}</SectionTitle>
        <Card className="p-3.5 text-sm text-muted">
          {t('Logg en av øvelsene merket «Nivå», f.eks. benkpress, knebøy, markløft, roing eller pull-ups, for å få et nivå.', 'Log one of the exercises marked “Level”, e.g. bench press, squat, deadlift, rows or pull-ups, to get a level.')}
        </Card>
      </>
    );
  }
  return (
    <>
      {main.length > 0 && (
        <>
          <SectionTitle>{t('Dine løft', 'Your lifts')}</SectionTitle>
          <Card className="divide-y divide-line" data-lift-levels>
            {main.map((l) => row(l))}
          </Card>
        </>
      )}

      {machines.length > 0 && (
        <>
          <SectionTitle>{t('Maskinløft · maks Sterk', 'Machine lifts · max Strong')}</SectionTitle>
          <p className="mb-2 text-xs text-muted" data-machine-note>
            {t(
              'Maskiner gir høyst nivået Sterk, fordi vekten på stabelen varierer mye fra gym til gym. Vil du høyere, teller hovedløftet fullt ut: knebøy for beinpress, hack squat og beinspark, og pull-ups for nedtrekk.',
              'Machines give at most the Strong level, because stack weights vary a lot between gyms. To go higher, the main lift counts in full: squat for leg press, hack squat and leg extension, and pull-ups for lat pulldown.',
            )}
          </p>
          <Card className="divide-y divide-line" data-machine-lifts>
            {machines.map((l) => row(l))}
          </Card>
        </>
      )}

      {inactive.length > 0 && (
        <>
          <SectionTitle>{t(`Teller ikke nå · ikke trent på ${ACTIVE_DAYS} dager`, `Not counting now · not trained in ${ACTIVE_DAYS} days`)}</SectionTitle>
          <Card className="divide-y divide-line" data-inactive-lifts>
            {inactive.map((l) =>
              row(
                l,
                <button type="button" className="mt-1.5 text-xs font-semibold text-accent" onClick={(e) => { e.preventDefault(); setRetired(l.exerciseId, true); }}>
                  {t('Jeg trener ikke dette lenger', 'I don’t train this anymore')}
                </button>,
              ),
            )}
          </Card>
        </>
      )}

      {gone.length > 0 && (
        <>
          <SectionTitle>{t('Trener ikke lenger', 'No longer training')}</SectionTitle>
          <p className="mb-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-ink" data-retired-note>
            {t(
              'Du får ikke påminnelser om disse, men nivået ditt påvirkes fortsatt: de teller ikke, så har du ingen andre løft i samme kategori, teller den kategorien som 0 og trekker nivået ned. Trener du løftet igjen, teller det med en gang.',
              'You will not get reminders about these, but your level is still affected: they do not count, so if you have no other lift in the same category, that category counts as 0 and pulls your level down. Train the lift again and it counts right away.',
            )}
          </p>
          <Card className="divide-y divide-line" data-retired-lifts>
            {gone.map((l) =>
              row(
                l,
                <button type="button" className="mt-1.5 text-xs font-semibold text-accent" onClick={(e) => { e.preventDefault(); setRetired(l.exerciseId, false); }}>
                  {t('Angre: jeg trener dette', 'Undo: I train this')}
                </button>,
              ),
            )}
          </Card>
        </>
      )}
    </>
  );
}

function LiftRow({ l, bw, unit, name, extra }: { l: Lift; bw: number; unit: 'kg' | 'lbs'; name: string; extra?: React.ReactNode }) {
  const kg = (v: number) => `${num(toDisplay(v, unit), 1)} ${unit}`;
  const nextT = l.tier.index < TIER_COUNT - 1 ? tierAt(l.tier.index + 1) : null;
  const shown = (v: number) => (l.bodyweightLoad ? `+${kg(Math.max(0, v - bw))}` : kg(v));
  const color = tierAccent(l.tier.index);
  const progress = l.capped ? 1 : nextT ? Math.max(0, Math.min(1, (l.score - l.tier.min) / 10)) : 1;
  return (
    <div className={l.active ? '' : 'opacity-50 grayscale'} data-lift-active={l.active ? '1' : '0'}>
      <Link to={`/exercise/${l.exerciseId}`} className="flex items-center gap-3 px-3.5 py-3 active:bg-raised">
        <TierEmblem index={l.tier.index} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{name}</span>
            <span className="shrink-0 text-sm font-semibold" style={{ color }}>
              {l.tier.name}
              {l.capped && <span className="ml-1 text-[10px] font-semibold text-faint">· {t('tak', 'cap')}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: color }} />
          </div>
          <div className="mt-1 text-xs text-muted">
            {!l.active
              ? t(`Sist trent for over ${ACTIVE_DAYS} dager siden, teller ikke nå. Tren det igjen, så teller det med en gang.`, `Last trained more than ${ACTIVE_DAYS} days ago, so it does not count now. Train it again and it counts right away.`)
              : l.capped
                ? t(`1RM ${shown(l.e1rm)}. Taket er nådd: maskiner gir høyst Sterk.`, `1RM ${shown(l.e1rm)}. Cap reached: machines give at most Strong.`)
                : nextT && l.nextTierKg
                  ? t(`1RM nå ${shown(l.e1rm)}. Klarer du ${shown(l.nextTierKg)}, blir du ${nextT.name}.`, `1RM now ${shown(l.e1rm)}. Lift ${shown(l.nextTierKg)} to reach ${nextT.name}.`)
                  : t(`1RM ${shown(l.e1rm)} · toppnivået`, `1RM ${shown(l.e1rm)} · top level`)}
          </div>
        </div>
      </Link>
      {extra && <div className="-mt-2 pb-2.5 pl-[4.25rem]">{extra}</div>}
    </div>
  );
}
