import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../../db/dexie';
import { Card, Chip, EmptyState, Page, PRBadge, SectionTitle } from '../../components/ui';
import { useSetting } from '../../lib/settings';
import { usePRMap } from '../../lib/prs';
import { dateShort, num, toDisplay } from '../../lib/format';
import { PR_LABEL, estimate1RM } from '../../lib/calc';
import { sessionsForExercise } from './data';

type Metric = 'heaviest' | 'e1rm' | 'volume';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'heaviest', label: 'Tyngste set' },
  { key: 'e1rm', label: 'Beregnet 1RM' },
  { key: 'volume', label: 'Volum' },
];

export function ExerciseProgress() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const prMap = usePRMap();
  const [metric, setMetric] = useState<Metric>('e1rm');
  const data = useLiveQuery(async () => {
    const exercise = await db.exercises.get(exerciseId);
    const sets = await db.sets.where('exercise_id').equals(exerciseId).toArray();
    const workouts = await db.workouts.bulkGet([...new Set(sets.map((s) => s.workout_id))]);
    const wMap = new Map(workouts.filter((w) => !!w).map((w) => [w!.id, w!]));
    return { exercise, sessions: sessionsForExercise(sets, wMap) };
  }, [exerciseId]);

  const chart = useMemo(
    () =>
      (data?.sessions ?? []).map((p) => ({
        date: dateShort(p.date),
        value: Math.round(toDisplay(p[metric], unit) * 10) / 10,
      })),
    [data, metric, unit],
  );

  if (!data) return <Page title="" back>{null}</Page>;
  const { exercise, sessions } = data;
  const title = exercise?.name ?? 'Øvelse';

  if (sessions.length === 0) {
    return (
      <Page title={title} back>
        <EmptyState icon="chart" title="Ingen fullførte sets" text="Logg øvelsen i en økt for å se fremgang." />
      </Page>
    );
  }

  const allSets = sessions.flatMap((s) => s.sets);
  const bestWeight = allSets.reduce((b, s) => (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b));
  const best1 = allSets.reduce((b, s) => (estimate1RM(s.weight, s.reps) > estimate1RM(b.weight, b.reps) ? s : b));
  const bestVol = sessions.reduce((b, s) => (s.volume > b.volume ? s : b));

  return (
    <Page title={title} back>
      <div className="grid grid-cols-3 gap-2 text-center tabular">
        <Record label="Tyngste" value={`${num(toDisplay(bestWeight.weight, unit))}`} sub={`× ${bestWeight.reps}`} />
        <Record label="Beste 1RM" value={num(toDisplay(estimate1RM(best1.weight, best1.reps), unit), 0)} sub={`${num(toDisplay(best1.weight, unit))} × ${best1.reps}`} />
        <Record label="Mest volum" value={num(toDisplay(bestVol.volume, unit), 0)} sub={dateShort(bestVol.date)} />
      </div>
      <p className="mt-1 text-center text-xs text-faint">Alle vekter i {unit}</p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
        {METRICS.map((m) => (
          <Chip key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>
            {m.label}
          </Chip>
        ))}
      </div>

      <Card className="mt-3 p-2 pt-4">
        {chart.length < 2 ? (
          <p className="p-6 text-center text-muted">Grafen vises når du har logget øvelsen minst to ganger.</p>
        ) : (
          <div className="h-56" role="img" aria-label={`Graf: ${METRICS.find((m) => m.key === metric)!.label} over tid`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="date" stroke="#6b6b6b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis stroke="#6b6b6b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, color: '#f5f5f5' }}
                  labelStyle={{ color: '#a3a3a3' }}
                  formatter={(v) => [`${num(Number(v))} ${unit}`, METRICS.find((m) => m.key === metric)!.label]}
                />
                <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#4ade80' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <SectionTitle>Økter</SectionTitle>
      <ul className="flex flex-col gap-2">
        {[...sessions].reverse().map((p) => (
          <li key={p.workoutId}>
            <button type="button" className="w-full text-left" onClick={() => navigate(`/history/${p.workoutId}`)}>
              <Card className="p-3">
                <div className="mb-1 text-sm text-muted">{dateShort(p.date)}</div>
                <div className="tabular flex flex-wrap items-center gap-x-3 gap-y-1">
                  {p.sets.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1">
                      <span className="font-semibold">
                        {num(toDisplay(s.weight, unit))}×{s.reps}
                      </span>
                      {prMap.get(s.id)?.map((k) => <PRBadge key={k} label={PR_LABEL[k]} />)}
                    </span>
                  ))}
                </div>
              </Card>
            </button>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function Record({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-green/30 bg-surface py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-bold text-green">{value}</div>
      <div className="text-xs text-faint">{sub}</div>
    </div>
  );
}
