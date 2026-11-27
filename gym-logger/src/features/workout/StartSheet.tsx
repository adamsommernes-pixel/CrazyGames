import { useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { getActiveWorkout, nextRoutine, repeatWorkout, routineItems, sortedRoutines, startWorkout } from '../../db/repo';
import { Button, Card, Sheet, inputClass } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useExerciseMap } from './ExercisePicker';
import { exerciseName } from '../../lib/exerciseName';
import { dateShort, fromDateTimeInputs, toDateInput } from '../../lib/format';
import { buzz } from '../../lib/haptics';
import { t } from '../../i18n';

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
    const routines = await sortedRoutines();
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
    <Sheet open={isOpen} onClose={() => set(false)} title={t('Start økt', 'Start workout')}>
      {data && data.routines.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t('Dine rutiner', 'Your routines')}</h3>
          <ul className="mb-5 flex flex-col gap-2">
            {data.routines.map(({ r, items }) => (
              <li key={r.id}>
                <button type="button" className="w-full text-left" disabled={!items.length} onClick={() => void go(() => startWorkout({ routineId: r.id }))}>
                  <Card className={`flex items-center gap-3 p-4 ${data.next?.id === r.id ? 'border-accent/60' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{r.name}</span>
                        {data.next?.id === r.id && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">{t('Neste', 'Next')}</span>}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{items.map((i) => exerciseName(exMap.get(i.exercise_id))).join(', ')}</span>
                    </span>
                    <Icon name="play" className="text-accent" />
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => void go(() => startWorkout())} className="flex min-h-16 items-center gap-3 rounded-2xl bg-accent px-4 text-left font-semibold text-on-accent active:scale-[0.99]">
          <Icon name="plus" size={24} strokeWidth={2.6} />
          <span className="flex-1 text-lg">{t('Tom økt', 'Empty workout')}</span>
        </button>
        {data?.last && (
          <button type="button" onClick={() => void go(() => repeatWorkout(data.last!.id))} className="card flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left active:bg-raised">
            <Icon name="repeat" className="text-accent" />
            <span className="flex-1">
              <span className="block font-semibold">{t('Gjenta forrige', 'Repeat last')}</span>
              <span className="block text-sm text-muted">
                {data.last.name} · {dateShort(data.last.started_at)}
              </span>
            </span>
          </button>
        )}
      </div>
      <PastWorkout onStart={(startedAt) => void go(() => startWorkout({ startedAt }))} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="py-3 text-center font-medium text-accent" onClick={() => { set(false); navigate('/routines'); }}>
          {t('Administrer rutiner', 'Manage routines')}
        </button>
        <button type="button" className="py-3 text-center font-medium text-accent" onClick={() => { set(false); navigate('/programs'); }}>
          {t('Finn et program', 'Find a program')}
        </button>
      </div>
    </Sheet>
  );
}

/** Glemte du telefonen? Registrer en økt i ettertid med dato og klokkeslett. */
function PastWorkout({ onStart }: { onStart: (startedAt: string) => void }) {
  const [open, setOpen] = useState(false);
  const yesterday = new Date(Date.now() - 86_400_000);
  const [date, setDate] = useState(toDateInput(yesterday));
  const [time, setTime] = useState('18:00');
  const startedAt = fromDateTimeInputs(date, time);
  const inFuture = new Date(startedAt).getTime() > Date.now();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="card mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left active:bg-raised">
        <Icon name="calendar" className="text-accent" />
        <span className="flex-1">
          <span className="block font-semibold">{t('Logg tidligere økt', 'Log a past workout')}</span>
          <span className="block text-sm text-muted">{t('Glemte du å logge? Legg den inn i ettertid.', 'Forgot to log? Add it afterwards.')}</span>
        </span>
      </button>
    );
  }
  return (
    <Card className="mt-4 flex flex-col gap-3 p-4">
      <h3 className="font-semibold">{t('Logg tidligere økt', 'Log a past workout')}</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('Dato', 'Date')}</span>
          <input id="past-date" type="date" className={inputClass} value={date} max={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('Startet', 'Started')}</span>
          <input id="past-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      {inFuture && <p className="text-sm text-warn">{t('Tidspunktet er fram i tid.', 'That time is in the future.')}</p>}
      <Button full disabled={!date || inFuture} onClick={() => onStart(startedAt)}>
        {t('Start registrering', 'Start logging')}
      </Button>
      <p className="text-xs text-faint">{t('Du logger øvelser og sets som vanlig, og setter varigheten når du lagrer.', 'Log exercises and sets as usual, and set the duration when you save.')}</p>
    </Card>
  );
}
