import { useId } from 'react';

// Emblem for styrkenivå: sekskant med chevroner. Tre bånd (grått, grønt, lysende) med 1–3 chevroner,
// og Olympia i gull med laurbær. Bare faste farger, så det også kan tegnes på delekort.

const BANDS = [
  { from: '#3a423e', to: '#1c211f', line: '#7f8a84', mark: '#c9d1cc' }, // 0–2
  { from: '#1f7a45', to: '#0e2f1c', line: '#2bd66b', mark: '#e9fff1' }, // 3–5
  { from: '#2bd66b', to: '#0f5a30', line: '#7dffaa', mark: '#ffffff' }, // 6–8
];
const GOLD = { from: '#ffe28a', to: '#b8860b', line: '#fff1b8', mark: '#3b2a00' };

export function tierColors(index: number) {
  return index >= 9 ? GOLD : BANDS[Math.min(2, Math.floor(index / 3))];
}

/** Hovedfarge for tekst og glød rundt et nivå. */
export function tierAccent(index: number): string {
  return index >= 9 ? '#f5c542' : index >= 6 ? '#7dffaa' : index >= 3 ? '#2bd66b' : '#9aa59f';
}

const HEX = 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z';
const HEX_IN = 'M50 13 L82 31.5 L82 68.5 L50 87 L18 68.5 L18 31.5 Z';

function Chevrons({ n, color }: { n: number; color: string }) {
  const h = 11;
  const total = n * h + (n - 1) * 3;
  const top = 50 - total / 2;
  return (
    <g fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
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
    <g fill={color} opacity={0.95}>
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
  return <path d="M50 30 L55.9 42 L69 43.8 L59.5 53 L61.8 66 L50 59.8 L38.2 66 L40.5 53 L31 43.8 L44.1 42 Z" fill={color} />;
}

/** Emblem som SVG-element. `idPrefix` gjør gradient-id-ene unike når flere vises samtidig. */
export function TierEmblem({ index, size = 48, idPrefix }: { index: number; size?: number; idPrefix?: string }) {
  const auto = useId().replace(/:/g, '');
  const id = `tb${idPrefix ?? auto}`;
  const c = tierColors(index);
  const gold = index >= 9;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.from} />
          <stop offset="1" stopColor={c.to} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={HEX} fill={`url(#${id}g)`} stroke={c.line} strokeWidth={3} strokeLinejoin="round" />
      {index >= 3 && <path d={HEX_IN} fill="none" stroke={c.line} strokeOpacity={0.6} strokeWidth={1.5} strokeLinejoin="round" />}
      {gold ? (
        <>
          <Laurel color={c.mark} />
          <Star color={c.mark} />
        </>
      ) : (
        <Chevrons n={(index % 3) + 1} color={c.mark} />
      )}
      <path d={HEX} fill={`url(#${id}s)`} />
    </svg>
  );
}
