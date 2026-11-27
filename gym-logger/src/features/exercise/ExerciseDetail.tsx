import { LiftLevel } from '../level/LiftLevel';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../../db/dexie';
import type { Exercise, ExerciseKind } from '../../db/types';
import { Card, Chip, EmptyState, IconButton, Page, PRBadge, SectionTitle } from '../../components/ui';
import { toggleFavorite, useSetting } from '../../lib/settings';
import { usePRMap } from '../../lib/prs';
import { dateShort, duration, num, toDisplay } from '../../lib/format';
import { PR_LABEL, estimate1RM } from '../../lib/calc';
import { formatSet } from '../../lib/kinds';
import { sessionsForExercise, type SessionPoint } from '../progress/data';
import { ExerciseNotes } from './ExerciseNotes';
import { OneRepMaxTable } from './OneRepMaxTable';
import { ExerciseGuide, ExerciseMeta } from './ExerciseGuide';
import { EditExerciseSheet } from './EditExerciseSheet';
import { exerciseName } from '../../lib/exerciseName';
import { t } from '../../i18n';

type Metric = keyof Pick<SessionPoint, 'heaviest' | 'e1rm' | 'volume' | 'maxReps' | 'totalReps' | 'distance'>;

/** Grafvalg per øvelsestype. `weightUnit` betyr at verdien er kg og skal vises i valgt enhet. */
const METRICS: Record<ExerciseKind, { key: Metric; label: string; suffix: 'weight' | 'reps' | 'sec' | 'min' | 'km' }[]> = {
  weight: [
    { key: 'e1rm', get label() { return t('Beregnet 1RM', 'Estimated 1RM'); }, suffix: 'weight' },
    { key: 'heaviest', get label() { return t('Tyngste set', 'Heaviest set'); }, suffix: 'weight' },
    { key: 'volume', get label() { return t('Volum', 'Volume'); }, suffix: 'weight' },
  ],
  bodyweight: [
    { key: 'maxReps', get label() { return t('Flest reps i ett set', 'Most reps in a set'); }, suffix: 'reps' },
    { key: 'totalReps', get label() { return t('Reps totalt', 'Total reps'); }, suffix: 'reps' },
  ],
  time: [
    { key: 'maxReps', get label() { return t('Lengste set', 'Longest set'); }, suffix: 'sec' },
    { key: 'totalReps', get label() { return t('Total tid', 'Total time'); }, suffix: 'sec' },
  ],
  cardio: [
    { key: 'distance', get label() { return t('Distanse', 'Distance'); }, suffix: 'km' },
    { key: 'totalReps', get label() { return t('Tid', 'Time'); }, suffix: 'min' },
  ],
};

