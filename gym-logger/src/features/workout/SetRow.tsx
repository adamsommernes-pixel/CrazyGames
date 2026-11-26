import { useEffect, useState } from 'react';
import type { WorkoutSet } from '../../db/types';
import { SET_TYPE_SHORT } from '../../db/types';
import { toggleSetDone, updateSet } from '../../db/repo';
import { fromDisplay, num, parseNum, toDisplay } from '../../lib/format';
import { PR_LABEL, type PRKind } from '../../lib/calc';
import { buzz } from '../../lib/haptics';
import { Icon } from '../../components/Icon';
import { PRBadge } from '../../components/ui';

const TYPE_COLOR: Record<WorkoutSet['set_type'], string> = {
  normal: 'text-muted',
  warmup: 'text-warn',
  drop: 'text-sky-400',
  failure: 'text-danger',
};

/** Felt som holder egen tekst mens du skriver, og lagrer når du forlater feltet. */
function NumField({
  value,
  onCommit,
  label,
  decimal,
  done,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  decimal?: boolean;
  done: boolean;
}) {
  const show = (v: number) => (v ? num(v, 2) : '');
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);
  return (
    <input
      aria-label={label}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      className={`font-num h-12 w-full min-w-0 rounded-xl border text-center text-xl font-bold outline-none transition-colors focus:border-green focus:bg-bg ${
        done ? 'border-transparent bg-green-dim/50 text-green-light' : 'border-line bg-raised'
      }`}
      value={text}
      placeholder="0"
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const v = parseNum(text);
        if (v !== value) onCommit(Math.max(0, v));
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
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
}: {
  set: WorkoutSet;
  /** Nummer for vanlige sets. */
  label: number;
  previous?: WorkoutSet;
  unit: 'kg' | 'lbs';
  prs?: PRKind[];
  onCompleted: () => void;
  onMenu: () => void;
}) {
  const done = !!set.completed_at;
  const prevLabel = previous ? `${num(toDisplay(previous.weight, unit))} × ${previous.reps}` : '–';
  const short = SET_TYPE_SHORT[set.set_type];
  return (
    <div className={`rounded-2xl transition-colors ${done ? 'bg-green-dim/25' : ''}`}>
      <div className={`${SET_GRID} px-1 py-1`}>
        <button
          type="button"
          onClick={onMenu}
          aria-label={`Set ${label}, rediger`}
          className={`font-num h-11 rounded-xl text-center text-lg font-bold active:bg-raised ${TYPE_COLOR[set.set_type]}`}
        >
          {short || label}
        </button>
        <button
          type="button"
          className="font-num truncate text-left text-sm text-faint active:text-muted"
          aria-label={previous ? `Bruk forrige: ${prevLabel}` : 'Ingen forrige'}
          onClick={() => previous && void updateSet(set.id, { weight: previous.weight, reps: previous.reps })}
        >
          {prevLabel}
        </button>
        <NumField
          label={`Vekt set ${label} (${unit})`}
          decimal
          done={done}
          value={toDisplay(set.weight, unit)}
          onCommit={(v) => void updateSet(set.id, { weight: fromDisplay(v, unit) })}
        />
        <NumField label={`Reps set ${label}`} done={done} value={set.reps} onCommit={(v) => void updateSet(set.id, { reps: Math.round(v) })} />
        <button
          type="button"
          aria-label={done ? `Angre set ${label}` : `Fullfør set ${label}`}
          aria-pressed={done}
          className={`grid h-12 w-[3.25rem] place-items-center rounded-xl transition ${done ? 'animate-pop bg-green text-black shadow-glow' : 'border border-line bg-raised text-faint active:bg-line'}`}
          onClick={async () => {
            if (await toggleSetDone(set.id)) {
              void buzz(20);
              onCompleted();
            }
          }}
        >
          <Icon name="check" strokeWidth={3} />
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
