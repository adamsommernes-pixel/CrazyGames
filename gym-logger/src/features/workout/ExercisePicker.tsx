import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { createExercise } from '../../db/repo';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from '../../db/types';
import { Button, Chip, Sheet, inputClass } from '../../components/ui';
import { Icon } from '../../components/Icon';

const norm = (s: string) => s.toLowerCase().normalize('NFKD');

export function useExercises(): Exercise[] {
  return useLiveQuery(async () => (await db.exercises.toArray()).filter((e) => !e.deleted), [], []);
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises();
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}) {
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return exercises
      .filter((e) => (!group || e.muscle_group === group) && (!q || norm(e.name).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  }, [exercises, query, group]);

  const pick = (id: string) => {
    onPick(id);
    setQuery('');
    setCreating(false);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={creating ? 'Ny øvelse' : 'Velg øvelse'} tall>
      {creating ? (
        <NewExerciseForm initialName={query} onCancel={() => setCreating(false)} onCreated={pick} />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pb-2">
            <label className="relative block">
              <span className="sr-only">Søk etter øvelse</span>
              <Icon name="search" size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input
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
          <ul className="divide-y divide-line">
            {filtered.map((e) => (
              <li key={e.id}>
                <button type="button" className="flex min-h-14 w-full items-center gap-3 text-left active:bg-raised" onClick={() => pick(e.id)}>
                  <span className="flex-1">
                    <span className="block font-medium">{e.name}</span>
                    <span className="block text-sm text-muted">
                      {e.muscle_group} · {e.equipment}
                      {e.custom ? ' · Egen' : ''}
                    </span>
                  </span>
                  <Icon name="plus" className="text-green" />
                </button>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && <p className="py-6 text-center text-muted">Fant ingen øvelser.</p>}
          <Button variant="secondary" icon="plus" full className="mt-4" onClick={() => setCreating(true)}>
            Lag ny øvelse
          </Button>
        </>
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
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
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
        <button type="submit" className="min-h-12 flex-1 rounded-xl bg-green font-semibold text-black">
          Lagre og legg til
        </button>
      </div>
    </form>
  );
}
