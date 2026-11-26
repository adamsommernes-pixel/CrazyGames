import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/dexie';
import { deleteWorkout, repeatWorkout, routineFromWorkout, setsForWorkout, workoutExercises } from '../../db/repo';
import { ActionList, Button, Card, EmptyState, IconButton, Page, PRBadge, Sheet, Stat } from '../../components/ui';
import { useExerciseMap } from '../workout/ExercisePicker';
import { useSetting } from '../../lib/settings';
import { usePRMap } from '../../lib/prs';
import { dateLong, durationShort, num, toDisplay } from '../../lib/format';
import { PR_LABEL, estimate1RM, volume } from '../../lib/calc';

export function WorkoutDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const prMap = usePRMap();
  const [menu, setMenu] = useState(false);
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
              <button type="button" className="text-lg font-bold text-green" onClick={() => navigate(`/progress/${we.exercise_id}`)}>
                {exMap.get(we.exercise_id)?.name ?? 'Ukjent øvelse'}
              </button>
              <ul className="mt-2 flex flex-col gap-1.5">
                {exSets.map((s) => {
                  const prs = prMap.get(s.id);
                  return (
                    <li key={s.id} className="tabular flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`w-6 text-center font-bold ${s.is_warmup ? 'text-amber-400' : 'text-faint'}`}>
                        {s.is_warmup ? 'O' : ++n}
                      </span>
                      <span className="font-semibold">
                        {num(toDisplay(s.weight, unit))} {unit} × {s.reps}
                      </span>
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

      <Button full icon="repeat" variant="secondary" className="mt-4" onClick={() => void repeatWorkout(id).then(() => navigate('/'))}>
        Gjenta økt
      </Button>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Økt">
        <ActionList
          actions={[
            { label: 'Gjenta økt', icon: 'repeat', onClick: () => void repeatWorkout(id).then(() => navigate('/')) },
            { label: 'Lagre som rutine', icon: 'list', onClick: () => void routineFromWorkout(id).then((rid) => navigate(`/routines/${rid}`)) },
            {
              label: 'Slett økt',
              icon: 'trash',
              danger: true,
              onClick: () => {
                if (!confirm('Slette økta for godt?')) return;
                void deleteWorkout(id).then(() => navigate('/history', { replace: true }));
              },
            },
          ]}
        />
      </Sheet>
    </Page>
  );
}
