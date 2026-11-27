import { Link } from 'react-router-dom';
import { Card, Page, SectionTitle } from '../../components/ui';
import { TierEmblem, tierAccent } from '../../components/TierBadge';
import { useStrength } from '../../lib/strengthLive';
import { ACTIVE_DAYS, CATEGORIES, CATEGORY_LABEL, TIER_COUNT, tierAt, tierFor, type Category } from '../../lib/strength';
import { useExerciseMap } from '../workout/ExercisePicker';
import { exerciseName } from '../../lib/exerciseName';
import { useSetting } from '../../lib/settings';
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

      <SectionTitle>{t('Dine løft', 'Your lifts')}</SectionTitle>
      {s.lifts.length === 0 ? (
        <Card className="p-3.5 text-sm text-muted">
          {t('Logg benkpress, knebøy, markløft, roing eller pull-ups for å få et nivå.', 'Log bench press, squat, deadlift, rows or pull-ups to get a level.')}
        </Card>
      ) : (
        <Card className="divide-y divide-line" data-lift-levels>
          {s.lifts.map((l) => {
            const nextT = l.tier.index < TIER_COUNT - 1 ? tierAt(l.tier.index + 1) : null;
            const shown = (v: number) => (l.bodyweightLoad ? `+${kg(Math.max(0, v - bw))}` : kg(v));
            const color = tierAccent(l.tier.index);
            const progress = nextT ? Math.max(0, Math.min(1, (l.score - l.tier.min) / 10)) : 1;
            return (
              <Link
                key={l.exerciseId}
                to={`/exercise/${l.exerciseId}`}
                className={`flex items-center gap-3 px-3.5 py-3 active:bg-raised ${l.active ? '' : 'opacity-45 grayscale'}`}
                data-lift-active={l.active ? '1' : '0'}
              >
                <TierEmblem index={l.tier.index} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{exerciseName(exMap.get(l.exerciseId))}</span>
                    <span className="shrink-0 text-sm font-semibold" style={{ color }}>
                      {l.tier.name}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: color }} />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {!l.active
                      ? t(`Ikke trent siste ${ACTIVE_DAYS} dager, teller ikke nå. Tren det igjen, så teller det med en gang.`, `Not trained in the last ${ACTIVE_DAYS} days, so it does not count now. Train it again and it counts right away.`)
                      : nextT && l.nextTierKg
                        ? t(`1RM nå ${shown(l.e1rm)}. Klarer du ${shown(l.nextTierKg)}, blir du ${nextT.name}.`, `1RM now ${shown(l.e1rm)}. Lift ${shown(l.nextTierKg)} to reach ${nextT.name}.`)
                        : t(`1RM ${shown(l.e1rm)} · toppnivået`, `1RM ${shown(l.e1rm)} · top level`)}
                  </div>
                </div>
              </Link>
            );
          })}
        </Card>
      )}

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
            `Elleve løft teller: benkpress, skråbenk, smal benkpress og militærpress (press), pull-ups, stangroing og nedtrekk (trekk), knebøy, markløft, rumensk markløft og beinspark (bein). Alt annet logges som vanlig, men gir ikke nivå. Et løft må være trent de siste ${ACTIVE_DAYS} dagene for å telle; ellers vises det grått. Olympia krever nær verdensklasse i alle tre kategoriene.`,
            `Eleven lifts count: bench press, incline bench, close-grip bench and overhead press (push), pull-ups, barbell row and lat pulldown (pull), squat, deadlift, Romanian deadlift and leg extension (legs). Everything else is logged as usual but gives no level. A lift must be trained in the last ${ACTIVE_DAYS} days to count; otherwise it is shown in grey. Olympia needs close to world-class strength in all three categories.`,
          )}
        </p>
      </Card>
    </Page>
  );
}

/** Hvilke løft som teller i hver kategori. */
const CATEGORY_LIFTS: Record<Category, () => string> = {
  push: () => t('benk, skråbenk, smal benk, militærpress', 'bench, incline bench, close-grip bench, overhead press'),
  pull: () => t('pull-ups, stangroing, nedtrekk', 'pull-ups, barbell row, lat pulldown'),
  legs: () => t('knebøy, markløft, rumensk markløft, beinspark', 'squat, deadlift, Romanian deadlift, leg extension'),
};

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">{children}</p>;
}
