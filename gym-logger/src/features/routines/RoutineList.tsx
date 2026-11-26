import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { getActiveWorkout, routineItems, startWorkout } from '../../db/repo';
import { Button, Card, EmptyState, IconButton, Page } from '../../components/ui';
import { useExerciseMap } from '../workout/ExercisePicker';

export function RoutineList() {
  const navigate = useNavigate();
  const exMap = useExerciseMap();
  const routines = useLiveQuery(async () => {
    const list = (await db.routines.toArray()).filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    return Promise.all(list.map(async (r) => ({ routine: r, items: await routineItems(r.id) })));
  }, []);

  const start = async (routineId: string) => {
    if (await getActiveWorkout()) {
      alert('Du har allerede en økt i gang. Avslutt den først.');
      navigate('/');
      return;
    }
    await startWorkout({ routineId });
    navigate('/');
  };

  return (
    <Page title="Rutiner" actions={<IconButton icon="plus" label="Ny rutine" className="text-green" onClick={() => navigate('/routines/new')} />}>
      {routines && routines.length === 0 && (
        <EmptyState icon="list" title="Ingen rutiner" text="Lag faste økter, som Push, Pull og Bein, og start dem med ett trykk.">
          <Button full icon="plus" onClick={() => navigate('/routines/new')}>
            Lag rutine
          </Button>
        </EmptyState>
      )}
      <ul className="flex flex-col gap-3">
        {routines?.map(({ routine, items }) => (
          <li key={routine.id}>
            <Card className="p-4">
              <button type="button" className="w-full text-left" onClick={() => navigate(`/routines/${routine.id}`)}>
                <h2 className="text-lg font-bold">{routine.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {items.length
                    ? items.map((i) => exMap.get(i.exercise_id)?.name ?? '?').join(', ')
                    : 'Ingen øvelser'}
                </p>
              </button>
              <Button full icon="play" className="mt-3" disabled={!items.length} onClick={() => void start(routine.id)}>
                Start økt
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  );
}
