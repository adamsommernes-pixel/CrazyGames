import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { TierEmblem, tierAccent } from './TierBadge';
import { Confetti } from './widgets';
import { TIER_COUNT, tierAt, type LevelEvent } from '../lib/strength';
import { buzz } from '../lib/haptics';
import { num, toDisplay } from '../lib/format';
import { getSetting } from '../lib/settings';
import { t } from '../i18n';

// Nytt beste løft: et kort glir ned med fremgangen, og ved nytt totalnivå kommer en
// fullskjerm «Nivå opp». Samme enkle store-mønster som toast.tsx.

export type ShownLevelEvent = LevelEvent & { id: number; exerciseLabel: string; unit: 'kg' | 'lbs'; bw: number };

let current: ShownLevelEvent | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showLevelEvent(ev: LevelEvent, exerciseLabel: string, bw: number) {
  void getSetting('unit').then((unit) => {
    current = { ...ev, id: ++seq, exerciseLabel, unit, bw };
    emit();
    const up = isLevelUp(current);
    void buzz(up ? [60, 40, 60, 40, 200] : [25, 40, 25]);
  });
}

const HEX_CLIP = 'polygon(50% 4%, 90% 27%, 90% 73%, 50% 96%, 10% 73%, 10% 27%)';

export const isLevelUp = (ev: LevelEvent) => ev.overallAfter.tier.index > ev.overallBefore.tier.index;

function close(id: number) {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

/** Teller jevnt fra `from` til `to`. */
function useTween(from: number, to: number, ms: number, delay = 0) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / ms));
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms, delay]);
  return v;
}

export function LevelHost() {
  const ev = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  if (!ev) return null;
  return isLevelUp(ev) ? <LevelUpOverlay key={ev.id} ev={ev} /> : <RecordCard key={ev.id} ev={ev} />;
}

const setText = (ev: ShownLevelEvent) => {
  const w = ev.after.bodyweightLoad ? (ev.weight > 0 ? `+${num(toDisplay(ev.weight, ev.unit), 1)} ${ev.unit}` : t('Kroppsvekt', 'Bodyweight')) : `${num(toDisplay(ev.weight, ev.unit), 1)} ${ev.unit}`;
  return `${w} × ${ev.reps}`;
};

