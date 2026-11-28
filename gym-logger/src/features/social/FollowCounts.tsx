import { useEffect, useState } from 'react';
import { social, type FollowCounts as Counts } from '../../social';
import { useGraph } from '../../social/graph';
import { t } from '../../i18n';

/** «12 følgere · 8 følger». Henter på nytt når dine egne følgere endres. Skjules om tallene ikke kan hentes. */
export function FollowCounts({ userId, className = '' }: { userId: string; className?: string }) {
  const { rel } = useGraph();
  const [c, setC] = useState<Counts | null>(null);
  const key = `${rel.followers.length}/${rel.following.length}`;
  useEffect(() => {
    const b = social();
    if (!b) return;
    let live = true;
    b.followCounts(userId)
      .then((r) => live && setC(r))
      .catch(() => live && setC(null));
    return () => {
      live = false;
    };
  }, [userId, key]);
  if (!c) return null;
  return (
    <p className={`text-sm text-muted ${className}`} data-follow-counts>
      <b className="font-num text-ink">{c.followers}</b> {c.followers === 1 ? t('følger', 'follower') : t('følgere', 'followers')}
      <span aria-hidden="true"> · </span>
      {t('følger', 'following')} <b className="font-num text-ink">{c.following}</b>
    </p>
  );
}
