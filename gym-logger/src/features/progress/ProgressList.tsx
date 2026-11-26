import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { Card, Chip, EmptyState, Page } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useExerciseMap } from '../workout/ExercisePicker';
import { useSetting } from '../../lib/settings';
import { best1RM, countsAsWork } from '../../lib/calc';
import { dateShort, num, plural, toDisplay } from '../../lib/format';
import type { WorkoutSet } from '../../db/types';

export function ProgressList() {
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const [group, setGroup] = useState<string | null>(null);
  const sets = useLiveQuery(async () => (await db.sets.toArray()).filter((s) => !s.deleted && countsAsWork(s)), [], []);

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
        e1rm: best1RM(list),
      }))
      .filter((r) => r.exercise && (!group || r.exercise.muscle_group === group))
      .sort((a, b) => (a.last < b.last ? 1 : -1));
  }, [sets, exMap, group]);

  const groups = useMemo(() => {
    const g = new Set<string>();
    for (const s of sets) {
      const e = exMap.get(s.exercise_id);
      if (e) g.add(e.muscle_group);
    }
    return [...g];
  }, [sets, exMap]);

  return (
    <Page title="Fremgang">
      {sets.length === 0 ? (
        <EmptyState icon="chart" title="Ingen data ennå" text="Når du har logget noen økter ser du grafer og rekorder for hver øvelse her." />
      ) : (
        <>
          {groups.length > 1 && (
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip active={!group} onClick={() => setGroup(null)}>
                Alle
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
                <button type="button" className="w-full text-left" onClick={() => navigate(`/progress/${r.id}`)}>
                  <Card className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.exercise!.name}</div>
                      <div className="tabular text-sm text-muted">
                        {plural(r.sessions, 'økt', 'økter')} · sist {dateShort(r.last)}
                      </div>
                    </div>
                    <div className="tabular text-right">
                      <div className="font-bold text-green">{num(toDisplay(r.e1rm, unit), 0)}</div>
                      <div className="text-xs text-faint">1RM {unit}</div>
                    </div>
                    <Icon name="chevron" className="text-faint" />
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
