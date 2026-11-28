import { useEffect, useState } from 'react';
import { Card, Sheet } from '../../components/ui';
import { social, type Person, type Reaction } from '../../social';
import { rememberPerson, useGraph } from '../../social/graph';
import { errorText } from '../../social/store';
import { PersonRow } from './PersonRow';
import { FollowButton } from './FollowButton';
import { t } from '../../i18n';

/** Hvem som har reagert på en økt, nyeste først. */
export function ReactionsSheet({ open, onClose, reactions }: { open: boolean; onClose: () => void; reactions: Reaction[] }) {
  const g = useGraph();
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const ids = reactions.map((r) => r.user_id).join(',');

  useEffect(() => {
    if (!open) return;
    const b = social();
    if (!b) return;
    let live = true;
    setError(null);
    b.people(ids.split(',').filter(Boolean))
      .then((found) => {
        if (!live) return;
        for (const p of found) rememberPerson(p);
        setPeople(new Map(found.map((p) => [p.user_id, p])));
      })
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [open, ids]);

  const sorted = [...reactions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <Sheet open={open} onClose={onClose} title={t('Reaksjoner', 'Reactions')}>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <Card>
          <ul aria-label={t('Hvem som reagerte', 'Who reacted')} className="divide-y divide-line">
            {sorted.map((r) => {
              const p = people.get(r.user_id) ?? g.people.get(r.user_id);
              if (!p) return null;
              return (
                <PersonRow key={r.user_id} person={p}>
                  <span className="text-xl" aria-label={r.emoji}>
                    {r.emoji}
                  </span>
                  <FollowButton person={p} compact />
                </PersonRow>
              );
            })}
          </ul>
        </Card>
      )}
    </Sheet>
  );
}
