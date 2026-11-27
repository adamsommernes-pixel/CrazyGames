import { lockScroll, unlockScroll } from '../lib/scrollLock';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { t } from '../i18n';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent font-semibold active:bg-accent-strong active:scale-[0.98]',
  secondary: 'bg-raised text-ink border border-line font-medium active:bg-line active:scale-[0.98]',
  ghost: 'text-accent font-medium active:bg-raised',
  danger: 'bg-raised text-danger border border-line font-medium active:bg-line',
};

export function Button({
  variant = 'primary',
  icon,
  full,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; full?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-base transition disabled:opacity-40 disabled:shadow-none ${
        VARIANTS[variant]
      } ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className = '',
  filled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; filled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center rounded-xl text-muted active:bg-raised ${className}`}
      {...rest}
    >
      <Icon name={icon} filled={filled} />
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card rounded-3xl ${className}`}>{children}</div>;
}

/** Sidehode med valgfri tilbakeknapp og handlinger til høyre. */
export function Page({
  title,
  back,
  actions,
  children,
}: {
  title: ReactNode;
  back?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex min-h-14 items-center gap-1 px-2">
          {back ? (
            <IconButton icon="back" label={t('Tilbake', 'Back')} onClick={() => navigate(-1)} />
          ) : (
            <span className="w-2" />
          )}
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
          {actions}
        </div>
      </header>
      <main className="px-4 pt-4 pb-40">{children}</main>
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: {
  icon: IconName;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="relative mb-5 grid size-20 place-items-center">
        <div className="absolute inset-0 rounded-full bg-accent/10 blur-xl" />
        <div className="relative grid size-20 place-items-center rounded-full border border-accent/30 bg-accent-soft/40 text-accent">
          <Icon name={icon} size={34} strokeWidth={1.6} />
        </div>
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 max-w-xs text-muted">{text}</p>}
      {children && <div className="mt-6 w-full max-w-xs">{children}</div>}
    </div>
  );
}

/** Ark som glir opp fra bunnen. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tall?: boolean;
}) {
  // Escape lukker arket. onClose i en ref, så effekten ikke kjøres på nytt ved hver tegning.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={t('Lukk', 'Close')} className="absolute inset-0 animate-fade bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`pb-safe relative flex w-full max-w-xl animate-sheet flex-col rounded-t-[28px] border-t border-line bg-surface shadow-[0_-12px_40px_rgb(0_0_0/0.6)] ${
          tall ? 'h-[88vh]' : 'max-h-[88vh]'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center gap-2 px-4 pt-2 pb-2">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          <IconButton icon="x" label={t('Lukk', 'Close')} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}

/** Liste med valg i et ark (brukes som meny). */
export function ActionList({ actions }: {
  actions: { label: string; icon?: IconName; danger?: boolean; onClick: () => void }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {actions.map((a) => (
        <Button key={a.label} variant={a.danger ? 'danger' : 'secondary'} icon={a.icon} full onClick={a.onClick} className="justify-start">
          {a.label}
        </Button>
      ))}
    </div>
  );
}

/** Holder knappen inne → gjentar handlingen raskere og raskere. */
function useRepeat(fn: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    stop();
    fnRef.current();
    let delay = 380;
    const loop = () => {
      fnRef.current();
      delay = Math.max(50, delay * 0.8);
      timer.current = setTimeout(loop, delay);
    };
    timer.current = setTimeout(loop, delay);
  };
  useEffect(() => stop, []);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fnRef.current();
      }
    },
  };
}

/** Tall med − og + på hver side. Hold inne for å endre raskt. */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  label,
  format = (v: number) => String(v),
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  format?: (v: number) => string;
  size?: 'md' | 'lg';
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  const change = (d: number) => {
    const next = clamp(valueRef.current + d);
    valueRef.current = next;
    onChange(next);
  };
  const minus = useRepeat(() => change(-step));
  const plus = useRepeat(() => change(step));
  const btn = `grid place-items-center text-accent active:bg-line select-none touch-none ${size === 'lg' ? 'size-14 text-2xl' : 'size-11 text-xl'}`;
  return (
    <div className="flex items-center rounded-2xl border border-line bg-raised" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} minus`} className={`${btn} rounded-l-2xl`} {...minus}>
        −
      </button>
      <span className={`font-num min-w-12 flex-1 text-center font-bold ${size === 'lg' ? 'text-3xl' : 'text-lg'}`} aria-live="polite">
        {format(value)}
      </span>
      <button type="button" aria-label={`${label} pluss`} className={`${btn} rounded-r-2xl`} {...plus}>
        +
      </button>
    </div>
  );
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${
        active ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-raised text-muted'
      }`}
    >
      {children}
    </button>
  );
}

export function PRBadge({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
      <Icon name="trophy" size={13} />
      {label ?? 'PR'}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{children}</h2>;
}

/** Liten nøkkeltall-boks. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card rounded-2xl py-2.5 text-center">
      <div className="font-num text-xl font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export const inputClass =
  'min-h-12 w-full rounded-xl border border-line bg-raised px-3 text-base outline-none placeholder:text-faint focus:border-accent';
