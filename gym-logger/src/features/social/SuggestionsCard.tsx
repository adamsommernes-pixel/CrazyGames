import { Link } from 'react-router-dom';
import { Avatar } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { TierEmblem } from '../../components/TierBadge';
import { hideSuggestion, suggestionReason } from '../../social/suggestions';
import type { Suggestion } from '../../social';
import { FollowButton } from './FollowButton';
import { t } from '../../i18n';

/** «Oppdag folk» i feeden: en rad med kort man kan sveipe, med felles venner og Følg. */
export function SuggestionsCard({ people, title, onSeeAll }: { people: Suggestion[]; title?: string; onSeeAll?: () => void }) {
  if (!people.length) return null;
  return (
    <section aria-label={title ?? t('Oppdag folk', 'Discover people')} className="card rounded-xl py-3.5" data-suggestions>
      <div className="mb-2.5 flex items-baseline justify-between px-4">
        <h2 className="font-bold">{title ?? t('Oppdag folk', 'Discover people')}</h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="text-sm font-medium text-accent">
            {t('Se alle', 'See all')}
          </button>
        )}
      </div>
      <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none]">
        {people.map((p) => (
          <li key={p.user_id} className="relative flex w-36 shrink-0 snap-start flex-col items-center rounded-xl border border-line bg-raised px-2.5 pt-4 pb-3 text-center" data-person={p.handle}>
            <button
              type="button"
              aria-label={t(`Skjul ${p.display_name}`, `Hide ${p.display_name}`)}
              onClick={() => hideSuggestion(p.user_id)}
              className="absolute top-1 right-1 grid size-8 place-items-center rounded-full text-faint active:bg-surface"
            >
              <Icon name="x" size={14} />
            </button>
            <Link to={`/u/${p.handle}`} className="flex w-full min-w-0 flex-col items-center">
              <span className="relative">
                <Avatar name={p.display_name} color={p.color} size={56} />
                {p.tier_index !== null && p.tier_index !== undefined && (
                  <span className="absolute -right-1.5 -bottom-1">
                    <TierEmblem index={p.tier_index} size={22} />
                  </span>
                )}
              </span>
              <span className="mt-2 block w-full truncate text-sm font-semibold">{p.display_name}</span>
              <span className="block w-full truncate text-xs text-faint">@{p.handle}</span>
              <span className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted">{suggestionReason(p)}</span>
            </Link>
            <span className="mt-2 w-full [&>button]:w-full">
              <FollowButton person={p} compact />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
