import { useState } from 'react';
import { IconButton } from './ui';
import { locale, t } from '../i18n';

const dayNames = () => (t('ma ti on to fr lø sø', 'mo tu we th fr sa su')).split(' ');
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Månedskalender med markerte treningsdager. */
export function Calendar({
  marked,
  selected,
  onSelect,
}: {
  marked: Set<string>;
  selected: string | null;
  onSelect: (dayKey: string | null) => void;
}) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = key(new Date());
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const title = month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const count = cells.filter((d) => d && marked.has(key(d))).length;

  return (
    <div className="card rounded-xl p-3">
      <div className="mb-2 flex items-center">
        <IconButton icon="back" label={t('Forrige måned', 'Previous month')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <div className="flex-1 text-center">
          <div className="font-semibold first-letter:uppercase">{title}</div>
          <div className="text-xs text-muted">{count} {t('treningsdager', 'training days')}</div>
        </div>
        <IconButton icon="chevron" label={t('Neste måned', 'Next month')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {dayNames().map((d) => (
          <div key={d} className="pb-1 text-[11px] font-semibold text-faint uppercase">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const k = key(d);
          const has = marked.has(k);
          const sel = selected === k;
          return (
            <button
              key={k}
              type="button"
              disabled={!has}
              onClick={() => onSelect(sel ? null : k)}
              aria-label={`${d.getDate()}. ${has ? t('trent', 'trained') : ''}`}
              aria-pressed={sel}
              className={`font-num relative grid aspect-square place-items-center rounded-xl text-sm transition ${
                sel ? 'bg-accent font-bold text-on-accent' : has ? 'bg-accent-soft/60 font-bold text-accent-strong' : 'text-faint'
              } ${k === today && !sel ? 'ring-1 ring-accent/60' : ''}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const dayKey = (iso: string) => key(new Date(iso));
