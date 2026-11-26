import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { db } from '../../db/dexie';
import { SET_TYPE_SHORT, type Workout, type WorkoutSet } from '../../db/types';
import { deleteWorkout, editSet, repeatWorkout, restore, routineFromWorkout, setsForWorkout, updateWorkoutTimes, workoutExercises } from '../../db/repo';
import { ActionList, Button, Card, EmptyState, IconButton, NumberStepper, Page, PRBadge, Sheet, Stat, inputClass } from '../../components/ui';
import { undoToast } from '../../components/toast';
import { useExerciseMap } from '../workout/ExercisePicker';
import { useSetting } from '../../lib/settings';
import { usePRMap } from '../../lib/prs';
import { dateLong, durationShort, fromDateTimeInputs, fromDisplay, num, toDateInput, toDisplay, toTimeInput } from '../../lib/format';
import { PR_LABEL, estimate1RM, volume } from '../../lib/calc';

export function WorkoutDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const prMap = usePRMap();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [editTimes, setEditTimes] = useState(false);
  const data = useLiveQuery(async () => {
    const workout = await db.workouts.get(id);
    return { workout, wes: await workoutExercises(id), sets: (await setsForWorkout(id)).filter((s) => s.completed_at) };
  }, [id]);

  if (!data) return <Page title="" back>{null}</Page>;
  const { workout, wes, sets } = data;
  if (!workout || workout.deleted) {
    return (
      <Page title="Økt" back>
        <EmptyState icon="history" title="Fant ikke økta" />
      </Page>
    );
  }

  const prCount = sets.filter((s) => prMap.has(s.id)).length;

  return (
    <Page title={workout.name} back actions={<IconButton icon="more" label="Valg" onClick={() => setMenu(true)} />}>
      <p className="text-muted first-letter:uppercase">{dateLong(workout.started_at)}</p>
      <div className="tabular mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Varighet" value={workout.ended_at ? durationShort(new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) : 'Pågår'} />
        <Stat label={`Volum (${unit})`} value={num(toDisplay(volume(sets), unit), 0)} />
        <Stat label="Rekorder" value={String(prCount)} />
      </div>
      {workout.notes && <Card className="mt-3 p-3 whitespace-pre-wrap text-muted">{workout.notes}</Card>}

      <div className="mt-4 flex flex-col gap-3">
        {wes.map((we) => {
          const exSets = sets.filter((s) => s.workout_exercise_id === we.id).sort((a, b) => a.position - b.position);
          if (!exSets.length) return null;
          let n = 0;
          return (
            <Card key={we.id} className="p-4">
              <button type="button" className="text-lg font-bold text-green" onClick={() => navigate(`/exercise/${we.exercise_id}`)}>
                {exMap.get(we.exercise_id)?.name ?? 'Ukjent øvelse'}
              </button>
              <ul className="mt-2 flex flex-col gap-1.5">
                {exSets.map((s) => {
                  const prs = prMap.get(s.id);
                  return (
                    <li key={s.id} className="tabular flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`font-num w-6 text-center font-bold ${s.set_type === 'normal' ? 'text-faint' : 'text-warn'}`}>
                        {SET_TYPE_SHORT[s.set_type] || ++n}
                      </span>
                      <button type="button" className="font-num font-bold underline decoration-line decoration-dotted underline-offset-4" aria-label={`Rediger set: ${num(toDisplay(s.weight, unit))} ${unit} × ${s.reps}`} onClick={() => setEditing(s)}>
                        {num(toDisplay(s.weight, unit))} {unit} × {s.reps}
                      </button>
                      <span className="text-sm text-faint">1RM {num(toDisplay(estimate1RM(s.weight, s.reps), unit))}</span>
                      {prs?.map((p) => <PRBadge key={p} label={PR_LABEL[p]} />)}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      <Button full icon="repeat" variant="secondary" className="mt-4" onClick={() => void repeatWorkout(id).then(() => navigate('/workout'))}>
        Gjenta økt
      </Button>

      <EditSetSheet set={editing} unit={unit} onClose={() => setEditing(null)} />
      {editTimes && workout.ended_at && <EditTimesSheet workout={workout} onClose={() => setEditTimes(false)} />}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Økt">
        <ActionList
          actions={[
            ...(workout.ended_at ? [{ label: 'Endre navn, dato og varighet', icon: 'edit' as const, onClick: () => { setMenu(false); setEditTimes(true); } }] : []),
            { label: 'Gjenta økt', icon: 'repeat', onClick: () => void repeatWorkout(id).then(() => navigate('/workout')) },
            { label: 'Lagre som rutine', icon: 'list', onClick: () => void routineFromWorkout(id).then((rid) => navigate(`/routines/${rid}`)) },
            {
              label: 'Slett økt',
              icon: 'trash',
              danger: true,
              onClick: async () => {
                setMenu(false);
                const removed = await deleteWorkout(id);
                navigate('/history', { replace: true });
                undoToast('Økta er slettet', () => restore(removed));
              },
            },
          ]}
        />
      </Sheet>
    </Page>
  );
}

/** Endre navn, startdato, klokkeslett og varighet på en ferdig økt. */
function EditTimesSheet({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const start = new Date(workout.started_at);
  const [name, setName] = useState(workout.name);
  const [date, setDate] = useState(toDateInput(start));
  const [time, setTime] = useState(toTimeInput(start));
  const [minutes, setMinutes] = useState(Math.max(5, Math.round((new Date(workout.ended_at!).getTime() - start.getTime()) / 60_000)));
  const startedAt = date ? fromDateTimeInputs(date, time) : workout.started_at;
  const inFuture = new Date(startedAt).getTime() > Date.now();
  return (
    <Sheet open onClose={onClose} title="Endre økt">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Navn</span>
          <input id="edit-workout-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Dato</span>
            <input id="edit-workout-date" type="date" className={inputClass} value={date} max={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Startet</span>
            <input id="edit-workout-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <div>
          <div className="mb-1.5 text-sm text-muted">Varighet</div>
          <NumberStepper label="Varighet" value={minutes} step={5} min={5} max={600} onChange={setMinutes} format={(v) => durationShort(v * 60_000)} />
        </div>
        {inFuture && <p className="text-sm text-warn">Starttidspunktet er fram i tid.</p>}
        <Button
          full
          disabled={!date || inFuture}
          onClick={() => void updateWorkoutTimes(workout.id, { name, startedAt, durationMin: minutes }).then(onClose)}
        >
          Lagre endringer
        </Button>
      </div>
    </Sheet>
  );
}

/** Endre vekt og reps på et set i en ferdig økt. */
function EditSetSheet({ set, unit, onClose }: { set: WorkoutSet | null; unit: 'kg' | 'lbs'; onClose: () => void }) {
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  useEffect(() => {
    if (set) {
      setWeight(toDisplay(set.weight, unit));
      setReps(set.reps);
    }
  }, [set, unit]);
  return (
    <Sheet open={!!set} onClose={onClose} title="Rediger set">
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 text-sm text-muted">Vekt ({unit})</div>
          <NumberStepper label="Vekt" size="lg" value={weight} step={unit === 'kg' ? 2.5 : 5} max={unit === 'kg' ? 500 : 1100} onChange={setWeight} format={(v) => num(v)} />
        </div>
        <div>
          <div className="mb-1.5 text-sm text-muted">Reps</div>
          <NumberStepper label="Reps" size="lg" value={reps} max={100} onChange={setReps} />
        </div>
        <Button full className="mt-2" onClick={() => set && void editSet(set.id, fromDisplay(weight, unit), reps).then(onClose)}>
          Lagre endring
        </Button>
      </div>
    </Sheet>
  );
}