/** Ny rekord uten nytt totalnivå: kort øverst som lukker seg selv. */
function RecordCard({ ev }: { ev: ShownLevelEvent }) {
  const [leaving, setLeaving] = useState(false);
  const before = ev.before;
  const liftUp = !before || ev.after.tier.index > before.tier.index;
  const fromScore = before && !liftUp ? before.score : ev.after.tier.min;
  const score = useTween(fromScore, ev.after.score, 1100, 300);
  const tier = ev.after.tier;
  const top = tier.index === TIER_COUNT - 1;
  const next = top ? null : tierAt(tier.index + 1);
  const progress = top ? 1 : (score - tier.min) / 10;
  const accent = tierAccent(tier.index);
  const gained = ev.after.score - (before?.score ?? 0);

  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), 3800);
    const gone = setTimeout(() => close(ev.id), 4100);
    return () => {
      clearTimeout(leave);
      clearTimeout(gone);
    };
  }, [ev.id]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-safe">
      <button
        type="button"
        role="status"
        aria-live="polite"
        onClick={() => close(ev.id)}
        className={`level-card pointer-events-auto relative mt-3 w-full max-w-md overflow-hidden rounded-3xl border bg-surface/95 p-4 text-left shadow-2xl backdrop-blur ${leaving ? 'leaving' : ''}`}
        style={{ borderColor: `${accent}66`, boxShadow: `0 10px 40px -10px ${accent}55` }}
      >
        <span className="level-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <span className="level-glow level-emblem-in shrink-0" style={{ ['--glow' as string]: accent }}>
            <TierEmblem index={tier.index} size={56} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: accent }}>
              {liftUp && before ? t('Nytt nivå på løftet', 'Lift level up') : before ? t('Ny rekord', 'New record') : t('Nytt rangert løft', 'New ranked lift')}
            </div>
            <div className="truncate font-semibold">
              {ev.exerciseLabel} · <span className="font-num">{setText(ev)}</span>
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {liftUp && before ? `${before.tier.name} → ` : ''}
              <span className="font-semibold" style={{ color: accent }}>
                {tier.name}
              </span>
              {' · '}
              <span className="font-num">+{num(gained, 1)}</span> {t('poeng', 'points')}
            </div>
          </div>
          <div className="font-num shrink-0 text-right text-2xl font-bold" aria-hidden="true">
            {num(score, 1)}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, background: accent }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-faint">
          <span>
            {t('Totalt', 'Overall')}: {ev.overallAfter.tier.name} · <span className="font-num">{num(ev.overallAfter.score, 1)}</span>
          </span>
          {next && (
            <span>
              {Math.round(Math.max(0, Math.min(1, progress)) * 100)} % {t('til', 'to')} {next.name}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

/** Nytt totalnivå: fullskjerm med lysstråler, emblem som spretter inn og konfetti. */
function LevelUpOverlay({ ev }: { ev: ShownLevelEvent }) {
  const tier = ev.overallAfter.tier;
  const accent = tierAccent(tier.index);
  const score = useTween(ev.overallBefore.score, ev.overallAfter.score, 1400, 700);
  const [fire, setFire] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const id = setTimeout(() => setFire((f) => f + 1), 650);
    btn.current?.focus({ preventScroll: true });
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
      className="fixed inset-0 z-[80] flex animate-fade flex-col items-center justify-center overflow-hidden bg-black/90 px-6 text-center backdrop-blur-sm"
    >
      <div className="level-flash pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, ${accent}aa, transparent 60%)` }} aria-hidden="true" />
      <div className="relative grid size-72 place-items-center">
        <div
          className="level-rays absolute inset-[-40%] opacity-60"
          style={{ background: `repeating-conic-gradient(from 0deg, ${accent}55 0deg 8deg, transparent 8deg 24deg)`, maskImage: 'radial-gradient(circle, black 20%, transparent 65%)', WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 65%)' }}
          aria-hidden="true"
        />
        <div className="level-pulse absolute size-48 rounded-full blur-3xl" style={{ background: accent }} aria-hidden="true" />
        <div className="level-emblem-in relative" style={{ filter: `drop-shadow(0 0 24px ${accent})` }}>
          <div className="relative overflow-hidden" style={{ clipPath: HEX_CLIP }}>
            <TierEmblem index={tier.index} size={176} />
            <span className="level-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden="true" />
          </div>
        </div>
      </div>
      <p className="level-text-in mt-2 text-sm font-bold tracking-[0.35em] uppercase" style={{ color: accent, animationDelay: '900ms' }}>
        {t('Nivå opp', 'Level up')}
      </p>
      <h2 id="level-up-title" className="level-text-in font-num mt-2 text-5xl font-bold text-ink" style={{ animationDelay: '1050ms' }}>
        {tier.name}
      </h2>
      <p className="level-text-in mt-3 text-muted" style={{ animationDelay: '1200ms' }}>
        {ev.overallBefore.tier.name} → <span style={{ color: accent }}>{tier.name}</span> · <span className="font-num">{num(score, 1)}</span> {t('poeng', 'points')}
      </p>
      <p className="level-text-in mt-1 text-sm text-faint" style={{ animationDelay: '1300ms' }}>
        {ev.exerciseLabel} · {setText(ev)}
      </p>
      <button
        ref={btn}
        type="button"
        onClick={() => close(ev.id)}
        className="level-text-in mt-10 min-h-14 w-full max-w-xs rounded-2xl font-semibold text-black"
        style={{ background: accent, animationDelay: '1500ms', boxShadow: `0 0 30px ${accent}88` }}
      >
        {t('Fortsett', 'Continue')}
      </button>
      <Confetti fire={fire} />
    </div>
  );
}
