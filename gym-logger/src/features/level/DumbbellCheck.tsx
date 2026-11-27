import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { halveSetWeights, restoreSetWeights, setIdsForExercise } from '../../db/repo';
import { best1RM } from '../../lib/calc';
import { DUMBBELL_PAIRS, suspiciousDumbbells } from '../../lib/perHand';
import { setSetting, useSetting } from '../../lib/settings';
import { exerciseName } from '../../lib/exerciseName';
import { num, toDisplay } from '../../lib/format';
import { useExerciseMap } from '../workout/ExercisePicker';
import { undoToast } from '../../components/toast';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n';

const IDS = [...new Set(DUMBBELL_PAIRS.flatMap((p) => [p.dumbbell, p.barbell]))];

/**
 * Engangssjekk: er manualvekten mye høyere enn stangløftet tilsier, er det trolig logget begge
 * manualene samlet. Spør én gang per øvelse: «Del alle på to» eller «Det stemmer».
 * `only` begrenser til én øvelse (på øvelsessiden).
 */
export function DumbbellCheck({ only }: { only?: string }) {
  const checked = useSetting('dumbbellChecked');
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const best = useLiveQuery(async () => {
    const m = new Map<string, number>();
    for (const id of IDS) {
      const sets = (await db.sets.where('exercise_id').equals(id).toArray()).filter((s) => !s.deleted);
      const b = best1RM(sets);
      if (b > 0) m.set(id, b);
    }
    return m;
  }, []);
  if (!best) return null;
  const list = suspiciousDumbbells(best, checked).filter((x) => !only || x.dumbbell === only);
  if (!list.length) return null;
  const kg = (v: number) => `${num(toDisplay(v, unit), 0)} ${unit}`;
  return (
    <div className="mb-3 flex flex-col gap-2" data-dumbbell-check>
      {list.map((x) => (
        <div key={x.dumbbell} className="rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3 text-sm">
          <div className="flex items-start gap-2">
            <Icon name="info" size={16} className="mt-0.5 shrink-0 text-warn" />
            <p>
              {t(
                `${exerciseName(exMap.get(x.dumbbell))}: ${kg(x.dumbbellKg)} per manual er mye sammenlignet med ${exerciseName(exMap.get(x.barbell)).toLowerCase()} (${kg(x.barbellKg)}). Logget du begge manualene samlet?`,
                `${exerciseName(exMap.get(x.dumbbell))}: ${kg(x.dumbbellKg)} per dumbbell is a lot compared with ${exerciseName(exMap.get(x.barbell)).toLowerCase()} (${kg(x.barbellKg)}). Did you log both dumbbells together?`,
              )}
            </p>
          </div>
          <div className="mt-2 flex gap-4 pl-6">
            <button
              type="button"
              className="font-semibold text-accent"
              onClick={async () => {
                const prev = await halveSetWeights(await setIdsForExercise(x.dumbbell));
                void setSetting('dumbbellChecked', [...checked, x.dumbbell]);
                undoToast(t(`Vektene er delt på to (${prev.length} set)`, `Weights halved (${prev.length} sets)`), async () => {
                  await restoreSetWeights(prev);
                  void setSetting('dumbbellChecked', checked.filter((c) => c !== x.dumbbell));
                });
              }}
            >
              {t('Ja, del alle på to', 'Yes, halve them all')}
            </button>
            <button type="button" className="font-semibold text-muted" onClick={() => void setSetting('dumbbellChecked', [...checked, x.dumbbell])}>
              {t('Nei, det stemmer', 'No, that is right')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
