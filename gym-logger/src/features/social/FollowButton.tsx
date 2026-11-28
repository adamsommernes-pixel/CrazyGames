import { useState } from 'react';
import { Button } from '../../components/ui';
import { showToast } from '../../components/toast';
import { askConfirm } from '../../components/confirm';
import { errorText } from '../../social/store';
import { follow, relationTo, unfollow, useGraph } from '../../social/graph';
import type { Person } from '../../social';
import { t } from '../../i18n';

/** Følg / Følg tilbake / Forespurt / Følger, ut fra din status overfor personen. */
export function FollowButton({ person, compact }: { person: Person; compact?: boolean }) {
  const { rel, me } = useGraph();
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const r = relationTo(rel, me, person.user_id);
  if (r === 'self') return null;
  const size = compact ? 'min-h-9 px-3 text-sm' : '';

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (r === 'following' || r === 'requested') {
    return (
      <Button
        variant="secondary"
        className={size}
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const ok = await askConfirm(
              r === 'following'
                ? t(`Slutte å følge ${person.display_name}?`, `Unfollow ${person.display_name}?`)
                : t(`Trekke tilbake forespørselen til ${person.display_name}?`, `Cancel your request to ${person.display_name}?`),
              { confirmLabel: r === 'following' ? t('Slutt å følge', 'Unfollow') : t('Trekk tilbake', 'Cancel request'), danger: false },
            );
            if (ok) await unfollow(person.user_id);
          })
        }
      >
        {r === 'following' ? t('Følger', 'Following') : t('Forespurt', 'Requested')}
      </Button>
    );
  }
  return (
    <Button
      className={size}
      disabled={busy}
      onClick={() =>
        void run(async () => {
          const st = await follow(person.user_id);
          if (st === 'pending') showToast(t(`Forespørsel sendt til ${person.display_name}`, `Request sent to ${person.display_name}`));
        })
      }
    >
      {r === 'follows-you' ? t('Følg tilbake', 'Follow back') : t('Følg', 'Follow')}
    </Button>
  );
}
