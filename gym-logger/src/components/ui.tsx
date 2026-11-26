import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-green text-black font-semibold active:bg-green-light',
  secondary: 'bg-raised text-ink border border-line active:bg-line',
  ghost: 'text-green active:bg-raised',
  danger: 'bg-raised text-danger border border-line active:bg-line',
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base transition-colors disabled:opacity-40 ${
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
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center rounded-xl text-muted active:bg-raised ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
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
            <IconButton icon="back" label="Tilbake" onClick={() => navigate(-1)} />
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
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-green-dim/50 text-green">
        <Icon name={icon} size={30} />
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Lukk" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`pb-safe relative flex w-full max-w-xl flex-col rounded-t-3xl border-t border-line bg-surface ${
          tall ? 'h-[88vh]' : 'max-h-[88vh]'
        }`}
      >
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          <IconButton icon="x" label="Lukk" onClick={onClose} />
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

/** Tall med − og + på hver side. */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  label,
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-center rounded-xl border border-line bg-raised" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} minus`} className="grid size-11 place-items-center text-green active:bg-line rounded-l-xl" onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <span className="tabular min-w-12 flex-1 text-center font-semibold">{format(value)}</span>
      <button type="button" aria-label={`${label} pluss`} className="grid size-11 place-items-center text-green active:bg-line rounded-r-xl" onClick={() => onChange(clamp(value + step))}>
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
        active ? 'border-green bg-green-dim text-green-light' : 'border-line bg-raised text-muted'
      }`}
    >
      {children}
    </button>
  );
}

export function PRBadge({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-dim px-2 py-0.5 text-xs font-semibold text-green-light">
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
    <div className="rounded-xl border border-line bg-surface py-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export const inputClass =
  'min-h-12 w-full rounded-xl border border-line bg-raised px-3 text-base outline-none placeholder:text-faint focus:border-green';
