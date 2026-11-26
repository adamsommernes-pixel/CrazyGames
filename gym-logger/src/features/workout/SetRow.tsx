import { useEffect, useState } from 'react';
import type { WorkoutSet } from '../../db/types';
import { toggleSetDone, updateSet } from '../../db/repo';
import { fromDisplay, num, parseNum, toDisplay } from '../../lib/format';
import { PR_LABEL, type PRKind } from '../../lib/calc';
import { Icon } from '../../components/Icon';
import { PRBadge } from '../../components/ui';

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
      className={`tabular h-11 w-full min-w-0 rounded-lg border text-center text-lg font-semibold outline-none focus:border-green ${
        done ? 'border-transparent bg-green-dim/40 text-green-light' : 'border-line bg-raised'
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

export function SetRow({
  set,
  index,
  previous,
  unit,
  prs,
  onCompleted,
  onMenu,
}: {
  set: WorkoutSet;
  index: number;
  previous?: WorkoutSet;
  unit: 'kg' | 'lbs';
  prs?: PRKind[];
  onCompleted: () => void;
  onMenu: () => void;
}) {
  const done = !!set.completed_at;
  const prevLabel = previous ? `${num(toDisplay(previous.weight, unit))} × ${previous.reps}` : '–';
  return (
    <div className={`rounded-xl ${done ? 'bg-green-dim/20' : ''}`}>
      <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4rem_3rem] items-center gap-2 px-1 py-1">
        <button
          type="button"
          onClick={onMenu}
          aria-label={`Set ${index + 1}, valg`}
          className={`tabular h-10 rounded-lg text-center font-bold ${set.is_warmup ? 'text-amber-400' : 'text-muted'} active:bg-raised`}
        >
          {set.is_warmup ? 'O' : index + 1}
        </button>
        <button
          type="button"
          className="tabular truncate text-left text-sm text-faint"
          aria-label={previous ? `Bruk forrige: ${prevLabel}` : 'Ingen forrige'}
          onClick={() => previous && void updateSet(set.id, { weight: previous.weight, reps: previous.reps })}
        >
          {prevLabel}
        </button>
        <NumField
          label={`Vekt set ${index + 1} (${unit})`}
          decimal
          done={done}
          value={toDisplay(set.weight, unit)}
          onCommit={(v) => void updateSet(set.id, { weight: fromDisplay(v, unit) })}
        />
        <NumField
          label={`Reps set ${index + 1}`}
          done={done}
          value={set.reps}
          onCommit={(v) => void updateSet(set.id, { reps: Math.round(v) })}
        />
        <button
          type="button"
          aria-label={done ? `Angre set ${index + 1}` : `Fullfør set ${index + 1}`}
          aria-pressed={done}
          className={`grid h-11 w-12 place-items-center rounded-lg ${done ? 'bg-green text-black' : 'bg-raised text-faint'}`}
          onClick={async () => {
            if (await toggleSetDone(set.id)) onCompleted();
          }}
        >
          <Icon name="check" strokeWidth={3} />
        </button>
      </div>
      {prs && prs.length > 0 && (
        <div className="flex flex-wrap gap-1 px-12 pb-1.5">
          {prs.map((p) => (
            <PRBadge key={p} label={PR_LABEL[p]} />
          ))}
        </div>
      )}
    </div>
  );
}
