import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../db/types';
import {
  addSet,
  deleteSet,
  lastPerformance,
  moveWorkoutExercise,
  removeWorkoutExercise,
  setExerciseRest,
  updateSet,
} from '../../db/repo';
import type { PRKind } from '../../lib/calc';
import { ActionList, Button, Card, IconButton, NumberStepper, Sheet } from '../../components/ui';
import { SetRow } from './SetRow';
import { startRest } from './restTimer';
import { duration } from '../../lib/format';

export function ExerciseCard({
  we,
  exercise,
  sets,
  unit,
  prMap,
  isFirst,
  isLast,
}: {
  we: WorkoutExercise;
  exercise?: Exercise;
  sets: WorkoutSet[];
  unit: 'kg' | 'lbs';
  prMap: Map<string, PRKind[]>;
  isFirst: boolean;
  isLast: boolean;
}) {
  const previous = useLiveQuery(
    async () => (await lastPerformance(we.exercise_id, we.workout_id)).filter((s) => !s.is_warmup),
    [we.exercise_id, we.workout_id],
    [],
  );
  const [menu, setMenu] = useState(false);
  const [restSheet, setRestSheet] = useState(false);
  const [setMenuFor, setSetMenuFor] = useState<WorkoutSet | null>(null);
  const [rest, setRest] = useState(we.rest_seconds);
  const openRest = () => {
    setRest(we.rest_seconds);
    setRestSheet(true);
  };

  const sorted = [...sets].sort((a, b) => a.position - b.position);
  let workIndex = 0;

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-green">{exercise?.name ?? 'Ukjent øvelse'}</h2>
        <button type="button" className="tabular flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted active:bg-raised" onClick={openRest}>
          ⏱ {duration(we.rest_seconds * 1000)}
        </button>
        <IconButton icon="more" label="Valg for øvelse" onClick={() => setMenu(true)} />
      </div>
      <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4rem_3rem] gap-2 px-1 pb-1 text-xs font-semibold tracking-wide text-faint uppercase">
        <span className="text-center">Set</span>
        <span>Forrige</span>
        <span className="text-center">{unit}</span>
        <span className="text-center">Reps</span>
        <span />
      </div>
      <div className="flex flex-col gap-1">
        {sorted.map((s, i) => {
          const prev = s.is_warmup ? undefined : previous[workIndex];
          if (!s.is_warmup) workIndex++;
          return (
            <SetRow
              key={s.id}
              set={s}
              index={i}
              previous={prev}
              unit={unit}
              prs={prMap.get(s.id)}
              onCompleted={() => void startRest(we.rest_seconds)}
              onMenu={() => setSetMenuFor(s)}
            />
          );
        })}
      </div>
      <Button variant="ghost" icon="plus" full className="mt-1" onClick={() => void addSet(we)}>
        Legg til set
      </Button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={exercise?.name ?? 'Øvelse'}>
        <ActionList
          actions={[
            ...(!isFirst ? [{ label: 'Flytt opp', icon: 'up' as const, onClick: () => void moveWorkoutExercise(we.workout_id, we.id, -1).then(() => setMenu(false)) }] : []),
            ...(!isLast ? [{ label: 'Flytt ned', icon: 'down' as const, onClick: () => void moveWorkoutExercise(we.workout_id, we.id, 1).then(() => setMenu(false)) }] : []),
            { label: 'Endre hviletid', icon: 'timer', onClick: () => { setMenu(false); openRest(); } },
            {
              label: 'Fjern øvelse',
              icon: 'trash',
              danger: true,
              onClick: () => {
                if (confirm(`Fjerne ${exercise?.name ?? 'øvelsen'} fra økta?`)) void removeWorkoutExercise(we.id);
                setMenu(false);
              },
            },
          ]}
        />
      </Sheet>

      <Sheet open={restSheet} onClose={() => setRestSheet(false)} title="Hviletid">
        <p className="mb-3 text-muted">Timeren starter når du huker av et set.</p>
        <NumberStepper label="Hviletid" value={rest} step={15} min={0} max={600} onChange={setRest} format={(v) => (v ? duration(v * 1000) : 'Av')} />
        <Button full className="mt-4" onClick={() => void setExerciseRest(we.id, rest).then(() => setRestSheet(false))}>
          Lagre
        </Button>
      </Sheet>

      <Sheet open={!!setMenuFor} onClose={() => setSetMenuFor(null)} title="Set">
        {setMenuFor && (
          <ActionList
            actions={[
              {
                label: setMenuFor.is_warmup ? 'Gjør til arbeidssett' : 'Merk som oppvarming',
                onClick: () => void updateSet(setMenuFor.id, { is_warmup: setMenuFor.is_warmup ? 0 : 1 }).then(() => setSetMenuFor(null)),
              },
              {
                label: 'Slett set',
                icon: 'trash',
                danger: true,
                onClick: () => void deleteSet(setMenuFor.id).then(() => setSetMenuFor(null)),
              },
            ]}
          />
        )}
      </Sheet>
    </Card>
  );
}
