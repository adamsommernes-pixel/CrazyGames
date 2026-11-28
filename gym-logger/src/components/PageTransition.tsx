import { useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Hovedfanene i bunnmenyen: bytte mellom dem tones, alt annet glir. */
const TABS = new Set(['/', '/history', '/social', '/progress', '/profile', '/workout']);

export type NavDirection = 'forward' | 'back' | 'fade';

/** Retning for en navigasjon: tilbake (POP til lavere indeks), fram, eller fane-bytte. */
export function navDirection(fromPath: string, toPath: string, type: 'POP' | 'PUSH' | 'REPLACE', fromIdx: number | null, toIdx: number | null): NavDirection {
  if (TABS.has(fromPath) && TABS.has(toPath)) return 'fade';
  if (type === 'POP') return fromIdx !== null && toIdx !== null && toIdx > fromIdx ? 'forward' : 'back';
  if (type === 'REPLACE') return 'fade';
  return 'forward';
}

const historyIdx = () => {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
};

/**
 * Myk overgang mellom sider: ny side glir inn fra høyre, tilbake glir inn fra venstre, og
 * fanene i bunnmenyen tones. Bare transform og opasitet, så det er billig. Slått av ved redusert bevegelse.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const type = useNavigationType();
  const prev = useRef<{ path: string; idx: number | null; key: string } | null>(null);
  const dir = useRef<NavDirection | null>(null);
  if (prev.current?.key !== location.key) {
    const idx = historyIdx();
    dir.current = prev.current ? navDirection(prev.current.path, location.pathname, type, prev.current.idx, idx) : null;
    prev.current = { path: location.pathname, idx, key: location.key };
  }
  return (
    <div key={location.pathname} className={dir.current ? `page-${dir.current}` : undefined}>
      {children}
    </div>
  );
}
