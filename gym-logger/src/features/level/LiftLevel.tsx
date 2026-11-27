import { Link } from 'react-router-dom';
import { TierEmblem, tierAccent } from '../../components/TierBadge';
import { useStrength } from '../../lib/strengthLive';
import { ACTIVE_DAYS, TIER_COUNT, isRanked, tierAt } from '../../lib/strength';
import { useSetting } from '../../lib/settings';
import { num, toDisplay } from '../../lib/format';
import { t } from '../../i18n';

/** Nivået for ett løft på øvelsessiden. Vises bare for rangerte øvelser. */
export function LiftLevel({ exerciseId }: { exerciseId: string }) {
  const data = useStrength();
  const unit = useSetting('unit');
  if (!isRanked(exerciseId) || !data) return null;
  const lift = data.profile.lifts.find((l) => l.exerciseId === exerciseId);
  const kg = (v: number) => {
    const shown = lift?.bodyweightLoad ? Math.max(0, v - data.bw) : v;
    return `${lift?.bodyweightLoad ? '+' : ''}${num(toDisplay(shown, unit), 1)} ${unit}`;
  };
  const next = lift && lift.tier.index < TIER_COUNT - 1 ? tierAt(lift.tier.index + 1) : null;
  return (
    <Link to="/level" className={`mt-3 flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2.5 ${lift && !lift.active ? 'opacity-60 grayscale' : ''}`}>
      <TierEmblem index={lift?.tier.index ?? 0} size={36} />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold" style={lift ? { color: tierAccent(lift.tier.index) } : undefined}>
          {lift ? lift.tier.name : t('Rangert løft', 'Ranked lift')}
        </div>
        <div className="text-xs text-muted">
          {lift && !lift.active
            ? t(`Ikke trent siste ${ACTIVE_DAYS} dager, teller ikke i nivået nå.`, `Not trained in the last ${ACTIVE_DAYS} days, so it does not count in your level now.`)
            : lift
            ? next && lift.nextTierKg
              ? t(`1RM nå ${kg(lift.e1rm)}. Klarer du ${kg(lift.nextTierKg)}, blir du ${next.name}.`, `1RM now ${kg(lift.e1rm)}. Lift ${kg(lift.nextTierKg)} to reach ${next.name}.`)
              : t(`1RM ${kg(lift.e1rm)} · toppnivået`, `1RM ${kg(lift.e1rm)} · top level`)
            : t('Logg et set for å få nivå på dette løftet.', 'Log a set to get a level on this lift.')}
        </div>
      </div>
    </Link>
  );
}
