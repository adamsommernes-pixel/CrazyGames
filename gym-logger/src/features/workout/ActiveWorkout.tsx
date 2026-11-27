import { requestPersist } from '../../lib/storage';
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
import { askConfirm } from '../../components/confirm';
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
    // Egen tittel på økta; tomt felt beholder det gamle navnet.
    if (name.trim() && name.trim() !== workout.name) await renameWorkout(workout.id, name.trim());
    const endedAt = longAgo ? new Date(startMs + minutes * 60_000).toISOString() : undefined;
    if (await finishWorkout(workout.id, endedAt)) {
      void requestPersist();
      await stopRest();
      setFinishing(false);
      // Endret du økta (øvelser, rekkefølge eller antall sets)? Spør om rutinen skal oppdateres.
      if (routineChange) {
        const save = await askConfirm(
          t(
            `Du endret økta i forhold til rutinen «${routineChange.routineName}». Vil du lagre endringene i rutinen, så er de med neste gang?`,
            `You changed this workout compared to the routine “${routineChange.routineName}”. Save the changes to the routine so they're there next time?`,
          ),
          { title: t('Lagre i rutinen?', 'Save to the routine?'), confirmLabel: t('Lagre i rutinen', 'Save to routine'), cancelLabel: t('Bare denne gangen', 'Just this time'), danger: false },
        );
        if (save) await updateRoutineFromWorkout(workout.id);
      }
      navigate(`/summary/${workout.id}`, { replace: true });
    }
  };

  const discard = async () => {
    setFinishing(false);
    const removed = await deleteWorkout(workout.id);
    await stopRest();
    navigate('/', { replace: true });
    undoToast(t('Økta er forkastet', 'Workout discarded'), async () => {
      await restore(removed);
      navigate('/workout');
    });
  };

  return (
    <Page
      title={
        <label className="flex min-w-0 items-center gap-1.5">
          <input
            aria-label={t('Navn på økt', 'Workout name')}
            title={t('Trykk for å gi økta et navn', 'Tap to name the workout')}
            className="min-w-0 flex-1 truncate bg-transparent outline-none focus:text-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== workout.name && void renameWorkout(workout.id, name.trim())}
          />
          <Icon name="edit" size={16} className="shrink-0 text-faint" />
        </label>
      }
      actions={
        <Button className="min-h-10 px-4" onClick={() => setFinishing(true)}>
          {t('Avslutt', 'Finish')}
        </Button>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        {longAgo ? <Stat label={t('Startet', 'Started')} value={dateShort(workout.started_at)} /> : <Stat label={t('Tid', 'Time')} value={duration(now - startMs)} />}
        <Stat label="Sets" value={`${doneSets.length}/${sets.length}`} />
        <Stat label={`${t('Volum', 'Volume')} (${unit})`} value={num(toDisplay(vol, unit), 0)} />
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={t('Fremdrift i økta', 'Workout progress')} aria-valuenow={doneSets.length} aria-valuemax={sets.length}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${sets.length ? (doneSets.length / sets.length) * 100 : 0}%` }} />
      </div>

      {wes.length === 0 ? (
        <EmptyState icon="dumbbell" title={t('Tom økt', 'Empty workout')} text={t('Legg til den første øvelsen for å begynne å logge.', 'Add your first exercise to start logging.')} />
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

      <Button full icon="plus" variant="secondary" className="mt-4 min-h-14 border-accent/50 text-accent" onClick={() => setPicker(true)}>
        {t('Legg til øvelse', 'Add exercise')}
      </Button>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={async (ids) => {
          for (const id of ids) await addExerciseToWorkout(workout.id, id);
        }}
      />

      <Sheet open={finishing} onClose={() => setFinishing(false)} title={t('Avslutt økt', 'Finish workout')}>
        {doneSets.length > 0 && (
          <label className="mb-4 flex flex-col gap-1">
            <span className="text-sm text-muted">{t('Tittel', 'Title')}</span>
            <input
              id="finish-title"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('F.eks. Tunge bein – ny PR på knebøy', 'E.g. Heavy legs – new squat PR')}
              maxLength={80}
            />
          </label>
        )}
        {doneSets.length === 0 ? (
          <p className="mb-4 text-muted">{t('Du har ikke huket av noen sets ennå. Hak av settene du har gjort, eller forkast økta.', 'You have not ticked off any sets yet. Tick off the sets you did, or discard the workout.')}</p>
        ) : (
          <p className="mb-4 text-muted">
            {plural(doneSets.length, 'set', 'sets')} {t('fullført. Sets som ikke er huket av blir fjernet.', 'done. Sets that are not ticked off will be removed.')}
          </p>
        )}
        {longAgo && (
          <div className="mb-4">
            <div className="mb-1.5 text-sm text-muted">
              {t('Økta startet', 'The workout started')} {new Date(workout.started_at).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. {t('Hvor lenge varte den?', 'How long did it last?')}
            </div>
            <NumberStepper label={t('Varighet', 'Duration')} value={minutes} step={5} min={5} max={300} onChange={setDurationMin} format={(v) => durationShort(v * 60_000)} />
          </div>
        )}
        <label className="mb-4 flex flex-col gap-1">
          <span className="text-sm text-muted">{t('Notat (valgfritt)', 'Note (optional)')}</span>
          <textarea
            className={`${inputClass} min-h-20 py-2`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Hvordan gikk det?', 'How did it go?')}
          />
        </label>
        <div className="flex flex-col gap-2">
          <Button full disabled={doneSets.length === 0} onClick={() => void finish()}>
            {t('Lagre økt', 'Save workout')}
          </Button>
          <Button full variant="danger" icon="trash" onClick={() => void discard()}>
            {t('Forkast økt', 'Discard workout')}
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
