import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { createExercise } from '../../db/repo';
import {
  EQUIPMENT,
  EQUIPMENT_LABEL,
  EXERCISE_KINDS,
  KIND_LABEL,
  MUSCLE_LABEL,
  MUSCLE_GROUPS,
  type Equipment,
  type Exercise,
  type ExerciseKind,
  type MuscleGroup,
  type WorkoutSet,
} from '../../db/types';
import { Button, Chip, IconButton, Sheet, inputClass } from '../../components/ui';
import { MuscleDot } from '../../components/MuscleTag';
import { Icon } from '../../components/Icon';
import { ExerciseInfoSheet } from '../exercise/ExerciseInfoSheet';
import { matchesSearch } from '../../lib/search';
import { useSetting } from '../../lib/settings';
import { formatSetShort, registerKinds } from '../../lib/kinds';
import { exerciseName } from '../../lib/exerciseName';
import { englishName } from '../../db/exercises';
import { t } from '../../i18n';

export function useExercises(): Exercise[] {
  const list = useLiveQuery(async () => (await db.exercises.toArray()).filter((e) => !e.deleted), [], []);
  useEffect(() => registerKinds(list), [list]);
  return list;
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
    return { last, recent: [...last.keys()].slice(0, 6) };
  }, []);
}

/**
 * Velg én eller flere øvelser. Uten søk vises favoritter, nylig brukte og så alle øvelser
 * gruppert på muskelgruppe. «i» åpner fremgangsmåten uten å velge øvelsen.
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  single,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseIds: string[]) => void;
  /** Bare én øvelse (f.eks. «Bytt øvelse»): velges med ett trykk. */
  single?: boolean;
  title?: string;
}) {
  const exercises = useExercises();
  const recentData = useRecent();
  const favorites = useSetting('favorites');
  const unit = useSetting('unit');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [info, setInfo] = useState<Exercise | null>(null);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const filtered = useMemo(
    () =>
      exercises
        .filter((e) => (!group || e.muscle_group === group) && (!equipment || e.equipment === equipment) && (matchesSearch(e.name, query) || matchesSearch(englishName(e.id) ?? '', query)))
        .sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [exercises, query, group, equipment],
  );
  const browsing = !query.trim() && !group && !equipment;
  const favList = browsing ? (favorites.map((id) => byId.get(id)).filter(Boolean) as Exercise[]) : [];
  const recent = browsing
    ? ((recentData?.recent ?? []).map((id) => byId.get(id)).filter((e) => e && !favorites.includes(e.id)) as Exercise[])
    : [];
  const sections = browsing
    ? MUSCLE_GROUPS.map((g) => ({ title: MUSCLE_LABEL[g], group: g, items: filtered.filter((e) => e.muscle_group === g) })).filter((s) => s.items.length)
    : [{ title: `${filtered.length} ${t('treff', 'results')}`, group: null, items: filtered }];

  const reset = () => {
    setQuery('');
    setGroup(null);
    setEquipment(null);
    setCreating(false);
    setSelected([]);
  };
  const close = () => {
    reset();
    onClose();
  };
  const toggle = (id: string) => {
    if (single) {
      onPick([id]);
      close();
      return;
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
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
      <li key={e.id} className="flex items-center gap-1">
        <button
          type="button"
          role={single ? undefined : 'checkbox'}
          aria-checked={single ? undefined : on}
          className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors ${on ? 'bg-green-dim/30' : 'active:bg-raised'}`}
          onClick={() => toggle(e.id)}
        >
          <MuscleDot group={e.muscle_group} size={10} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium ${on ? 'text-green-light' : ''}`}>{exerciseName(e)}</span>
            <span className="block truncate text-sm text-muted">
              {MUSCLE_LABEL[e.muscle_group]} · {EQUIPMENT_LABEL[e.equipment]}
              {e.custom ? ` · ${t('Egen', 'Custom')}` : ''}
              {last ? <span className="font-num text-faint"> · {t('sist', 'last')} {formatSetShort(last, e.kind ?? 'weight', unit)}</span> : null}
            </span>
          </span>
          {!single && (
            <span className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 transition ${on ? 'border-green bg-green text-black' : 'border-line text-transparent'}`}>
              {on ? <span className="font-num text-xs font-bold">{selected.indexOf(e.id) + 1}</span> : <Icon name="check" size={14} />}
            </span>
          )}
        </button>
        <IconButton icon="info" label={`${t('Slik gjør du', 'How to')}: ${exerciseName(e)}`} onClick={() => setInfo(e)} className="text-faint" />
      </li>
    );
  };

  const Header = ({ children, group: g }: { children: string; group?: MuscleGroup | null }) => (
    <h3 className="sticky top-[7.75rem] z-[5] -mx-4 flex items-center gap-2 bg-surface/95 px-4 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur">
      {g && <MuscleDot group={g} />}
      {children}
    </h3>
  );

  return (
    <Sheet open={open} onClose={close} title={creating ? t('Ny øvelse', 'New exercise') : (title ?? (single ? t('Velg øvelse', 'Choose exercise') : t('Velg øvelser', 'Choose exercises')))} tall>
      {creating ? (
        <NewExerciseForm
          initialName={query}
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            if (single) {
              onPick([id]);
              close();
              return;
            }
            setSelected((s) => [...s, id]);
            setQuery('');
            setCreating(false);
          }}
        />
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pb-2">
            <label className="relative block">
              <span className="sr-only">{t('Søk etter øvelse', 'Search for an exercise')}</span>
              <Icon name="search" size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input
                id="exercise-search"
                className={`${inputClass} pl-10`}
                placeholder={t('Søk blant øvelser', 'Search exercises')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                autoComplete="off"
              />
            </label>
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={t('Muskelgruppe', 'Muscle group')}>
              <Chip active={!group} onClick={() => setGroup(null)}>
                {t('Alle', 'All')}
              </Chip>
              {MUSCLE_GROUPS.map((g) => (
                <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
                  <span className="inline-flex items-center gap-1.5">
                    <MuscleDot group={g} size={6} />
                    {MUSCLE_LABEL[g]}
                  </span>
                </Chip>
              ))}
            </div>
            <div className="-mx-4 mt-1.5 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={t('Utstyr', 'Equipment')}>
              {EQUIPMENT.map((q) => (
                <button
                  key={q}
                  type="button"
                  aria-pressed={equipment === q}
                  onClick={() => setEquipment(equipment === q ? null : q)}
                  className={`min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium ${equipment === q ? 'bg-ink text-black' : 'bg-raised text-muted'}`}
                >
                  {EQUIPMENT_LABEL[q]}
                </button>
              ))}
            </div>
          </div>

          {favList.length > 0 && (
            <>
              <Header>{`★ ${t('Favoritter', 'Favourites')}`}</Header>
              <ul className="flex flex-col gap-0.5">{favList.map(row)}</ul>
            </>
          )}
          {recent.length > 0 && (
            <>
              <Header>{t('Nylig brukt', 'Recently used')}</Header>
              <ul className="flex flex-col gap-0.5">{recent.map(row)}</ul>
            </>
          )}
          {sections.map((s) => (
            <div key={s.title}>
              <Header group={s.group}>{s.title}</Header>
              <ul className="flex flex-col gap-0.5">{s.items.map(row)}</ul>
            </div>
          ))}
          {filtered.length === 0 && <p className="py-6 text-center text-muted">{t('Fant ingen øvelser.', 'No exercises found.')}</p>}
          <Button variant="secondary" icon="plus" full className="mt-4" onClick={() => setCreating(true)}>
            {t('Lag ny øvelse', 'Create new exercise')}{query.trim() ? ` «${query.trim()}»` : ''}
          </Button>

          {!single && (
            <div className="sticky bottom-0 z-20 -mx-4 mt-4 bg-gradient-to-t from-surface via-surface to-transparent px-4 pt-4">
              <Button full className="min-h-14 text-lg" disabled={!selected.length} onClick={confirm}>
                {selected.length ? `${t('Legg til', 'Add')} (${selected.length})` : t('Velg øvelser', 'Choose exercises')}
              </Button>
            </div>
          )}
        </div>
      )}
      <ExerciseInfoSheet exercise={info} onClose={() => setInfo(null)} />
    </Sheet>
  );
}

const KIND_HINT: Record<ExerciseKind, string> = {
  weight: 'kg × reps',
  get bodyweight() { return t('reps, valgfri ekstra vekt', 'reps, optional extra weight'); },
  get time() { return t('sekunder', 'seconds'); },
  get cardio() { return t('minutter og km', 'minutes and km'); },
};

export function NewExerciseForm({
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
  const [kind, setKind] = useState<ExerciseKind>('weight');
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreated(await createExercise({ name: name.trim(), muscle_group: group, equipment, kind }));
      }}
    >
      <ExerciseFields name={name} setName={setName} group={group} setGroup={setGroup} equipment={equipment} setEquipment={setEquipment} kind={kind} setKind={setKind} />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          {t('Avbryt', 'Cancel')}
        </Button>
        <button type="submit" className="min-h-12 flex-1 rounded-2xl bg-green font-semibold text-black">
          {t('Lagre og velg', 'Save and select')}
        </button>
      </div>
    </form>
  );
}

/** Felles felt for å lage og redigere en egen øvelse. */
export function ExerciseFields(p: {
  name: string;
  setName: (v: string) => void;
  group: MuscleGroup;
  setGroup: (v: MuscleGroup) => void;
  equipment: Equipment;
  setEquipment: (v: Equipment) => void;
  kind: ExerciseKind;
  setKind: (v: ExerciseKind) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t('Navn', 'Name')}</span>
        <input id="new-exercise-name" className={inputClass} value={p.name} onChange={(e) => p.setName(e.target.value)} autoFocus required />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">{t('Muskelgruppe', 'Muscle group')}</legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} active={p.group === g} onClick={() => p.setGroup(g)}>
              {MUSCLE_LABEL[g]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">{t('Utstyr', 'Equipment')}</legend>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT.map((g) => (
            <Chip key={g} active={p.equipment === g} onClick={() => p.setEquipment(g)}>
              {EQUIPMENT_LABEL[g]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">{t('Hvordan logges den?', 'How is it logged?')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {EXERCISE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={p.kind === k}
              onClick={() => p.setKind(k)}
              className={`rounded-xl border p-3 text-left ${p.kind === k ? 'border-green bg-green-dim/30' : 'border-line bg-raised'}`}
            >
              <span className="block text-sm font-semibold">{KIND_LABEL[k]}</span>
              <span className="block text-xs text-muted">{KIND_HINT[k]}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
