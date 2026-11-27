import { useEffect, useRef, useState } from 'react';
import type { Exercise, WorkoutExercise } from '../../db/types';
import { setWorkoutExerciseOrder } from '../../db/repo';
import { Button, IconButton, Sheet } from '../../components/ui';
import { MuscleDot } from '../../components/MuscleTag';
import { exerciseName } from '../../lib/exerciseName';
import { buzz } from '../../lib/haptics';
import { t } from '../../i18n';

const move = <T,>(list: T[], from: number, to: number) => {
  const copy = [...list];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
};

/**
 * Endre rekkefølgen på øvelsene i økta: dra i håndtaket (≡), eller bruk pilene.
 * Lagres når arket lukkes.
 */
export function ReorderSheet({
  open,
  onClose,
  workoutId,
  wes,
  exMap,
}: {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  wes: WorkoutExercise[];
  exMap: Map<string, Exercise>;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);
  const start = useRef<{ y: number; index: number; h: number } | null>(null);

  useEffect(() => {
    if (open) setOrder(wes.map((w) => w.id));
    // Bare når arket åpnes: endringer i økta mens man sorterer skal ikke nullstille rekkefølgen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = async () => {
    if (order.length) await setWorkoutExerciseOrder(workoutId, order);
    onClose();
  };
  const byId = new Map(wes.map((w) => [w.id, w]));

  return (
    <Sheet open={open} onClose={() => void close()} title={t('Endre rekkefølge', 'Reorder exercises')}>
      <p className="mb-3 text-sm text-muted">{t('Dra i ≡ for å flytte en øvelse.', 'Drag ≡ to move an exercise.')}</p>
      <ol className="flex flex-col gap-1.5" aria-label={t('Øvelser i økta', 'Exercises in the workout')}>
        {order.map((id, i) => {
          const we = byId.get(id);
          if (!we) return null;
          const ex = exMap.get(we.exercise_id);
          const dragging = drag?.id === id;
          return (
            <li
              key={id}
              data-reorder-item
              className={`flex items-center gap-2 rounded-xl border bg-surface py-1 pr-1 pl-1 ${dragging ? 'z-10 border-accent shadow-xl' : 'border-line'}`}
              style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              <span
                role="button"
                tabIndex={-1}
                aria-label={t(`Dra ${exerciseName(ex)}`, `Drag ${exerciseName(ex)}`)}
                className="grid h-11 w-10 shrink-0 cursor-grab touch-none place-items-center text-xl text-faint active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const h = (e.currentTarget.closest('li')?.offsetHeight ?? 52) + 6;
                  start.current = { y: e.clientY, index: i, h };
                  setDrag({ id, dy: 0 });
                  void buzz(8);
                }}
                onPointerMove={(e) => {
                  const s = start.current;
                  if (!s || !drag) return;
                  const dy = e.clientY - s.y;
                  const cur = order.indexOf(id);
                  const target = Math.max(0, Math.min(order.length - 1, s.index + Math.round(dy / s.h)));
                  if (target !== cur) {
                    setOrder(move(order, cur, target));
                    void buzz(5);
                  }
                  // Forskyv mot plassen den nå har, så den følger fingeren.
                  setDrag({ id, dy: dy - (target - s.index) * s.h });
                }}
                onPointerUp={() => {
                  start.current = null;
                  setDrag(null);
                }}
                onPointerCancel={() => {
                  start.current = null;
                  setDrag(null);
                }}
              >
                ≡
              </span>
              {ex && <MuscleDot group={ex.muscle_group} size={9} />}
              <span className="min-w-0 flex-1 truncate font-medium">{exerciseName(ex)}</span>
              <IconButton icon="up" label={t(`Flytt ${exerciseName(ex)} opp`, `Move ${exerciseName(ex)} up`)} disabled={i === 0} className="size-10 disabled:opacity-30" onClick={() => setOrder(move(order, i, i - 1))} />
              <IconButton icon="down" label={t(`Flytt ${exerciseName(ex)} ned`, `Move ${exerciseName(ex)} down`)} disabled={i === order.length - 1} className="size-10 disabled:opacity-30" onClick={() => setOrder(move(order, i, i + 1))} />
            </li>
          );
        })}
      </ol>
      <Button full className="mt-4" onClick={() => void close()}>
        {t('Ferdig', 'Done')}
      </Button>
    </Sheet>
  );
}
