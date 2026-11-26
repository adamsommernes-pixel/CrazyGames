import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveWorkout } from '../../db/repo';
import { ActiveWorkout } from './ActiveWorkout';
import { Button, EmptyState, Page } from '../../components/ui';
import { openStartSheet } from './StartSheet';
import { t } from '../../i18n';

/**
 * Viser økta som pågår. Uten aktiv økt vises en tom tilstand (ingen automatisk
 * videresending, så «Lagre økt» rekker å gå videre til oppsummeringen).
 */
export function WorkoutTab() {
  const active = useLiveQuery(() => getActiveWorkout(), [], null);
  if (active === null) return null;
  if (!active) {
    return (
      <Page title={t('Økt', 'Workout')}>
        <EmptyState icon="dumbbell" title={t('Ingen økt i gang', 'No workout in progress')} text={t('Start en tom økt eller en av rutinene dine.', 'Start an empty workout or one of your routines.')}>
          <Button full icon="plus" onClick={openStartSheet}>
            {t('Start økt', 'Start workout')}
          </Button>
        </EmptyState>
      </Page>
    );
  }
  return <ActiveWorkout key={active.id} workout={active} />;
}
