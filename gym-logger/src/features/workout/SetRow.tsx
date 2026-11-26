import { useEffect, useRef, useState } from 'react';
import type { ExerciseKind, WorkoutSet } from '../../db/types';
import { SET_TYPE_SHORT } from '../../db/types';
import { toggleSetDone, updateSet } from '../../db/repo';
import { fromDisplay, num, parseNum, toDisplay } from '../../lib/format';
import { formatSetShort, kindColumns } from '../../lib/kinds';
import { useNow } from './restTimer';
import { PR_LABEL, type PRKind } from '../../lib/calc';
import { buzz } from '../../lib/haptics';
import { Icon } from '../../components/Icon';
import { PRBadge } from '../../components/ui';
import { t } from '../../i18n';

const TYPE_COLOR: Record<WorkoutSet['set_type'], string> = {
  normal: 'text-muted',
  warmup: 'text-warn',
  drop: 'text-sky-400',
  failure: 'text-danger',
};

/**
 * Felt som holder egen tekst mens du skriver, og lagrer når du forlater feltet.
 * Enter kaller `onEnter` med verdien (som da lagres der, ikke ved blur).
 */
function NumField({
  value,
  onCommit,
  onEnter,
  label,
  decimal,
  done,
  field,
  placeholder = '0',
}: {
  value: number;
  onCommit: (v: number) => void;
  onEnter: (v: number, el: HTMLInputElement) => void;
  label: string;
  decimal?: boolean;
  done: boolean;
  field: 'weight' | 'reps';
  placeholder?: string;
}) {
  const show = (v: number) => (v ? num(v, 2) : '');
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  // Satt når Enter har tatt seg av lagringen, så blur ikke lagrer en gang til.
  const handled = useRef(false);
  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);
  return (
    <input
      aria-label={label}
      data-field={field}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint={field === 'weight' ? 'next' : 'done'}
      className={`font-num h-12 w-full min-w-0 rounded-xl border text-center text-xl font-bold outline-none transition-colors placeholder:text-sm placeholder:font-medium placeholder:text-faint focus:border-green focus:bg-bg ${
        done ? 'border-transparent bg-green-dim/50 text-green-light' : 'border-line bg-raised'
      }`}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        handled.current = false;
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (handled.current) return;
        const v = parseNum(text);
        if (v !== value) onCommit(Math.max(0, v));
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        handled.current = true;
        onEnter(Math.max(0, parseNum(text)), e.currentTarget);
      }}
    />
  );
}

/** Flytter fokus til vektfeltet i neste uferdige set (i hele økta). */
function focusNextSet(from: HTMLElement) {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-set-row]')];
  const i = rows.indexOf(from.closest('[data-set-row]') as HTMLElement);
  const next = rows.slice(i + 1).find((r) => r.dataset.done !== '1');
  const input = next?.querySelector<HTMLInputElement>('[data-field="weight"]');
  if (input) {
    input.focus();
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else {
    from.blur();
  }
}

export const SET_GRID = 'grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_4rem_3.25rem] items-center gap-2';

