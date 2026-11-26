import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/dexie';
import { deleteRoutine, routineItems, saveRoutine, type RoutineDraftItem } from '../../db/repo';
import { Button, Card, IconButton, NumberStepper, Page, inputClass } from '../../components/ui';
import { ExercisePicker, useExerciseMap } from '../workout/ExercisePicker';
import { getSetting } from '../../lib/settings';
import { duration } from '../../lib/format';
import { askConfirm } from '../../components/confirm';

export function RoutineEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const exMap = useExerciseMap();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<RoutineDraftItem[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const r = await db.routines.get(id);
      if (r) {
        setName(r.name);
        setNotes(r.notes);
        setItems((await routineItems(id)).map(({ id, exercise_id, target_sets, target_reps, rest_seconds }) => ({ id, exercise_id, target_sets, target_reps, rest_seconds })));
      }
      setLoaded(true);
    })();
  }, [id]);

  const update = (i: number, patch: Partial<RoutineDraftItem>) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const save = async () => {
    await saveRoutine({ id, name: name.trim() || 'Ny rutine', notes }, items);
    if (id) navigate(-1);
    else navigate('/routines', { replace: true });
  };

  if (!loaded) return <Page title="Rutine" back>{null}</Page>;

  return (
    <Page
      title={id ? 'Rediger rutine' : 'Ny rutine'}
      back
      actions={
        <Button className="min-h-10 px-4" onClick={() => void save()}>
          Lagre
        </Button>
      }
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Navn</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Push, Overkropp A" />
      </label>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-sm text-muted">Notat</span>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Valgfritt" />
      </label>

      <div className="mt-5 flex flex-col gap-3">
        {items.map((it, i) => (
          <Card key={it.id ?? `${it.exercise_id}-${i}`} className="p-3">
            <div className="mb-3 flex items-center gap-1">
              <h2 className="min-w-0 flex-1 truncate font-bold text-green">{exMap.get(it.exercise_id)?.name ?? '?'}</h2>
              <IconButton icon="up" label="Flytt opp" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30" />
              <IconButton icon="down" label="Flytt ned" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30" />
              <IconButton icon="trash" label="Fjern" className="text-danger" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="mb-1 text-muted">Sets</div>
                <NumberStepper label="Sets" value={it.target_sets} min={1} max={20} onChange={(v) => update(i, { target_sets: v })} />
              </div>
              <div>
                <div className="mb-1 text-muted">Reps</div>
                <NumberStepper label="Reps" value={it.target_reps} min={1} max={100} onChange={(v) => update(i, { target_reps: v })} />
              </div>
              <div className="col-span-2">
                <div className="mb-1 text-muted">Hvile</div>
                <NumberStepper
                  label="Hvile"
                  value={it.rest_seconds}
                  step={15}
                  min={0}
                  max={600}
                  format={(v) => (v ? duration(v * 1000) : 'Av')}
                  onChange={(v) => update(i, { rest_seconds: v })}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button full variant="secondary" icon="plus" className="mt-4 border-green/50 text-green" onClick={() => setPicker(true)}>
        Legg til øvelse
      </Button>

      {id && (
        <Button
          full
          variant="danger"
          icon="trash"
          className="mt-8"
          onClick={async () => {
            if (!(await askConfirm('Rutinen slettes. Tidligere økter beholdes.', { confirmLabel: 'Slett rutine' }))) return;
            await deleteRoutine(id);
            navigate('/routines', { replace: true });
          }}
        >
          Slett rutine
        </Button>
      )}

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={async (ids) => {
          const rest = await getSetting('defaultRest');
          setItems((l) => [...l, ...ids.map((exercise_id) => ({ exercise_id, target_sets: 3, target_reps: 10, rest_seconds: rest }))]);
        }}
      />
    </Page>
  );
}
