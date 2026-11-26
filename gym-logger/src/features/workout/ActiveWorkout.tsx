import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import type { Workout } from '../../db/types';
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  renameWorkout,
  setsForWorkout,
  setWorkoutNotes,
  workoutExercises,
} from '../../db/repo';
import { Button, EmptyState, Page, Sheet, Stat, inputClass } from '../../components/ui';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker, useExerciseMap } from './ExercisePicker';
import { stopRest, useNow } from './restTimer';
import { useSetting } from '../../lib/settings';
import { usePRMap } from '../../lib/prs';
import { duration, num, toDisplay } from '../../lib/format';
import { volume } from '../../lib/calc';
import { askConfirm } from '../../components/confirm';

export function ActiveWorkout({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const prMap = usePRMap();
  const now = useNow(1000);
  const wes = useLiveQuery(() => workoutExercises(workout.id), [workout.id], []);
  const sets = useLiveQuery(() => setsForWorkout(workout.id), [workout.id], []);
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [name, setName] = useState(workout.name);
  const [notes, setNotes] = useState(workout.notes);

  const doneSets = sets.filter((s) => s.completed_at);
  const vol = volume(sets);

  const finish = async () => {
    if (notes !== workout.notes) await setWorkoutNotes(workout.id, notes);
    if (await finishWorkout(workout.id)) {
      await stopRest();
      setFinishing(false);
      navigate(`/history/${workout.id}`);
    }
  };

  const discard = async () => {
    setFinishing(false);
    if (!(await askConfirm('Hele økta forkastes. Dette kan ikke angres.', { confirmLabel: 'Forkast økt' }))) return;
    await deleteWorkout(workout.id);
    await stopRest();
    setFinishing(false);
  };

  return (
    <Page
      title={
        <input
          aria-label="Navn på økt"
          className="w-full truncate bg-transparent outline-none focus:text-green"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== workout.name && void renameWorkout(workout.id, name.trim())}
        />
      }
      actions={
        <Button className="min-h-10 px-4" onClick={() => setFinishing(true)}>
          Avslutt
        </Button>
      }
    >
      <div className="tabular mb-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Tid" value={duration(now - new Date(workout.started_at).getTime())} />
        <Stat label="Sets" value={String(doneSets.length)} />
        <Stat label={`Volum (${unit})`} value={num(toDisplay(vol, unit), 0)} />
      </div>

      {wes.length === 0 ? (
        <EmptyState icon="dumbbell" title="Tom økt" text="Legg til den første øvelsen for å begynne å logge." />
      ) : (
        <div className="flex flex-col gap-3">
          {wes.map((we, i) => (
            <ExerciseCard
              key={we.id}
              we={we}
              exercise={exMap.get(we.exercise_id)}
              sets={sets.filter((s) => s.workout_exercise_id === we.id)}
              unit={unit}
              prMap={prMap}
              isFirst={i === 0}
              isLast={i === wes.length - 1}
            />
          ))}
        </div>
      )}

      <Button full icon="plus" variant="secondary" className="mt-4 min-h-14 border-green/50 text-green" onClick={() => setPicker(true)}>
        Legg til øvelse
      </Button>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(id) => void addExerciseToWorkout(workout.id, id)} />

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Avslutt økt">
        {doneSets.length === 0 ? (
          <p className="mb-4 text-muted">Du har ikke huket av noen sets ennå. Hak av settene du har gjort, eller forkast økta.</p>
        ) : (
          <p className="mb-4 text-muted">
            {doneSets.length} sets fullført. Sets som ikke er huket av blir fjernet.
          </p>
        )}
        <label className="mb-4 flex flex-col gap-1">
          <span className="text-sm text-muted">Notat (valgfritt)</span>
          <textarea
            className={`${inputClass} min-h-20 py-2`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hvordan gikk det?"
          />
        </label>
        <div className="flex flex-col gap-2">
          <Button full disabled={doneSets.length === 0} onClick={() => void finish()}>
            Lagre økt
          </Button>
          <Button full variant="danger" icon="trash" onClick={() => void discard()}>
            Forkast økt
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
