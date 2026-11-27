import { Icon } from '../../components/Icon';
import { isRanked } from '../../lib/strength';
import { t } from '../../i18n';

/** Lite merke på øvelser som teller i styrkenivået (velgeren og øktkortet). */
export function RankedBadge({ exerciseId, className = '' }: { exerciseId: string; className?: string }) {
  if (!isRanked(exerciseId)) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-md border border-line bg-raised px-1.5 text-[10px] leading-4 font-semibold text-muted ${className}`}
      title={t('Teller i styrkenivået', 'Counts towards your strength level')}
      aria-hidden="true"
    >
      <Icon name="trophy" size={10} strokeWidth={2.4} />
      {t('Nivå', 'Level')}
    </span>
  );
}