export function SetRow({
  set,
  label,
  previous,
  unit,
  prs,
  onCompleted,
  onMenu,
  targetReps,
  kind = 'weight',
  current,
}: {
  set: WorkoutSet;
  /** Nummer for vanlige sets. */
  label: number | string;
  previous?: WorkoutSet;
  unit: 'kg' | 'lbs';
  prs?: PRKind[];
  onCompleted: () => void;
  onMenu: () => void;
  /** Mål-reps fra rutinen, vist som hint i et tomt reps-felt. */
  targetReps?: number | null;
  kind?: ExerciseKind;
  /** Neste set som skal gjøres i økta («du er her»). */
  current?: boolean;
}) {
  const done = !!set.completed_at;
  const [timingFrom, setTimingFrom] = useState<number | null>(null);
  const now = useNow(250, timingFrom !== null);
  const complete = async () => {
    if (await toggleSetDone(set.id)) {
      void buzz(20);
      onCompleted();
    }
  };
  // Tidsøvelser: tomt set + ✓ starter tidtaking; neste trykk stopper, fyller inn sekundene og fullfører.
  const usesStopwatch = kind === 'time' && !done && (set.reps === 0 || timingFrom !== null);
  const onCheck = async () => {
    if (!usesStopwatch) return complete();
    if (timingFrom === null) {
      setTimingFrom(Date.now());
      void buzz(10);
      return;
    }
    const secs = Math.max(1, Math.round((Date.now() - timingFrom) / 1000));
    setTimingFrom(null);
    await updateSet(set.id, { reps: secs });
    await complete();
  };
  const prevLabel = previous ? formatSetShort(previous, kind, unit) : '–';
  const short = SET_TYPE_SHORT[set.set_type];
  const cols = kindColumns(kind, unit);
  const firstIsDistance = kind === 'cardio';
  const firstValue = firstIsDistance ? (set.distance_km ?? 0) : toDisplay(set.weight, unit);
  const saveFirst = (v: number) =>
    updateSet(set.id, firstIsDistance ? { distance_km: v } : { weight: fromDisplay(v, unit) });
  const secondLabel = kind === 'time' ? t('Sekunder', 'Seconds') : kind === 'cardio' ? t('Minutter', 'Minutes') : 'Reps';
  const firstLabel = kind === 'cardio' ? t('Distanse', 'Distance') : kind === 'weight' ? t('Vekt', 'Weight') : t('Ekstra vekt', 'Extra weight');
  return (
    <div
      className={`rounded-2xl transition-colors ${done ? 'bg-green-dim/25' : current ? 'bg-raised/60 ring-1 ring-green/50' : ''}`}
      data-set-row
      data-done={done ? '1' : '0'}
      aria-current={current ? 'step' : undefined}
    >
      <div className={`${SET_GRID} px-1 py-1`}>
        <button
          type="button"
          onClick={onMenu}
          aria-label={`Set ${label}, ${t('rediger', 'edit')}`}
          className={`font-num h-11 rounded-xl text-center text-lg font-bold active:bg-raised ${TYPE_COLOR[set.set_type]}`}
        >
          {short || label}
        </button>
        <button
          type="button"
          className="font-num truncate text-left text-sm text-faint active:text-muted"
          aria-label={previous ? `${t('Bruk forrige', 'Use previous')}: ${prevLabel}` : t('Ingen forrige', 'No previous')}
          onClick={() =>
            previous && void updateSet(set.id, { weight: previous.weight, reps: previous.reps, distance_km: previous.distance_km ?? null })
          }
        >
          {prevLabel}
        </button>
        <NumField
          label={kind === 'weight' ? `${t('Vekt', 'Weight')} set ${label} (${unit})` : `${firstLabel} set ${label} (${cols.first.replace('+', '')})`}
          field="weight"
          decimal
          done={done}
          value={firstValue}
          placeholder={kind === 'weight' ? '0' : '–'}
          onCommit={(v) => void saveFirst(v)}
          onEnter={(v, el) => {
            if (v !== firstValue) void saveFirst(v);
            el.closest('[data-set-row]')?.querySelector<HTMLInputElement>('[data-field="reps"]')?.focus();
          }}
        />
        <NumField
          label={`${secondLabel} set ${label}`}
          field="reps"
          done={done}
          value={timingFrom !== null ? Math.round((now - timingFrom) / 1000) : set.reps}
          placeholder={targetReps ? `${t('mål', 'goal')} ${targetReps}` : kind === 'time' ? t('sek', 'sec') : kind === 'cardio' ? 'min' : '0'}
          onCommit={(v) => void updateSet(set.id, { reps: Math.round(v) })}
          onEnter={async (v, el) => {
            // Lagre først, så fullføre: rekkefølgen hindrer at fullføringen overskriver reps.
            if (Math.round(v) !== set.reps) await updateSet(set.id, { reps: Math.round(v) });
            if (!done) await complete();
            focusNextSet(el);
          }}
        />
        <button
          type="button"
          aria-label={
            done
              ? `${t('Angre set', 'Undo set')} ${label}`
              : usesStopwatch
                ? timingFrom === null
                  ? `${t('Start tidtaking set', 'Start timing set')} ${label}`
                  : `${t('Stopp tidtaking set', 'Stop timing set')} ${label}`
                : `${t('Fullfør set', 'Complete set')} ${label}`
          }
          aria-pressed={done}
          className={`grid h-12 w-[3.25rem] place-items-center rounded-xl transition ${
            done
              ? 'animate-pop bg-green text-black shadow-glow'
              : timingFrom !== null
                ? 'animate-pulse border border-green bg-green-dim text-green-light'
                : 'border border-line bg-raised text-faint active:bg-line'
          }`}
          onClick={() => void onCheck()}
        >
          <Icon name={usesStopwatch ? 'stopwatch' : 'check'} strokeWidth={usesStopwatch ? 2.2 : 3} />
        </button>
      </div>
      {prs && prs.length > 0 && (
        <div className="flex flex-wrap gap-1 pr-1 pb-2 pl-12">
          {prs.map((p) => (
            <PRBadge key={p} label={PR_LABEL[p]} />
          ))}
        </div>
      )}
    </div>
  );
}
