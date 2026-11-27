// Emblem for styrkenivå: flat sekskant med 1–3 chevroner. Grått for de laveste nivåene, brukerens
// aksentfarge for resten, gull med laurbær for Olympia. Farger settes med style, så CSS-variabler virker.

/** Farger for emblemet. `accent`/`on` kan være CSS-variabler (appen) eller faste farger (delekort). */
export interface EmblemPalette {
  accent: string;
  on: string;
}
const CSS_PALETTE: EmblemPalette = { accent: 'var(--color-accent)', on: 'var(--color-on-accent)' };
const GOLD = '#e2b93b';

export function tierColors(index: number, p: EmblemPalette = CSS_PALETTE) {
  if (index >= 9) return { fill: GOLD, line: GOLD, mark: '#1a1300' };
  if (index >= 6) return { fill: p.accent, line: p.accent, mark: p.on };
  if (index >= 3) return { fill: '#1c1c1e', line: p.accent, mark: p.accent };
  return { fill: '#1c1c1e', line: '#6c6c72', mark: '#a1a1a6' };
}

/** Tekstfarge for et nivå: grå for de laveste, aksent for resten, gull for Olympia. */
export function tierAccent(index: number, accent = 'var(--color-accent-strong)'): string {
  return index >= 9 ? GOLD : index >= 3 ? accent : 'var(--color-muted)';
}

const HEX = 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z';
const HEX_IN = 'M50 13 L82 31.5 L82 68.5 L50 87 L18 68.5 L18 31.5 Z';

function Chevrons({ n, color }: { n: number; color: string }) {
  const h = 11;
  const total = n * h + (n - 1) * 3;
  const top = 50 - total / 2;
  return (
    <g fill="none" style={{ stroke: color }} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
      {Array.from({ length: n }, (_, i) => {
        const y = top + i * (h + 3);
        return <path key={i} d={`M33 ${y + h} L50 ${y} L67 ${y + h}`} />;
      })}
    </g>
  );
}

function Laurel({ color }: { color: string }) {
  const leaves = [0, 1, 2, 3, 4];
  return (
    <g style={{ fill: color }}>
      {leaves.map((i) => (
        <g key={i}>
          <ellipse cx={30 - i * 1.2} cy={70 - i * 8} rx={3.2} ry={6.5} transform={`rotate(${-35 + i * 6} ${30 - i * 1.2} ${70 - i * 8})`} />
          <ellipse cx={70 + i * 1.2} cy={70 - i * 8} rx={3.2} ry={6.5} transform={`rotate(${35 - i * 6} ${70 + i * 1.2} ${70 - i * 8})`} />
        </g>
      ))}
    </g>
  );
}

function Star({ color }: { color: string }) {
  return <path d="M50 30 L55.9 42 L69 43.8 L59.5 53 L61.8 66 L50 59.8 L38.2 66 L40.5 53 L31 43.8 L44.1 42 Z" style={{ fill: color }} />;
}

/** Emblem som SVG-element. `palette` brukes på delekort, der CSS-variabler ikke finnes. */
export function TierEmblem({ index, size = 48, palette }: { index: number; size?: number; palette?: EmblemPalette; idPrefix?: string }) {
  const c = tierColors(index, palette);
  const gold = index >= 9;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d={HEX} style={{ fill: c.fill, stroke: c.line }} strokeWidth={3} strokeLinejoin="round" />
      {index >= 3 && index < 6 && <path d={HEX_IN} fill="none" style={{ stroke: c.line }} strokeOpacity={0.5} strokeWidth={1.5} strokeLinejoin="round" />}
      {gold ? (
        <>
          <Laurel color={c.mark} />
          <Star color={c.mark} />
        </>
      ) : (
        <Chevrons n={(index % 3) + 1} color={c.mark} />
      )}
    </svg>
  );
}
