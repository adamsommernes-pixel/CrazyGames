import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import { getActiveWorkout, startWorkout } from '../../db/repo';
import { Button, Card, Page, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ActiveWorkout } from './ActiveWorkout';
import { dateShort } from '../../lib/format';
import { InstallHint } from '../profile/InstallHint';

export function WorkoutTab() {
  const active = useLiveQuery(() => getActiveWorkout(), [], null);
  if (active === null) return null; // laster
  if (active) return <ActiveWorkout workout={active} />;
  return <StartScreen />;
}

function StartScreen() {
  const navigate = useNavigate();
  const routines = useLiveQuery(
    async () => (await db.routines.toArray()).filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [],
    [],
  );
  const last = useLiveQuery(async () => {
    const ws = (await db.workouts.orderBy('started_at').reverse().toArray()).filter((w) => !w.deleted && w.ended_at);
    return ws[0] ?? null;
  }, []);

  return (
    <Page title="Trening">
      <InstallHint />
      <Button full icon="plus" className="min-h-14 text-lg" onClick={() => void startWorkout()}>
        Start tom økt
      </Button>

      <SectionTitle>Start fra rutine</SectionTitle>
      {routines.length === 0 ? (
        <Card className="p-4 text-muted">
          Du har ingen rutiner ennå.{' '}
          <button type="button" className="font-semibold text-green" onClick={() => navigate('/routines/new')}>
            Lag en rutine
          </button>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((r) => (
            <li key={r.id}>
              <Card className="flex items-center gap-3 p-3 pl-4">
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <Button className="min-h-10 px-3" icon="play" onClick={() => void startWorkout({ routineId: r.id })}>
                  Start
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {last && (
        <>
          <SectionTitle>Forrige økt</SectionTitle>
          <button type="button" className="w-full text-left" onClick={() => navigate(`/history/${last.id}`)}>
            <Card className="flex items-center gap-3 p-4">
              <span className="flex-1">
                <span className="block font-semibold">{last.name}</span>
                <span className="block text-sm text-muted">{dateShort(last.started_at)}</span>
              </span>
              <Icon name="chevron" className="text-faint" />
            </Card>
          </button>
        </>
      )}
    </Page>
  );
}
