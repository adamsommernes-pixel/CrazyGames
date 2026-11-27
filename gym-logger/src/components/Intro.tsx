import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

// Intro hver gang appen åpnes: logo og navn i 1,5 s, så flyr logoen opp til logoen i hjørnet
// på Hjem mens appen kommer fram under. Appen laster i mellomtiden, så det koster ingen ekstra tid.

const MIN_MS = 1500;
const MAX_MS = 4000;
const FLY_MS = 650;

const skip = () => {
  try {
    return localStorage.getItem('repgrade-skip-intro') === '1'; // bare for automatiske tester
  } catch {
    return false;
  }
};

/** Appen er klar når lasteskjermen bak er borte. */
const appReady = () => !!document.querySelector('#root') && !document.querySelector('[data-splash]');

export function Intro() {
  const [phase, setPhase] = useState<'show' | 'fly' | 'done'>(() => (skip() ? 'done' : 'show'));
  const logo = useRef<HTMLSpanElement>(null);
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (phase !== 'show') return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      if ((elapsed >= MIN_MS && appReady()) || elapsed >= MAX_MS) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const from = logo.current?.getBoundingClientRect();
        const target = document.querySelector<HTMLElement>('[data-logo-anchor]')?.getBoundingClientRect();
        if (from && !reduced) {
          // Mål: logoen på Hjem, ellers øverst til venstre.
          const to = target && target.width > 0 ? target : new DOMRect(16, 24, 20, 20);
          const scale = to.width / from.width;
          const dx = to.left + to.width / 2 - (from.left + from.width / 2);
          const dy = to.top + to.height / 2 - (from.top + from.height / 2);
          setFlyStyle({ transform: `translate(${dx}px, ${dy}px) scale(${scale})` });
        }
        setPhase('fly');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'fly') return;
    const id = setTimeout(() => setPhase('done'), FLY_MS + 50);
    return () => clearTimeout(id);
  }, [phase]);

  if (phase === 'done') return null;
  const flying = phase === 'fly';
  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" role="status" aria-label={t('Laster RepGrade', 'Loading RepGrade')} data-intro={phase}>
      <div
        className="absolute inset-0 bg-bg"
        style={{ opacity: flying ? 0 : 1, transition: `opacity ${FLY_MS}ms ease-in ${flying ? 120 : 0}ms` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="flex flex-col items-center">
          <span ref={logo} className="block" style={{ ...flyStyle, transition: `transform ${FLY_MS}ms cubic-bezier(0.65, 0, 0.35, 1)` }}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={88} height={88} alt="" className="intro-logo block rounded-[22%]" />
          </span>
          <span className="mt-4" style={{ opacity: flying ? 0 : 1, transition: 'opacity 200ms' }}>
            <span className="intro-name font-num block text-3xl font-bold tracking-tight">RepGrade</span>
          </span>
          <span className="mt-6 h-0.5 w-28 overflow-hidden rounded-full bg-line" style={{ opacity: flying ? 0 : 1, transition: 'opacity 200ms' }}>
            <span className="intro-bar block h-full rounded-full bg-accent" />
          </span>
        </div>
      </div>
    </div>
  );
}
