import { Button, EmptyState } from '../../components/ui';
import { useFeed } from '../../social/feed';
import { useGraph } from '../../social/graph';
import { ActivityCard } from './ActivityCard';
import { t } from '../../i18n';

/** Feed: dine og andres økter. Med `userId`: bare den personens økter (på profilsiden). */
export function FeedList({ userId, onFindPeople }: { userId?: string; onFindPeople?: () => void }) {
  const { items, status, error, more, refresh, loadMore, react, remove } = useFeed({ userId });
  const { me } = useGraph();
  if (status === 'loading') {
    return (
      <p className="py-10 text-center text-muted" role="status">
        {t('Laster …', 'Loading …')}
      </p>
    );
  }
  if (status === 'error') {
    return (
      <EmptyState icon="cloud" title={t('Kunne ikke laste feeden', "Couldn't load the feed")} text={error ?? undefined}>
        <Button full onClick={() => void refresh()}>
          {t('Prøv igjen', 'Try again')}
        </Button>
      </EmptyState>
    );
  }
  if (!items.length) {
    return userId ? (
      <p className="py-6 text-center text-sm text-muted">{t('Ingen delte økter ennå.', 'No shared workouts yet.')}</p>
    ) : (
      <EmptyState icon="users" title={t('Ingen økter ennå', 'No workouts yet')} text={t('Øktene dine og til dem du følger vises her. Fullfør en økt, eller finn venner under Folk.', 'Your workouts and those of people you follow show up here. Finish a workout, or find friends under People.')}>
        {onFindPeople && (
          <Button full variant="secondary" onClick={onFindPeople}>
            {t('Finn folk', 'Find people')}
          </Button>
        )}
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {!userId && (
        <button type="button" className="ml-auto text-sm font-medium text-muted" onClick={() => void refresh()}>
          {t('Oppdater', 'Refresh')}
        </button>
      )}
      {items.map((item) => (
        <ActivityCard key={`${item.activity.user_id}/${item.activity.id}`} item={item} me={me} onReact={(emoji) => (me ? react(item, me, emoji) : Promise.resolve())} onRemoved={() => remove(item)} />
      ))}
      {more && (
        <Button variant="secondary" full onClick={() => void loadMore()}>
          {t('Vis flere', 'Show more')}
        </Button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
