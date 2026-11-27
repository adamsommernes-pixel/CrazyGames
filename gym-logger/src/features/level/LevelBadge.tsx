import { Link } from 'react-router-dom';
import { TierEmblem, tierAccent } from '../../components/TierBadge';
import { tierAt, TIER_COUNT, type StrengthProfile } from '../../lib/strength';
import { t } from '../../i18n';

/** Nivåmerket under hilsenen på Hjem. Trykk for hele stigen. */
export function LevelBadge({ strength }: { strength: StrengthProfile }) {
  const { tier, progress, score } = strength;
  const top = tier.index === TIER_COUNT - 1;
  const next = top ? null : tierAt(tier.index + 1);
  const accent = tierAccent(tier.index);
  return (
    <Link
      to="/level"
      aria-label={t(
        `Styrkenivå: ${tier.name}, ${Math.floor(score)} poeng. Se nivåene`,
        `Strength level: ${tier.name}, ${Math.floor(score)} points. See the levels`,
      )}
      className="mt-2 flex max-w-xs items-center gap-2.5 rounded-xl border border-line bg-surface/80 py-1.5 pr-3 pl-1.5 transition active:scale-[0.98]"
    >
      <span className="shrink-0">
        <TierEmblem index={tier.index} size={34} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-num truncate text-sm font-bold" style={{ color: accent }}>
            {tier.name}
          </span>
          <span className="font-num shrink-0 text-[11px] text-faint">
            {next ? `${Math.floor(score)} / ${next.min}` : `${Math.floor(score)}`}
          </span>
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-raised">
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${progress * 100}%`, background: accent }} />
        </span>
      </span>
    </Link>
  );
}
