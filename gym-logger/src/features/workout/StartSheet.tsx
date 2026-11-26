import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { getActiveWorkout, nextRoutine, repeatWorkout, routineItems, startWorkout } from '../../db/repo';
import { Card, Sheet, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useExerciseMap } from './ExercisePicker';
import { dateShort } from '../../lib/format';
import { buzz } from '../../lib/haptics';

let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  open = v;
  listeners.forEach((l) => l());
};
export const openStartSheet = () => set(true);

/** Ark for å starte en økt: tom, fra rutine eller gjenta forrige. */
export function StartSheet() {
  const isOpen = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
  const navigate = useNavigate();
  const exMap = useExerciseMap();
  const data = useLiveQuery(async () => {
    const routines = (await db.routines.toArray()).filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    const withItems = await Promise.all(routines.map(async (r) => ({ r, items: await routineItems(r.id) })));
    const last = (await db.workouts.orderBy('started_at').reverse().toArray()).find((w) => !w.deleted && w.ended_at);
    return { routines: withItems, last, next: await nextRoutine() };
  }, []);

  const go = async (fn: () => Promise<string>) => {
    set(false);
    if (!(await getActiveWorkout())) void buzz(15);
    await fn();
    navigate('/workout');
  };

  return (
    <Sheet open={isOpen} onClose={() => set(false)} title="Start økt">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => void go(() => startWorkout())} className="flex min-h-16 items-center gap-3 rounded-2xl bg-green px-4 text-left font-semibold text-black shadow-glow active:scale-[0.99]">
          <Icon name="plus" size={24} strokeWidth={2.6} />
          <span className="flex-1 text-lg">Tom økt</span>
        </button>
        {data?.last && (
          <button type="button" onClick={() => void go(() => repeatWorkout(data.last!.id))} className="card flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left active:bg-raised">
            <Icon name="repeat" className="text-green" />
            <span className="flex-1">
              <span className="block font-semibold">Gjenta forrige</span>
              <span className="block text-sm text-muted">
                {data.last.name} · {dateShort(data.last.started_at)}
              </span>
            </span>
          </button>
        )}
      </div>
      {data && data.routines.length > 0 && (
        <>
          <SectionTitle>Rutiner</SectionTitle>
          <ul className="flex flex-col gap-2">
            {data.routines.map(({ r, items }) => (
              <li key={r.id}>
                <button type="button" className="w-full text-left" disabled={!items.length} onClick={() => void go(() => startWorkout({ routineId: r.id }))}>
                  <Card className={`flex items-center gap-3 p-4 ${data.next?.id === r.id ? 'border-green/60' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{r.name}</span>
                        {data.next?.id === r.id && <span className="rounded-full bg-green-dim px-2 py-0.5 text-[11px] font-semibold text-green-light">Neste</span>}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{items.map((i) => exMap.get(i.exercise_id)?.name ?? '?').join(', ')}</span>
                    </span>
                    <Icon name="play" className="text-green" />
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="mt-4 w-full py-3 text-center font-medium text-green" onClick={() => { set(false); navigate('/routines'); }}>
        Administrer rutiner
      </button>
    </Sheet>
  );
}
