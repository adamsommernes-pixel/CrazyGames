import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import type { Workout, WorkoutSet } from '../../db/types';
import { Card, Chip, EmptyState, Page, PRBadge, SectionTitle } from '../../components/ui';
import { Calendar, dayKey } from '../../components/Calendar';
import { Icon } from '../../components/Icon';
import { MuscleDot } from '../../components/MuscleTag';
import { useExerciseMap } from '../workout/ExercisePicker';
import { useSetting } from '../../lib/settings';
import { usePRMap } from '../../lib/prs';
import { dateLong, durationShort, monthYear, num, plural, toDisplay } from '../../lib/format';
import { volume } from '../../lib/calc';

export function HistoryList() {
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const prMap = usePRMap();
  const exMap = useExerciseMap();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [day, setDay] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const workouts = (await db.workouts.orderBy('started_at').reverse().toArray()).filter((w) => !w.deleted && w.ended_at);
    const sets = (await db.sets.toArray()).filter((s) => !s.deleted && s.completed_at);
    const byWorkout = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      const list = byWorkout.get(s.workout_id) ?? [];
      list.push(s);
      byWorkout.set(s.workout_id, list);
    }
    return { workouts, byWorkout };
  }, []);

  if (!data) return <Page title="Historikk">{null}</Page>;
  const { workouts, byWorkout } = data;

  // Grupper på måned (eller bare valgt dag i kalendervisning).
  const shown = view === 'calendar' ? workouts.filter((w) => day && dayKey(w.started_at) === day) : workouts;
  const groups: { month: string; items: Workout[] }[] = [];
  for (const w of shown) {
    const m = monthYear(w.started_at);
    if (groups[groups.length - 1]?.month !== m) groups.push({ month: m, items: [] });
    groups[groups.length - 1].items.push(w);
  }

  return (
    <Page
      title="Historikk"
      actions={
        <div className="flex gap-1.5 pr-2">
          <Chip active={view === 'list'} onClick={() => setView('list')}>
            Liste
          </Chip>
          <Chip active={view === 'calendar'} onClick={() => setView('calendar')}>
            Kalender
          </Chip>
        </div>
      }
    >
      {view === 'calendar' && workouts.length > 0 && (
        <div className="mb-4">
          <Calendar marked={new Set(workouts.map((w) => dayKey(w.started_at)))} selected={day} onSelect={setDay} />
          {!day && <p className="mt-3 text-center text-sm text-muted">Trykk på en grønn dag for å se økta.</p>}
        </div>
      )}
      {workouts.length === 0 ? (
        <EmptyState icon="history" title="Ingen økter ennå" text="Ferdige økter dukker opp her." />
      ) : (
        groups.map((g, gi) => (
          <section key={g.month}>
            {gi === 0 ? <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{g.month}</h2> : <SectionTitle>{g.month}</SectionTitle>}
            <ul className="flex flex-col gap-2">
              {g.items.map((w) => {
                const sets = byWorkout.get(w.id) ?? [];
                const exerciseIds = [...new Set([...sets].sort((a, b) => (a.completed_at! < b.completed_at! ? -1 : 1)).map((s) => s.exercise_id))];
                const exercises = exerciseIds.length;
                const shown = exerciseIds.slice(0, 3).map((id) => exMap.get(id)).filter(Boolean);
                const prs = sets.filter((s) => prMap.has(s.id)).length;
                return (
                  <li key={w.id}>
                    <button type="button" className="w-full text-left" onClick={() => navigate(`/history/${w.id}`)}>
                      <Card className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold">{w.name}</span>
                            {prs > 0 && <PRBadge label={`${prs} PR`} />}
                          </div>
                          <div className="text-sm text-muted first-letter:uppercase">{dateLong(w.started_at)}</div>
                          <div className="tabular mt-1 text-sm text-faint">
                            {durationShort(new Date(w.ended_at!).getTime() - new Date(w.started_at).getTime())} · {plural(exercises, 'øvelse', 'øvelser')} ·{' '}
                            {plural(sets.length, 'set', 'sets')} · {num(toDisplay(volume(sets), unit), 0)} {unit}
                          </div>
                          {shown.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                              {shown.map((e) => (
                                <span key={e!.id} className="inline-flex items-center gap-1.5">
                                  <MuscleDot group={e!.muscle_group} />
                                  {e!.name}
                                </span>
                              ))}
                              {exercises > 3 && <span className="text-faint">+{exercises - 3}</span>}
                            </div>
                          )}
                        </div>
                        <Icon name="chevron" className="text-faint" />
                      </Card>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Page>
  );
}
