import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/dexie';
import { deleteRoutine, duplicateRoutine, restore, routineItems, saveRoutine, type RoutineDraftItem } from '../../db/repo';
import { showToast, undoToast } from '../../components/toast';
import type { ExerciseKind } from '../../db/types';
import { exerciseName } from '../../lib/exerciseName';
import { Button, Card, IconButton, NumberStepper, Page, inputClass } from '../../components/ui';
import { ExercisePicker, useExerciseMap } from '../workout/ExercisePicker';
import { getSetting } from '../../lib/settings';
import { duration } from '../../lib/format';
import { t } from '../../i18n';

const targetLabel = (kind?: ExerciseKind) => (kind === 'time' ? t('Sekunder', 'Seconds') : kind === 'cardio' ? t('Minutter', 'Minutes') : 'Reps');

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
    await saveRoutine({ id, name: name.trim() || t('Ny rutine', 'New routine'), notes }, items);
    if (id) navigate(-1);
    else navigate('/routines', { replace: true });
  };

  if (!loaded) return <Page title={t('Rutine', 'Routine')} back>{null}</Page>;

  return (
    <Page
      title={id ? t('Rediger rutine', 'Edit routine') : t('Ny rutine', 'New routine')}
      back
      actions={
        <Button className="min-h-10 px-4" onClick={() => void save()}>
          {t('Lagre', 'Save')}
        </Button>
      }
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t('Navn', 'Name')}</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('F.eks. Push, Overkropp A', 'E.g. Push, Upper body A')} />
      </label>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-sm text-muted">{t('Notat', 'Note')}</span>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Valgfritt', 'Optional')} />
      </label>

      <div className="mt-5 flex flex-col gap-3">
        {items.map((it, i) => (
          <Card key={it.id ?? `${it.exercise_id}-${i}`} className="p-3">
            <div className="mb-3 flex items-center gap-1">
              <h2 className="min-w-0 flex-1 truncate font-bold text-accent">{exerciseName(exMap.get(it.exercise_id))}</h2>
              <IconButton icon="up" label={t('Flytt opp', 'Move up')} disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30" />
              <IconButton icon="down" label={t('Flytt ned', 'Move down')} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30" />
              <IconButton icon="trash" label={t('Fjern', 'Remove')} className="text-danger" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="mb-1 text-muted">Sets</div>
                <NumberStepper label="Sets" value={it.target_sets} min={1} max={20} onChange={(v) => update(i, { target_sets: v })} />
              </div>
              <div>
                <div className="mb-1 text-muted">{targetLabel(exMap.get(it.exercise_id)?.kind)}</div>
                <NumberStepper
                  label={targetLabel(exMap.get(it.exercise_id)?.kind)}
                  value={it.target_reps}
                  min={1}
                  max={exMap.get(it.exercise_id)?.kind === 'time' ? 600 : 100}
                  step={exMap.get(it.exercise_id)?.kind === 'time' ? 5 : 1}
                  onChange={(v) => update(i, { target_reps: v })}
                />
              </div>
              <div className="col-span-2">
                <div className="mb-1 text-muted">{t('Hvile', 'Rest')}</div>
                <NumberStepper
                  label={t('Hvile', 'Rest')}
                  value={it.rest_seconds}
                  step={15}
                  min={0}
                  max={600}
                  format={(v) => (v ? duration(v * 1000) : t('Av', 'Off'))}
                  onChange={(v) => update(i, { rest_seconds: v })}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button full variant="secondary" icon="plus" className="mt-4 border-accent/50 text-accent" onClick={() => setPicker(true)}>
        {t('Legg til øvelse', 'Add exercise')}
      </Button>

      {id && (
        <Button
          full
          variant="secondary"
          icon="repeat"
          className="mt-8"
          onClick={async () => {
            // Lagre endringene først, så kopien blir lik det som står på skjermen.
            await saveRoutine({ id, name: name.trim() || t('Rutine', 'Routine'), notes }, items);
            const copy = await duplicateRoutine(id);
            navigate(`/routines/${copy}`, { replace: true });
            showToast(t('Kopi laget. Du redigerer nå kopien.', 'Copy created. You are now editing the copy.'));
          }}
        >
          {t('Dupliser rutine', 'Duplicate routine')}
        </Button>
      )}

      {id && (
        <Button
          full
          variant="danger"
          icon="trash"
          className="mt-2"
          onClick={async () => {
            const removed = await deleteRoutine(id);
            navigate('/routines', { replace: true });
            undoToast(t('Rutinen er slettet', 'Routine deleted'), () => restore(removed));
          }}
        >
          {t('Slett rutine', 'Delete routine')}
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
