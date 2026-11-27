import { useState } from 'react';
import { programsForDays, type Program } from '../../db/programs';
import type { Experience, Goal } from '../../db/types';
import { useExerciseMap } from '../workout/ExercisePicker';
import { exerciseName } from '../../lib/exerciseName';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n';

/** Velg et program for antall dager. Det anbefalte står først. `none` = lag egne rutiner. */
export function ProgramList({
  days,
  experience,
  goal,
  selected,
  onSelect,
  allowNone,
}: {
  days: number;
  experience: Experience;
  goal: Goal;
  selected: string;
  onSelect: (id: string) => void;
  allowNone?: boolean;
}) {
  const list = programsForDays(days, experience, goal);
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('Program', 'Program')}>
      {list.map(({ program, recommended }) => (
        <ProgramOption key={program.id} program={program} recommended={recommended} selected={selected === program.id} onSelect={() => onSelect(program.id)} />
      ))}
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'none'}
          onClick={() => onSelect('none')}
          className={`rounded-2xl border p-4 text-left transition ${selected === 'none' ? 'border-accent bg-accent-soft/30' : 'border-line bg-raised'}`}
        >
          <span className="block font-semibold">{t('Ingen program, jeg lager mine egne', 'No program, I make my own')}</span>
          <span className="mt-0.5 block text-sm text-muted">{t('Du kan velge et program senere under Rutiner.', 'You can pick a program later under Routines.')}</span>
        </button>
      )}
    </div>
  );
}

function ProgramOption({ program, recommended, selected, onSelect }: { program: Program; recommended: boolean; selected: boolean; onSelect: () => void }) {
  const [open, setOpen] = useState(false);
  const exMap = useExerciseMap();
  return (
    <div className={`rounded-2xl border transition ${selected ? 'border-accent bg-accent-soft/30' : 'border-line bg-raised'}`}>
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="w-full p-4 pb-2 text-left">
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold">{program.name}</span>
          {recommended && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">{t('Anbefalt', 'Recommended')}</span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{program.description}</span>
        <span className="mt-1.5 block text-xs text-faint">{program.routines.map((r) => r.name).join(' · ')}</span>
      </button>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 px-4 pb-3 text-xs font-semibold text-accent">
        {open ? t('Skjul øvelser', 'Hide exercises') : t('Se øvelser', 'See exercises')}
        <Icon name={open ? 'up' : 'down'} size={14} />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-line px-4 py-3 text-sm">
          {program.routines.map((r, i) => (
            <div key={i}>
              <div className="font-semibold">{r.name}</div>
              <div className="text-muted">{r.exercises.map(([id]) => exerciseName(exMap.get(id))).join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
