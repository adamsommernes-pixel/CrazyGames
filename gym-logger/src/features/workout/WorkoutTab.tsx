import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveWorkout } from '../../db/repo';
import { ActiveWorkout } from './ActiveWorkout';
import { Button, EmptyState, Page } from '../../components/ui';
import { openStartSheet } from './StartSheet';

/**
 * Viser økta som pågår. Uten aktiv økt vises en tom tilstand (ingen automatisk
 * videresending, så «Lagre økt» rekker å gå videre til oppsummeringen).
 */
export function WorkoutTab() {
  const active = useLiveQuery(() => getActiveWorkout(), [], null);
  if (active === null) return null;
  if (!active) {
    return (
      <Page title="Økt">
        <EmptyState icon="dumbbell" title="Ingen økt i gang" text="Start en tom økt eller en av rutinene dine.">
          <Button full icon="plus" onClick={openStartSheet}>
            Start økt
          </Button>
        </EmptyState>
      </Page>
    );
  }
  return <ActiveWorkout key={active.id} workout={active} />;
}
