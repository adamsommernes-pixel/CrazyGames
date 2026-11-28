import { useEffect, useState } from 'react';
import { social, type Badge } from '../../social';
import { badgeIcon, badgeText } from '../../social/badges';
import { t } from '../../i18n';

/** Merkene til en bruker (vinner av utfordringer og #1 på månedstavler). Vises bare når det finnes noen. */
export function BadgeRow({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let live = true;
    void social()
      ?.badges(userId)
      .then((b) => live && setBadges(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);
  if (!badges.length) return null;
  const shown = all ? badges : badges.slice(0, 3);
  return (
    <div className="mt-3">
      <ul aria-label={t('Merker', 'Badges')} className="flex flex-wrap gap-1.5">
        {shown.map((b) => (
          <li key={b.id} className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft/30 px-2.5 py-1 text-xs font-medium text-accent-strong">
            <span aria-hidden="true">{badgeIcon(b)}</span>
            {badgeText(b)}
          </li>
        ))}
      </ul>
      {badges.length > 3 && (
        <button type="button" className="mt-1.5 text-xs font-medium text-accent" onClick={() => setAll((v) => !v)}>
          {all ? t('Vis færre', 'Show fewer') : t(`Alle ${badges.length} merker`, `All ${badges.length} badges`)}
        </button>
      )}
    </div>
  );
}
