import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { getActiveWorkout, moveRoutine, nextRoutine, routineItems, sortedRoutines, startWorkout } from '../../db/repo';
import { Button, Card, EmptyState, IconButton, Page } from '../../components/ui';
import { useExerciseMap } from '../workout/ExercisePicker';
import { exerciseName } from '../../lib/exerciseName';
import { showInfo } from '../../components/confirm';
import { t } from '../../i18n';
import { Icon } from '../../components/Icon';

export function RoutineList() {
  const navigate = useNavigate();
  const exMap = useExerciseMap();
  const routines = useLiveQuery(async () => {
    const list = await sortedRoutines();
    const next = await nextRoutine();
    return Promise.all(list.map(async (r) => ({ routine: r, items: await routineItems(r.id), next: r.id === next?.id })));
  }, []);

  const start = async (routineId: string) => {
    if (await getActiveWorkout()) {
      await showInfo(t('Du har allerede en økt i gang. Avslutt den før du starter en ny.', 'You already have a workout in progress. Finish it before starting a new one.'));
      navigate('/workout');
      return;
    }
    await startWorkout({ routineId });
    navigate('/workout');
  };

  return (
    <Page title={t('Rutiner', 'Routines')} actions={<IconButton icon="plus" label={t('Ny rutine', 'New routine')} className="text-accent" onClick={() => navigate('/routines/new')} />}>
      <button
        type="button"
        onClick={() => navigate('/programs')}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft/20 p-4 text-left"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-on-accent">
          <Icon name="list" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t('Programbibliotek', 'Program library')}</span>
          <span className="block text-sm text-muted">{t('Ferdige splitter for 2–6 dager i uka: PPL, overkropp/underkropp, fullkropp og flere.', 'Ready-made splits for 2–6 days a week: PPL, upper/lower, full body and more.')}</span>
        </span>
        <Icon name="chevron" size={18} className="text-faint" />
      </button>
      {routines && routines.length > 0 && (
        <>
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{t('Mine rutiner', 'My routines')}</h2>
          <p className="mt-1 mb-3 text-sm text-faint">
            {t('Rekkefølgen bestemmer hvilken rutine som står for tur. Etter den siste begynner den på toppen igjen.', 'The order decides which routine is up next. After the last one it starts from the top again.')}
          </p>
        </>
      )}
      {routines && routines.length === 0 && (
        <EmptyState icon="list" title={t('Ingen rutiner', 'No routines')} text={t('Lag faste økter, som Push, Pull og Bein, og start dem med ett trykk.', 'Create fixed workouts like Push, Pull and Legs, and start them with one tap.')}>
          <Button full icon="plus" onClick={() => navigate('/routines/new')}>
            {t('Lag rutine', 'Create routine')}
          </Button>
        </EmptyState>
      )}
      <ul className="flex flex-col gap-3">
        {routines?.map(({ routine, items, next }, i) => (
          <li key={routine.id}>
            <Card className={`p-4 ${next ? 'border-accent/60' : ''}`}>
              <div className="flex items-start gap-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(`/routines/${routine.id}`)}>
                {next && <span className="mb-0.5 block text-[11px] font-semibold tracking-wide text-accent uppercase">{t('Står for tur', 'Up next')}</span>}
                <h2 className="text-lg font-bold">{routine.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {items.length
                    ? items.map((i) => exerciseName(exMap.get(i.exercise_id))).join(', ')
                    : t('Ingen øvelser', 'No exercises')}
                </p>
              </button>
              <div className="-mr-2 flex flex-col">
                <IconButton icon="up" label={`${t('Flytt opp', 'Move up')}: ${routine.name}`} disabled={i === 0} onClick={() => void moveRoutine(routine.id, -1)} className="disabled:opacity-25" />
                <IconButton icon="down" label={`${t('Flytt ned', 'Move down')}: ${routine.name}`} disabled={i === routines.length - 1} onClick={() => void moveRoutine(routine.id, 1)} className="disabled:opacity-25" />
              </div>
              </div>
              <Button full icon="play" className="mt-3" disabled={!items.length} onClick={() => void start(routine.id)}>
                {t('Start økt', 'Start workout')}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  );
}
