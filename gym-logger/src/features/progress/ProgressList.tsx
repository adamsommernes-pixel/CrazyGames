import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { Card, Chip, EmptyState, Page, SectionTitle } from '../../components/ui';
import { BarTrend } from '../../components/charts';
import { Icon } from '../../components/Icon';
import { useExerciseMap } from '../workout/ExercisePicker';
import { useSetting } from '../../lib/settings';
import { best1RM, countsAsWork } from '../../lib/calc';
import { muscleSplit, weeklySeries } from '../../lib/stats';
import { dateShort, duration, num, plural, toDisplay } from '../../lib/format';
import { kindOf } from '../../lib/kinds';
import { MUSCLE_COLOR } from '../../lib/muscles';
import { MuscleDot } from '../../components/MuscleTag';
import { MUSCLE_LABEL, type ExerciseKind, type WorkoutSet } from '../../db/types';
import { exerciseName } from '../../lib/exerciseName';
import { t } from '../../i18n';

type View = 'volume' | 'workouts';

/** Nøkkeltallet som vises per øvelse i lista, tilpasset øvelsestypen. */
function bestFor(kind: ExerciseKind, list: WorkoutSet[], unit: 'kg' | 'lbs') {
  const maxReps = Math.max(...list.map((s) => s.reps));
  switch (kind) {
    case 'bodyweight':
      return { value: String(maxReps), label: t('flest reps', 'most reps') };
    case 'time':
      return { value: duration(maxReps * 1000), label: t('lengste', 'longest') };
    case 'cardio':
      return { value: num(Math.max(...list.map((s) => s.distance_km ?? 0)), 1), label: t('lengst km', 'longest km') };
    default:
      return { value: num(toDisplay(best1RM(list), unit), 0), label: `1RM ${unit}` };
  }
}

export function ProgressList() {
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const [group, setGroup] = useState<string | null>(null);
  const [view, setView] = useState<View>('volume');
  const data = useLiveQuery(async () => {
    const sets = (await db.sets.toArray()).filter((s) => !s.deleted && countsAsWork(s));
    const workouts = await db.workouts.toArray();
    const bw = (await db.bodyweights.toArray()).filter((b) => !b.deleted).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return { sets, workouts, bw };
  }, []);
  const sets = data?.sets ?? [];

  const series = useMemo(() => (data ? weeklySeries(data.workouts, data.sets, 12) : []), [data]);
  const split = useMemo(() => muscleSplit(sets, exMap, 30), [sets, exMap]);
  const splitMax = split[0]?.[1] ?? 1;

  const rows = useMemo(() => {
    const by = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      const l = by.get(s.exercise_id) ?? [];
      l.push(s);
      by.set(s.exercise_id, l);
    }
    return [...by.entries()]
      .map(([id, list]) => ({
        id,
        exercise: exMap.get(id),
        last: list.reduce((m, s) => (s.completed_at! > m ? s.completed_at! : m), ''),
        sessions: new Set(list.map((s) => s.workout_id)).size,
        best: bestFor(kindOf(id), list, unit),
      }))
      .filter((r) => r.exercise && (!group || r.exercise.muscle_group === group))
      .sort((a, b) => (a.last < b.last ? 1 : -1));
  }, [sets, exMap, group, unit]);

  const groups = useMemo(() => [...new Set(sets.map((s) => exMap.get(s.exercise_id)?.muscle_group).filter(Boolean))] as string[], [sets, exMap]);

  return (
    <Page title={t('Fremgang', 'Progress')}>
      <Link to="/bodyweight" className="card mb-4 flex items-center gap-3 rounded-xl p-4 active:bg-raised">
        <span className="grid size-10 place-items-center rounded-xl bg-raised text-accent">
          <Icon name="scale" size={20} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">{t('Kroppsvekt', 'Bodyweight')}</span>
          <span className="block text-sm text-muted">{data?.bw ? `${t('Sist', 'Last')}: ${num(toDisplay(data.bw.weight_kg, unit))} ${unit}, ${dateShort(data.bw.date)}` : t('Ikke logget ennå', 'Not logged yet')}</span>
        </span>
        <Icon name="chevron" size={18} className="text-faint" />
      </Link>

      {data && sets.length === 0 ? (
        <EmptyState icon="chart" title={t('Ingen data ennå', 'No data yet')} text={t('Når du har logget noen økter ser du grafer, rekorder og fordeling på muskelgrupper her.', 'Once you have logged a few workouts you will see charts, records and muscle group split here.')} />
      ) : (
        <>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t('Siste 12 uker', 'Last 12 weeks')}</h2>
              <div className="flex gap-1.5">
                <Chip active={view === 'volume'} onClick={() => setView('volume')}>
                  {t('Volum', 'Volume')}
                </Chip>
                <Chip active={view === 'workouts'} onClick={() => setView('workouts')}>
                  {t('Økter', 'Workouts')}
                </Chip>
              </div>
            </div>
            <BarTrend
              data={series.map((w) => ({ x: `${w.start.getDate()}.${w.start.getMonth() + 1}`, y: view === 'volume' ? Math.round(toDisplay(w.volume, unit)) : w.workouts }))}
              label={view === 'volume' ? t('Volum per uke', 'Volume per week') : t('Økter per uke', 'Workouts per week')}
              unit={view === 'volume' ? unit : t('økter', 'workouts')}
            />
          </Card>

          {split.length > 0 && (
            <>
              <SectionTitle>{t('Muskelgrupper siste 30 dager', 'Muscle groups, last 30 days')}</SectionTitle>
              <Card className="flex flex-col gap-2.5 p-4">
                {split.map(([g, n]) => (
                  <div key={g} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="flex items-center gap-2 text-muted">
                      <MuscleDot group={g} />
                      {MUSCLE_LABEL[g]}
                    </span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full" style={{ width: `${(n / splitMax) * 100}%`, background: MUSCLE_COLOR[g] }} />
                    </span>
                    <span className="font-num text-right font-bold">{n}</span>
                  </div>
                ))}
                <p className="text-xs text-faint">{t('Antall arbeidssett per muskelgruppe.', 'Number of working sets per muscle group.')}</p>
              </Card>
            </>
          )}

          <SectionTitle>{t('Øvelser', 'Exercises')}</SectionTitle>
          {groups.length > 1 && (
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip active={!group} onClick={() => setGroup(null)}>
                {t('Alle', 'All')}
              </Chip>
              {groups.map((g) => (
                <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
                  {g}
                </Chip>
              ))}
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="w-full text-left" onClick={() => navigate(`/exercise/${r.id}`)}>
                  <Card className="flex items-center gap-3 p-4">
                    <MuscleDot group={r.exercise!.muscle_group} size={10} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{exerciseName(r.exercise)}</div>
                      <div className="text-sm text-muted">
                        {plural(r.sessions, t('økt', 'workout'), t('økter', 'workouts'))} · {t('sist', 'last')} {dateShort(r.last)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-num text-xl font-bold text-accent">{r.best.value}</div>
                      <div className="text-[11px] text-faint">{r.best.label}</div>
                    </div>
                    <Icon name="chevron" size={18} className="text-faint" />
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
