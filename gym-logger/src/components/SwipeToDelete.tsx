import { useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { buzz } from '../lib/haptics';
import { t } from '../i18n';

/** Hvor langt (andel av bredden) man må dra før raden slettes. */
const THRESHOLD = 0.4;

/**
 * Dra raden til venstre for å slette. Et kort drag spretter tilbake. Vertikal scrolling påvirkes
 * ikke: draget tas først når bevegelsen er tydelig sidelengs.
 */
export function SwipeToDelete({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; active: boolean } | null>(null);
  const width = useRef(1);
  const armed = Math.abs(dx) > width.current * THRESHOLD;

  const end = () => {
    const s = start.current;
    start.current = null;
    if (!s?.active) return;
    if (armed) {
      setGone(true);
      setDx(-width.current);
      void buzz(15);
      setTimeout(onDelete, 160);
    } else setDx(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl" data-swipe-row>
      <div
        className={`absolute inset-0 flex items-center justify-end gap-2 rounded-xl pr-4 text-sm font-semibold transition-colors ${armed ? 'bg-danger text-white' : 'bg-danger/25 text-danger'}`}
        aria-hidden="true"
        style={{ opacity: dx ? 1 : 0 }}
      >
        <Icon name="trash" size={18} />
        {t('Slett', 'Delete')}
      </div>
      <div
        className="relative bg-surface"
        style={{ transform: `translateX(${dx}px)`, transition: start.current?.active ? 'none' : 'transform 180ms ease', touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (gone || (e.pointerType === 'mouse' && e.button !== 0)) return;
          width.current = e.currentTarget.offsetWidth || 1;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (!s.active) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) return void (start.current = null);
            if (mx > -12 || Math.abs(mx) < Math.abs(my) * 1.5) return;
            s.active = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            (document.activeElement as HTMLElement | null)?.blur?.();
          }
          setDx(Math.min(0, mx));
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
