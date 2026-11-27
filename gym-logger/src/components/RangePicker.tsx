import { useSetting, setSetting } from '../lib/settings';
import type { Range } from '../lib/range';
import { t } from '../i18n';

/** Valgt tidsrom (felles for alle sider). */
export function useRange(): [Range, (r: Range) => void] {
  const r = useSetting('statsRange');
  return [r, (next) => void setSetting('statsRange', next)];
}

const chip = (on: boolean) =>
  `min-h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-raised text-muted'}`;

/** 7 d · 30 d · 12 mnd · År (med valg av år). */
export function RangePicker({ value, onChange, years }: { value: Range; onChange: (r: Range) => void; years: number[] }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label={t('Tidsrom', 'Time range')}>
      {(['7d', '30d', '12m'] as const).map((k) => (
        <button key={k} type="button" aria-pressed={value.kind === k} className={chip(value.kind === k)} onClick={() => onChange({ kind: k })}>
          {k === '7d' ? t('7 d', '7 d') : k === '30d' ? t('30 d', '30 d') : t('12 mnd', '12 mo')}
        </button>
      ))}
      <label className={`relative inline-flex items-center ${chip(value.kind === 'year')}`}>
        <span>{value.kind === 'year' ? value.year : t('År', 'Year')}</span>
        <span aria-hidden="true" className="ml-1 text-[10px]">▾</span>
        <select
          aria-label={t('Velg år', 'Choose year')}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value.kind === 'year' ? String(value.year) : ''}
          onChange={(e) => onChange({ kind: 'year', year: Number(e.target.value) })}
        >
          {value.kind !== 'year' && <option value="">{t('År', 'Year')}</option>}
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
