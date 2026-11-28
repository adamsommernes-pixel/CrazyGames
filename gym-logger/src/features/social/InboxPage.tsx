import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, Page } from '../../components/ui';
import { Avatar } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { showToast } from '../../components/toast';
import { describe, markAllRead, refreshInbox, useInbox } from '../../social/inbox';
import { acceptFollower, removeFollower, useGraph } from '../../social/graph';
import { errorText } from '../../social/store';
import { timeAgo } from './ActivityCard';
import { openSocialTab } from './SocialPage';
import { t } from '../../i18n';

/** Varsler: forespørsler (godta rett her), nye følgere, kudos og utfordringer. Åpnes = lest. */
export function InboxPage() {
  const inbox = useInbox();
  const g = useGraph();
  const navigate = useNavigate();
  // Hva som var ulest da siden ble åpnet, så det fortsatt vises som nytt mens du ser på det.
  const fresh = useRef<Set<string> | null>(null);

  useEffect(() => {
    void refreshInbox().then(() => markAllRead());
  }, []);
  if (inbox.loaded && fresh.current === null) fresh.current = new Set(inbox.items.filter((n) => !n.read_at).map((n) => n.id));

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      showToast(done);
    } catch (e) {
      showToast(errorText(e));
    }
  };

  return (
    <Page title={t('Varsler', 'Notifications')} back>
      {!inbox.loaded ? (
        <p className="py-10 text-center text-muted" role="status">
          {t('Laster …', 'Loading …')}
        </p>
      ) : inbox.items.length === 0 ? (
        <EmptyState icon="bell" title={t('Ingen varsler ennå', 'No notifications yet')} text={t('Her ser du forespørsler, nye følgere, kudos og utfordringer.', 'Requests, new followers, kudos and challenges show up here.')} />
      ) : (
        <Card>
          <ul aria-label={t('Varsler', 'Notifications')} className="divide-y divide-line">
            {inbox.items.map((n) => {
              const actor = n.actor ? (inbox.people.get(n.actor) ?? g.people.get(n.actor)) : undefined;
              const d = describe(n, actor);
              const isNew = fresh.current?.has(n.id);
              const pending = n.kind === 'follow_request' && !!n.actor && g.rel.requests.includes(n.actor);
              return (
                <li key={n.id} data-notification={n.kind} className={`flex min-h-16 items-center gap-3 px-3 py-2 ${isNew ? 'bg-accent-soft/20' : ''}`}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => {
                      if (d.tab) openSocialTab(d.tab);
                      navigate(d.to);
                    }}
                  >
                    {!n.actor ? (
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-lg" aria-hidden="true">
                        {n.kind === 'badge' ? (n.payload.badge_kind === 'board' ? '🥇' : '🏆') : '🔔'}
                      </span>
                    ) : (
                      <Avatar name={actor?.display_name ?? '?'} color={actor?.color ?? '#6c6c72'} size={40} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{d.text}</span>
                      <span className="block text-xs text-faint">{timeAgo(n.created_at)}</span>
                    </span>
                    {isNew && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label={t('Ny', 'New')} />}
                  </button>
                  {pending && (
                    <span className="flex shrink-0 gap-1.5">
                      <Button className="min-h-9 px-3 text-sm" onClick={() => void run(() => acceptFollower(n.actor!), t('Godtatt', 'Accepted'))}>
                        {t('Godta', 'Accept')}
                      </Button>
                      <button type="button" aria-label={t(`Avslå ${actor?.display_name ?? ''}`, `Decline ${actor?.display_name ?? ''}`)} className="grid size-9 place-items-center rounded-lg text-muted active:bg-raised" onClick={() => void run(() => removeFollower(n.actor!), t('Avslått', 'Declined'))}>
                        <Icon name="x" size={18} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Page>
  );
}