export function ExerciseDetail() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const favorites = useSetting('favorites');
  const prMap = usePRMap();
  const [metricIdx, setMetricIdx] = useState(0);
  const [tab, setTab] = useState<'overview' | 'guide' | null>(null);
  const [editing, setEditing] = useState(false);
  const data = useLiveQuery(async () => {
    const exercise = await db.exercises.get(exerciseId);
    const sets = await db.sets.where('exercise_id').equals(exerciseId).toArray();
    const workouts = await db.workouts.bulkGet([...new Set(sets.map((s) => s.workout_id))]);
    const wMap = new Map(workouts.filter((w) => !!w).map((w) => [w!.id, w!]));
    return { exercise, sessions: sessionsForExercise(sets, wMap) };
  }, [exerciseId]);

  const kind: ExerciseKind = data?.exercise?.kind ?? 'weight';
  const metric = METRICS[kind][Math.min(metricIdx, METRICS[kind].length - 1)];
  const fmt = (v: number) =>
    metric.suffix === 'weight' ? `${num(toDisplay(v, unit))} ${unit}` : metric.suffix === 'sec' ? duration(v * 1000) : `${num(v, 1)} ${metric.suffix}`;
  const chart = useMemo(
    () =>
      (data?.sessions ?? []).map((p) => ({
        date: dateShort(p.date),
        value: metric.suffix === 'weight' ? Math.round(toDisplay(p[metric.key], unit) * 10) / 10 : p[metric.key],
      })),
    [data, metric, unit],
  );

  if (!data) return <Page title="" back>{null}</Page>;
  const { exercise, sessions } = data;
  if (!exercise) {
    return (
      <Page title={t('Øvelse', 'Exercise')} back>
        <EmptyState icon="dumbbell" title={t('Fant ikke øvelsen', 'Exercise not found')} />
      </Page>
    );
  }
  const shownTab = tab ?? (sessions.length ? 'overview' : 'guide');
  const fav = favorites.includes(exercise.id);

  return (
    <Page
      title={exerciseName(exercise)}
      back
      actions={
        <>
          <IconButton icon="star" filled={fav} className={fav ? 'text-warn' : ''} label={fav ? t('Fjern fra favoritter', 'Remove from favourites') : t('Legg til i favoritter', 'Add to favourites')} onClick={() => void toggleFavorite(exercise.id)} />
          {exercise.custom ? <IconButton icon="edit" label={t('Rediger øvelse', 'Edit exercise')} onClick={() => setEditing(true)} /> : null}
        </>
      }
    >
      <ExerciseMeta exercise={exercise} />
      <LiftLevel exerciseId={exercise.id} />

      <div className="mt-4 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-raised p-1" role="tablist">
        {(['overview', 'guide'] as const).map((tab_) => (
          <button
            key={tab_}
            type="button"
            role="tab"
            aria-selected={shownTab === tab_}
            onClick={() => setTab(tab_)}
            className={`min-h-10 rounded-xl text-sm font-semibold transition ${shownTab === tab_ ? 'bg-surface text-ink shadow' : 'text-muted'}`}
          >
            {tab_ === 'overview' ? t('Oversikt', 'Overview') : t('Slik gjør du', 'How to')}
          </button>
        ))}
      </div>

      {shownTab === 'guide' ? (
        <>
          <ExerciseGuide exercise={exercise} />
          <ExerciseNotes exerciseId={exerciseId} />
        </>
      ) : sessions.length === 0 ? (
        <EmptyState icon="chart" title={t('Ingen fullførte sets', 'No completed sets')} text={t('Logg øvelsen i en økt for å se rekorder og grafer.', 'Log the exercise in a workout to see records and charts.')} />
      ) : (
        <>
          <Records kind={kind} sessions={sessions} unit={unit} />

          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
            {METRICS[kind].map((m, i) => (
              <Chip key={m.key} active={metric.key === m.key} onClick={() => setMetricIdx(i)}>
                {m.label}
              </Chip>
            ))}
          </div>

          <Card className="mt-3 p-2 pt-4">
            {chart.length < 2 ? (
              <p className="p-6 text-center text-muted">{t('Grafen vises når du har logget øvelsen minst to ganger.', 'The chart appears once you have logged the exercise at least twice.')}</p>
            ) : (
              <div className="h-56" role="img" aria-label={`${t('Graf', 'Chart')}: ${metric.label} ${t('over tid', 'over time')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="#232a26" vertical={false} />
                    <XAxis dataKey="date" stroke="#66706a" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
                    <YAxis stroke="#66706a" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#161b18', border: '1px solid #232a26', borderRadius: 12, color: '#f2f5f3' }}
                      labelStyle={{ color: '#9ba59f' }}
                      formatter={(v) => [metric.suffix === 'weight' ? `${num(Number(v))} ${unit}` : fmt(Number(v)), metric.label]}
                    />
                    <Line type="monotone" dataKey="value" stroke="#2bd66b" strokeWidth={2.5} dot={{ r: 3, fill: '#2bd66b', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#7dffaa' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {kind === 'weight' && <OneRepMaxTable oneRm={Math.max(...sessions.map((s) => s.e1rm))} equipment={exercise.equipment} />}

          <SectionTitle>{t('Økter', 'Workouts')}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {[...sessions].reverse().map((p) => (
              <li key={p.workoutId}>
                <button type="button" className="w-full text-left" onClick={() => navigate(`/history/${p.workoutId}`)}>
                  <Card className="p-3">
                    <div className="mb-1 text-sm text-muted">{dateShort(p.date)}</div>
                    <div className="font-num flex flex-wrap items-center gap-x-3 gap-y-1">
                      {p.sets.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1">
                          <span className="font-semibold">{formatSet(s, kind, unit)}</span>
                          {prMap.get(s.id)?.map((k) => <PRBadge key={k} label={PR_LABEL[k]} />)}
                        </span>
                      ))}
                    </div>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && <EditExerciseSheet exercise={exercise} onClose={() => setEditing(false)} onDeleted={() => navigate(-1)} />}
    </Page>
  );
}

function Records({ kind, sessions, unit }: { kind: ExerciseKind; sessions: SessionPoint[]; unit: 'kg' | 'lbs' }) {
  const all = sessions.flatMap((s) => s.sets);
  const max = <K extends keyof SessionPoint>(k: K) => sessions.reduce((b, s) => ((s[k] as number) > (b[k] as number) ? s : b));
  let tiles: { label: string; value: string; sub: string }[];
  if (kind === 'weight') {
    const bestWeight = all.reduce((b, s) => (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b));
    const best1 = all.reduce((b, s) => (estimate1RM(s.weight, s.reps) > estimate1RM(b.weight, b.reps) ? s : b));
    const bestVol = max('volume');
    tiles = [
      { label: t('Tyngste', 'Heaviest'), value: num(toDisplay(bestWeight.weight, unit)), sub: `× ${bestWeight.reps}` },
      { label: t('Beste 1RM', 'Best 1RM'), value: num(toDisplay(estimate1RM(best1.weight, best1.reps), unit), 0), sub: `${num(toDisplay(best1.weight, unit))} × ${best1.reps}` },
      { label: t('Mest volum', 'Most volume'), value: num(toDisplay(bestVol.volume, unit), 0), sub: dateShort(bestVol.date) },
    ];
  } else if (kind === 'bodyweight') {
    const best = max('maxReps');
    const tot = max('totalReps');
    tiles = [
      { label: t('Flest reps', 'Most reps'), value: String(best.maxReps), sub: dateShort(best.date) },
      { label: t('Mest i én økt', 'Most in a workout'), value: String(tot.totalReps), sub: dateShort(tot.date) },
      { label: t('Økter', 'Workouts'), value: String(sessions.length), sub: t('totalt', 'total') },
    ];
  } else if (kind === 'time') {
    const best = max('maxReps');
    const tot = max('totalReps');
    tiles = [
      { label: t('Lengste', 'Longest'), value: duration(best.maxReps * 1000), sub: dateShort(best.date) },
      { label: t('Mest i én økt', 'Most in a workout'), value: duration(tot.totalReps * 1000), sub: dateShort(tot.date) },
      { label: t('Økter', 'Workouts'), value: String(sessions.length), sub: t('totalt', 'total') },
    ];
  } else {
    const far = max('distance');
    const long = max('totalReps');
    tiles = [
      { label: t('Lengst', 'Furthest'), value: `${num(far.distance, 1)}`, sub: 'km' },
      { label: t('Lengste økt', 'Longest workout'), value: String(long.totalReps), sub: 'min' },
      { label: t('Økter', 'Workouts'), value: String(sessions.length), sub: t('totalt', 'total') },
    ];
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        {tiles.map((t) => (
          <div key={t.label} className="card rounded-xl border-accent/30 py-2.5">
            <div className="text-xs text-muted">{t.label}</div>
            <div className="font-num text-2xl font-bold text-accent">{t.value}</div>
            <div className="text-xs text-faint">{t.sub}</div>
          </div>
        ))}
      </div>
      {kind === 'weight' && <p className="mt-1 text-center text-xs text-faint">{t('Alle vekter i', 'All weights in')} {unit}</p>}
    </>
  );
}

export type { Exercise };
