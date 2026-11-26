import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { createExercise } from '../../db/repo';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup, type WorkoutSet } from '../../db/types';
import { Button, Chip, Sheet, SectionTitle, inputClass } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { matchesSearch } from '../../lib/search';
import { useSetting } from '../../lib/settings';
import { num, toDisplay } from '../../lib/format';

export function useExercises(): Exercise[] {
  return useLiveQuery(async () => (await db.exercises.toArray()).filter((e) => !e.deleted), [], []);
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises();
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}

/** Siste fullførte arbeidssett per øvelse, og øvelsene brukt sist (nyeste først). */
function useRecent() {
  return useLiveQuery(async () => {
    const sets = (await db.sets.toArray())
      .filter((s) => !s.deleted && s.completed_at && s.set_type !== 'warmup')
      .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1));
    const last = new Map<string, WorkoutSet>();
    for (const s of sets) if (!last.has(s.exercise_id)) last.set(s.exercise_id, s);
    return { last, recent: [...last.keys()].slice(0, 8) };
  }, []);
}

/**
 * Velg én eller flere øvelser. Trykk for å huke av, og «Legg til» for å legge dem inn
 * i den rekkefølgen de ble valgt.
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseIds: string[]) => void;
}) {
  const exercises = useExercises();
  const recentData = useRecent();
  const unit = useSetting('unit');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      exercises
        .filter((e) => (!group || e.muscle_group === group) && matchesSearch(e.name, query))
        .sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [exercises, query, group],
  );
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const recent = !query.trim() && !group ? (recentData?.recent ?? []).map((id) => byId.get(id)).filter(Boolean) as Exercise[] : [];

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const reset = () => {
    setQuery('');
    setGroup(null);
    setCreating(false);
    setSelected([]);
  };
  const close = () => {
    reset();
    onClose();
  };
  const confirm = () => {
    if (!selected.length) return;
    onPick(selected);
    close();
  };

  const row = (e: Exercise) => {
    const on = selected.includes(e.id);
    const last = recentData?.last.get(e.id);
    return (
      <li key={e.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-1 text-left transition-colors ${on ? 'bg-green-dim/30' : 'active:bg-raised'}`}
          onClick={() => toggle(e.id)}
        >
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium ${on ? 'text-green-light' : ''}`}>{e.name}</span>
            <span className="block truncate text-sm text-muted">
              {e.muscle_group} · {e.equipment}
              {e.custom ? ' · Egen' : ''}
              {last ? (
                <span className="font-num text-faint">
                  {' '}
                  · sist {num(toDisplay(last.weight, unit))} × {last.reps}
                </span>
              ) : null}
            </span>
          </span>
          <span className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 transition ${on ? 'border-green bg-green text-black' : 'border-line text-transparent'}`}>
            {on ? <span className="font-num text-xs font-bold">{selected.indexOf(e.id) + 1}</span> : <Icon name="check" size={14} />}
          </span>
        </button>
      </li>
    );
  };

  return (
    <Sheet open={open} onClose={close} title={creating ? 'Ny øvelse' : 'Velg øvelser'} tall>
      {creating ? (
        <NewExerciseForm
          initialName={query}
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setSelected((s) => [...s, id]);
            setQuery('');
            setCreating(false);
          }}
        />
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pb-2">
            <label className="relative block">
              <span className="sr-only">Søk etter øvelse</span>
              <Icon name="search" size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input
                id="exercise-search"
                className={`${inputClass} pl-10`}
                placeholder="Søk etter øvelse"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                autoComplete="off"
              />
            </label>
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip active={!group} onClick={() => setGroup(null)}>
                Alle
              </Chip>
              {MUSCLE_GROUPS.map((g) => (
                <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>

          {recent.length > 0 && (
            <>
              <SectionTitle>Nylig brukt</SectionTitle>
              <ul className="flex flex-col gap-0.5">{recent.map(row)}</ul>
              <SectionTitle>Alle øvelser</SectionTitle>
            </>
          )}
          <ul className="flex flex-col gap-0.5">{filtered.map(row)}</ul>
          {filtered.length === 0 && <p className="py-6 text-center text-muted">Fant ingen øvelser.</p>}
          <Button variant="secondary" icon="plus" full className="mt-4" onClick={() => setCreating(true)}>
            Lag ny øvelse
          </Button>

          <div className="sticky bottom-0 -mx-4 mt-4 bg-gradient-to-t from-surface via-surface to-transparent px-4 pt-4">
            <Button full className="min-h-14 text-lg" disabled={!selected.length} onClick={confirm}>
              {selected.length ? `Legg til (${selected.length})` : 'Velg øvelser'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function NewExerciseForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<MuscleGroup>('Bryst');
  const [equipment, setEquipment] = useState<Equipment>('Manualer');
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreated(await createExercise({ name: name.trim(), muscle_group: group, equipment }));
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Navn</span>
        <input id="new-exercise-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Muskelgruppe</legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Utstyr</legend>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT.map((g) => (
            <Chip key={g} active={equipment === g} onClick={() => setEquipment(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Avbryt
        </Button>
        <button type="submit" className="min-h-12 flex-1 rounded-2xl bg-green font-semibold text-black">
          Lagre og velg
        </button>
      </div>
    </form>
  );
}
