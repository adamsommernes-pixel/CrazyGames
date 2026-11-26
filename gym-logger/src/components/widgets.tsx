import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { passwordStrength } from '../auth/crypto';
import { inputClass } from './ui';
import { t } from '../i18n';

/** Ring som viser fremdrift (f.eks. ukemål). Fylles med en kort animasjon. */
export function ProgressRing({
  value,
  max,
  size = 132,
  stroke = 12,
  children,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-green)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.2,0.9,0.3,1)', filter: pct >= 1 ? 'drop-shadow(0 0 8px rgb(43 214 107 / 0.6))' : undefined }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, color, size = 48 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="font-num grid shrink-0 place-items-center rounded-full font-bold text-black"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38, boxShadow: `0 0 0 3px var(--color-bg), 0 0 0 4px ${color}55` }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

const days = () => (t('MTOTFLS', 'MTWTFSS')).split('');

/** Ukas dager med markering for treningsdager og i dag. */
export function WeekStrip({ trained, today }: { trained: boolean[]; today: number }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label={t('Treningsdager denne uka', 'Training days this week')}>
      {days().map((d, i) => (
        <li key={i} className="flex flex-col items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${i === today ? 'text-ink' : 'text-faint'}`}>{d}</span>
          <span
            className={`grid size-8 place-items-center rounded-full border ${
              trained[i]
                ? 'border-green bg-green text-black'
                : i === today
                  ? 'border-green/60 text-green'
                  : 'border-line text-transparent'
            }`}
            aria-label={trained[i] ? t('Trent', 'Trained') : i === today ? t('I dag', 'Today') : t('Ikke trent', 'Not trained')}
          >
            <Icon name="check" size={14} strokeWidth={3.5} />
          </span>
        </li>
      ))}
    </ol>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showStrength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const strength = passwordStrength(value);
  const words = ['', t('Svakt', 'Weak'), t('Greit', 'Fair'), t('Bra', 'Good'), t('Sterkt', 'Strong')];
  const colors = ['bg-line', 'bg-danger', 'bg-warn', 'bg-green', 'bg-green-light'];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={`${inputClass} pr-20`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-sm font-medium text-green" onClick={() => setShow((s) => !s)}>
          {show ? t('Skjul', 'Hide') : t('Vis', 'Show')}
        </button>
      </div>
      {showStrength && value && (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1 rounded-full ${i <= strength ? colors[strength] : 'bg-line'}`} />
            ))}
          </div>
          <span className="w-14 text-right text-xs text-muted">{words[strength]}</span>
        </div>
      )}
    </div>
  );
}

/** Kort konfetti-gnist til PR-er. Tegnes på canvas og fjerner seg selv. */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#2bd66b', '#7dffaa', '#f2f5f3', '#0f3b22'];
    const parts = Array.from({ length: 90 }, () => ({
      x: innerWidth / 2,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 12 - 4,
      s: Math.random() * 6 + 3,
      r: Math.random() * Math.PI,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.15;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - frame / 90);
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (++frame < 90) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" aria-hidden="true" />;
}

/** Steg-prikker for veivisere. */
export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={t(`Steg ${step + 1} av ${total}`, `Step ${step + 1} of ${total}`)}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-green' : i < step ? 'w-1.5 bg-green/60' : 'w-1.5 bg-line'}`} />
      ))}
    </div>
  );
}
