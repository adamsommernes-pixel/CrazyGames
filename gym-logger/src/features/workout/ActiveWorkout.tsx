import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Workout } from '../../db/types';
import {
  addExerciseToWorkout,
  deleteWorkout,
  finishWorkout,
  lastSetTime,
  nextPendingSet,
  renameWorkout,
  restore,
  routineChanges,
  updateRoutineFromWorkout,
  setsForWorkout,
  setWorkoutNotes,
  workoutExercises,
} from '../../db/repo';
import { Button, EmptyState, NumberStepper, Page, Sheet, Stat, inputClass } from '../../components/ui';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker, useExerciseMap } from './ExercisePicker';
import { stopRest, useNow } from './restTimer';
import { useWakeLock } from './useWakeLock';
import { useSetting } from '../../lib/settings';
import { usePRMap } from '../../lib/prs';
import { dateShort, duration, durationShort, isLongAgo, num, plural, toDisplay } from '../../lib/format';
import { volume } from '../../lib/calc';
import { undoToast } from '../../components/toast';
import { Icon } from '../../components/Icon';
import { locale, t } from '../../i18n';

export function ActiveWorkout({ workout }: { workout: Workout }) {
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const prMap = usePRMap();
  const now = useNow(1000);
  const keepAwake = useSetting('keepAwake');
  useWakeLock(keepAwake);
  const wes = useLiveQuery(() => workoutExercises(workout.id), [workout.id], []);
  const sets = useLiveQuery(() => setsForWorkout(workout.id), [workout.id], []);
  const location = useLocation();
  const [picker, setPicker] = useState(false);
  // Hjem kan sende hit med «avslutt nå» for en glemt økt.
  const [finishing, setFinishing] = useState(() => !!(location.state as { finish?: boolean } | null)?.finish);
  const [name, setName] = useState(workout.name);
  const [notes, setNotes] = useState(workout.notes);
  // Økter startet for lenge siden (glemt eller etterregistrert) får varighet satt for hånd.
  const startMs = new Date(workout.started_at).getTime();
  const longAgo = isLongAgo(workout.started_at, now);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const lastSet = useLiveQuery(() => lastSetTime(workout.id), [workout.id, sets.length]);
  const suggestedMin = lastSet ? Math.max(10, Math.round((new Date(lastSet).getTime() - startMs) / 60_000 / 5) * 5 + 5) : 60;
  // Etterregistrert økt: settene er huket av nå, så tiden siden start sier ingenting. Bruk 60 min.
  const minutes = durationMin ?? (suggestedMin > 300 ? 60 : suggestedMin);

  // Startet fra en rutine og endret underveis? Da kan rutinen oppdateres når økta lagres.
  const routineChange = useLiveQuery(() => routineChanges(workout.id), [workout.id, sets.length, wes.length]);
  const [updateRoutine, setUpdateRoutine] = useState(false);

  const doneSets = sets.filter((s) => s.completed_at);
  const vol = volume(sets);

  // «Du er her»: første uferdige set i øvelsesrekkefølge. Etter hvert fullførte set rulles det fram.
  const currentSetId = nextPendingSet(wes, sets)?.id;
  const doneCount = doneSets.length;
  const prevDone = useRef(doneCount);
  useEffect(() => {
    if (doneCount > prevDone.current && currentSetId && !document.activeElement?.matches('input')) {
      document.querySelector(`[aria-current="step"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    prevDone.current = doneCount;
  }, [doneCount, currentSetId]);

  const finish = async () => {
    if (notes !== workout.notes) await setWorkoutNotes(workout.id, notes);
    const endedAt = longAgo ? new Date(startMs + minutes * 60_000).toISOString() : undefined;
    if (await finishWorkout(workout.id, endedAt)) {
      if (routineChange && updateRoutine) await updateRoutineFromWorkout(workout.id);
      await stopRest();
      setFinishing(false);
      navigate(`/summary/${workout.id}`, { replace: true });
    }
  };

  const discard = async () => {
    setFinishing(false);
    const removed = await deleteWorkout(workout.id);
    await stopRest();
    navigate('/', { replace: true });
    undoToast('Økta er forkastet', async () => {
      await restore(removed);
      navigate('/workout');
    });
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
      <div className="mb-3 grid grid-cols-3 gap-2">
        {longAgo ? <Stat label="Startet" value={dateShort(workout.started_at)} /> : <Stat label="Tid" value={duration(now - startMs)} />}
        <Stat label="Sets" value={`${doneSets.length}/${sets.length}`} />
        <Stat label={`Volum (${unit})`} value={num(toDisplay(vol, unit), 0)} />
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Fremdrift i økta" aria-valuenow={doneSets.length} aria-valuemax={sets.length}>
        <div className="h-full rounded-full bg-green shadow-glow transition-[width] duration-500" style={{ width: `${sets.length ? (doneSets.length / sets.length) * 100 : 0}%` }} />
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
              currentSetId={currentSetId}
            />
          ))}
        </div>
      )}

      <Button full icon="plus" variant="secondary" className="mt-4 min-h-14 border-green/50 text-green" onClick={() => setPicker(true)}>
        Legg til øvelse
      </Button>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={async (ids) => {
          for (const id of ids) await addExerciseToWorkout(workout.id, id);
        }}
      />

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Avslutt økt">
        {doneSets.length === 0 ? (
          <p className="mb-4 text-muted">Du har ikke huket av noen sets ennå. Hak av settene du har gjort, eller forkast økta.</p>
        ) : (
          <p className="mb-4 text-muted">
            {plural(doneSets.length, 'set', 'sets')} fullført. Sets som ikke er huket av blir fjernet.
          </p>
        )}
        {longAgo && (
          <div className="mb-4">
            <div className="mb-1.5 text-sm text-muted">
              Økta startet {new Date(workout.started_at).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Hvor lenge varte den?
            </div>
            <NumberStepper label="Varighet" value={minutes} step={5} min={5} max={300} onChange={setDurationMin} format={(v) => durationShort(v * 60_000)} />
          </div>
        )}
        {routineChange && doneSets.length > 0 && (
          <button
            type="button"
            role="switch"
            aria-checked={updateRoutine}
            onClick={() => setUpdateRoutine(!updateRoutine)}
            className={`mb-4 flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${updateRoutine ? 'border-green/60 bg-green-dim/30' : 'border-line bg-raised'}`}
          >
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 ${updateRoutine ? 'border-green bg-green text-black' : 'border-line'}`}>
              {updateRoutine && <Icon name="check" size={14} strokeWidth={3.5} />}
            </span>
            <span>
              <span className="block font-semibold">Oppdater rutinen «{routineChange.routineName}»</span>
              <span className="block text-sm text-muted">Du har endret øvelser eller antall sets. Lagre dem i rutinen til neste gang.</span>
            </span>
          </button>
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
