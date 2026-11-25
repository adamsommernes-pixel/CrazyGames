import { salon } from "@config";
import { t } from "@/i18n";
import { cx } from "@/components/ui/cx";
import { ProfileText } from "./Live";

/**
 * A drawn, map-like placeholder. A real map (with its cookies and scripts)
 * is deliberately left out of the demo; the link opens OpenStreetMap.
 */
export function MapPlaceholder({ className }: { className?: string }) {
  const { geo } = salon.contact;
  const href = `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=17/${geo.lat}/${geo.lng}`;
  return (
    <figure className={cx("relative overflow-hidden border border-line bg-tint", className)}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="h-full w-full text-line-strong" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M-10 70 L410 40" />
          <path d="M-10 160 C120 150 250 175 410 150" strokeWidth="9" stroke="var(--salon-paper)" />
          <path d="M-10 160 C120 150 250 175 410 150" />
          <path d="M-10 250 L410 230" />
          <path d="M60 -10 L90 310" />
          <path d="M175 -10 L160 310" strokeWidth="9" stroke="var(--salon-paper)" />
          <path d="M175 -10 L160 310" />
          <path d="M300 -10 L330 310" />
          <path d="M230 90 L400 100" strokeDasharray="2 4" />
        </g>
        <rect x="190" y="60" width="90" height="70" fill="var(--salon-stone)" />
        <rect x="20" y="180" width="110" height="40" fill="var(--salon-stone)" />
        <text x="196" y="122" className="label" fill="var(--salon-muted)" fontSize="8" letterSpacing="1.2">
          {t.common.park.toUpperCase()}
        </text>
      </svg>
      <span
        aria-hidden="true"
        className="absolute left-[41%] top-[53%] block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-accent"
      />
      <figcaption className="absolute bottom-0 left-0 right-0 flex flex-wrap items-end justify-between gap-2 bg-paper/90 px-4 py-3 text-small">
        <span>
          <span className="label mr-2 text-muted">{t.common.mapPlaceholder}</span>
          <ProfileText field="addressLine" />
        </span>
        <a href={href} className="link font-medium" rel="noopener" target="_blank">
          {t.common.openMap}<span className="sr-only"> {t.common.newTab}</span>
        </a>
      </figcaption>
    </figure>
  );
}
