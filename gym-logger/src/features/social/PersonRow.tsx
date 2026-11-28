import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/widgets';
import { TierEmblem } from '../../components/TierBadge';
import type { Person } from '../../social';

/** Én person i en liste: bilde, navn, @brukernavn, nivå og handlinger til høyre. Trykk åpner profilen. */
export function PersonRow({ person, subtitle, children }: { person: Person; subtitle?: string; children?: ReactNode }) {
  return (
    <li className="flex min-h-16 items-center gap-3 px-3 py-2" data-person={person.handle}>
      <Link to={`/u/${person.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.display_name} color={person.color} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{person.display_name}</span>
          <span className="block truncate text-sm text-faint">@{person.handle}</span>
          {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
        </span>
        {person.tier_index !== null && person.tier_index !== undefined && <TierEmblem index={person.tier_index} size={26} />}
      </Link>
      {children && <span className="flex shrink-0 items-center gap-1.5">{children}</span>}
    </li>
  );
}
