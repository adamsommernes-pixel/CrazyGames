import { Link } from 'react-router-dom';
import { Card, Page, SectionTitle } from '../../components/ui';
import { TierEmblem, tierAccent } from '../../components/TierBadge';
import { useStrength } from '../../lib/strengthLive';
import { CATEGORIES, CATEGORY_LABEL, TIER_COUNT, tierAt, tierFor } from '../../lib/strength';
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
      <div className="flex flex-col items-center pt-2 pb-6 text-center">
        <div className="relative grid place-items-center">
          <div className="level-pulse absolute size-36 rounded-full blur-2xl" style={{ background: accent, opacity: 0.35 }} aria-hidden="true" />
          <span className="level-glow relative" style={{ ['--glow' as string]: accent }}>
            <TierEmblem index={s.tier.index} size={128} />
          </span>
        </div>
        <h2 className="font-num mt-4 text-4xl font-bold" style={{ color: accent }}>
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
      </div>

      <div className="flex flex-col gap-2">
        {s.missing.length > 0 && (
          <Note>
            {t(
              `Logg ${s.missing.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(' og ')}-øvelser for å låse opp full rangering. Hver kategori som mangler teller som 0.`,
              `Log ${s.missing.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(' and ')} exercises to unlock your full rank. Each missing category counts as 0.`,
            )}
          </Note>
        )}
        {!bwKnown && (
          <Note>
            {t('Legg inn kroppsvekt for presis rangering. Nå brukes', 'Add your bodyweight for an accurate rank. Using')} {kg(bw)}.{' '}
            <Link to="/bodyweight" className="font-semibold text-green underline">
              {t('Logg kroppsvekt', 'Log bodyweight')}
            </Link>
          </Note>
        )}
        {sex === null && (
          <Note>
            {t('Standardene er et snitt av menn og kvinner fordi kjønn ikke er valgt.', 'The standards are an average of men and women because no sex is set.')}{' '}
            <Link to="/profile/edit" className="font-semibold text-green underline">
              {t('Rediger profil', 'Edit profile')}
            </Link>
          </Note>
        )}
      </div>

      <SectionTitle>{t('Kategorier', 'Categories')}</SectionTitle>
      <Card className="flex flex-col gap-3 p-4">
        {CATEGORIES.map((c) => {
          const score = s.categories[c];
          const tier = tierFor(score);
          return (
            <div key={c}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{CATEGORY_LABEL[c]}</span>
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

      <SectionTitle>{t('Dine løft', 'Your lifts')}</SectionTitle>
      {s.lifts.length === 0 ? (
        <Card className="p-4 text-sm text-muted">
          {t('Logg benkpress, knebøy, markløft, roing eller pull-ups for å få et nivå.', 'Log bench press, squat, deadlift, rows or pull-ups to get a level.')}
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {s.lifts.map((l) => {
            const nextT = l.tier.index < TIER_COUNT - 1 ? tierAt(l.tier.index + 1) : null;
            const shown = (v: number) => (l.bodyweightLoad ? `+${kg(Math.max(0, v - bw))}` : kg(v));
            return (
              <Link key={l.exerciseId} to={`/exercise/${l.exerciseId}`} className="flex items-center gap-3 px-4 py-3">
                <TierEmblem index={l.tier.index} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{exerciseName(exMap.get(l.exerciseId))}</div>
                  <div className="text-xs text-muted">
                    <span style={{ color: tierAccent(l.tier.index) }}>{l.tier.name}</span> · 1RM ≈ {shown(l.e1rm)}
                  </div>
                </div>
                {nextT && l.nextTierKg && (
                  <div className="text-right text-xs text-muted">
                    <div className="font-num font-semibold text-ink">{shown(l.nextTierKg)}</div>
                    {t('til', 'for')} {nextT.name}
                  </div>
                )}
              </Link>
            );
          })}
        </Card>
      )}

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
              className={`flex items-center gap-3 px-4 py-2.5 ${current ? 'bg-green-dim/30' : ''} ${reached ? '' : 'opacity-45'}`}
            >
              <TierEmblem index={i} size={32} />
              <span className="flex-1 font-semibold" style={current ? { color: tierAccent(i) } : undefined}>
                {tier.name}
              </span>
              <span className="font-num text-xs text-faint">{i === TIER_COUNT - 1 ? `${tier.min}+` : `${tier.min}–${tier.min + 9}`}</span>
              {current && <span className="text-xs font-semibold text-green">{t('Du', 'You')}</span>}
            </div>
          );
        })}
      </Card>

      <SectionTitle>{t('Slik regnes det', 'How it works')}</SectionTitle>
      <Card className="flex flex-col gap-2 p-4 text-sm text-muted">
        <p>
          {t(
            'Vi tar ditt beste beregnede 1RM (fra sets med 1–12 reps) i nøkkelløft og deler på kroppsvekten. Det sammenlignes med vanlige styrkestandarder og gir 0–100 poeng per løft.',
            'We take your best estimated 1RM (from sets of 1–12 reps) in key lifts and divide it by your bodyweight. That is compared with common strength standards and gives 0–100 points per lift.',
          )}
        </p>
        <p>
          {t(
            'Nivået er snittet av det beste løftet i press, trekk og bein, så en balansert kropp kommer høyest. For pull-ups og dips teller kroppsvekten med.',
            'Your level is the average of your best lift in push, pull and legs, so a balanced body ranks highest. For pull-ups and dips your bodyweight counts too.',
          )}
        </p>
      </Card>
    </Page>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-muted">{children}</p>;
}
