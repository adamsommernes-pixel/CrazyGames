// Enkle strek-ikoner (24×24), arver farge fra tekst.
const PATHS = {
  dumbbell: 'M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-6',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 6l6 6-6 6',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16M12 10v4l2 2M9 2h6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  play: 'M7 4l13 8-13 8V4',
  cloud: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
  edit: 'M4 20h4L19 9l-4-4L4 16v4M13 7l4 4',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v8h14v-8',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  scale: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.8-1.8',
  flame: 'M12 22c4 0 7-3 7-7 0-5-4-7-5-11-2 2-3 4-3 6-1-1-2-2-2-4-2 2-4 5-4 9 0 4 3 7 7 7',
  plates: 'M3 12h3M18 12h3M6 7v10M9 5v14M15 5v14M18 7v10M9 12h6',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 12h.01',
  note: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h5',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 11v5M12 8h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  swap: 'M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  stopwatch: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16M12 10v4M9 2h6M19 6l1.5-1.5',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5M4 19a2 2 0 0 1 2-2h13',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className = '', strokeWidth = 2, filled = false }: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** Fyll formen (f.eks. en valgt stjerne). */
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
