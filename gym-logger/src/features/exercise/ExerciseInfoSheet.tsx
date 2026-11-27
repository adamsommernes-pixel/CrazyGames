import { EditExerciseSheet } from './EditExerciseSheet';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/dexie';
import type { Exercise, Workout, WorkoutSet } from '../../db/types';
import { Button, Chip, IconButton, Sheet } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ExerciseGuide, ExerciseMeta } from './ExerciseGuide';
import { countsAsWork } from '../../lib/calc';
import { formatSet } from '../../lib/kinds';
import { dateShort } from '../../lib/format';
import { exerciseName } from '../../lib/exerciseName';
import { toggleFavorite, useSetting } from '../../lib/settings';
import { t } from '../../i18n';

/** De siste øktene med øvelsen, nyeste først. */
async function recentSessions(exerciseId: string, limit = 5) {
  const sets = (await db.sets.where('exercise_id').equals(exerciseId).toArray()).filter((s) => !s.deleted && countsAsWork(s));
  const ids = [...new Set(sets.map((s) => s.workout_id))];
  const workouts = ((await db.workouts.bulkGet(ids)).filter((w) => w && !w.deleted && w.ended_at) as Workout[]).sort((a, b) =>
    a.started_at < b.started_at ? 1 : -1,
  );
  return workouts.slice(0, limit).map((w) => ({
    workout: w,
    sets: sets.filter((s) => s.workout_id === w.id).sort((a, b) => a.position - b.position) as WorkoutSet[],
  }));
}

/**
 * Infoark for en øvelse, tilgjengelig uten å forlate økta:
 * fremgangsmåte og de siste øktene. Stjerne for favoritt.
 */
export function ExerciseInfoSheet({ exercise, onClose, demo = false }: { exercise: Exercise | null; onClose: () => void; demo?: boolean }) {
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const favorites = useSetting('favorites');
  const [tab, setTab] = useState<'guide' | 'history'>('guide');
  const [editing, setEditing] = useState(false);
  const sessions = useLiveQuery(async () => (exercise ? recentSessions(exercise.id) : []), [exercise?.id], []);
  if (!exercise) return null;
  const fav = favorites.includes(exercise.id);
  const kind = exercise.kind ?? 'weight';

  return (
    <Sheet open onClose={onClose} title={exerciseName(exercise)} tall>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <ExerciseMeta exercise={exercise} />
        </div>
        <IconButton
          icon="star"
          filled={fav}
          label={fav ? t('Fjern fra favoritter', 'Remove from favourites') : t('Legg til i favoritter', 'Add to favourites')}
          aria-pressed={fav}
          className={fav ? 'text-warn' : ''}
          onClick={() => void toggleFavorite(exercise.id)}
        />
      </div>

      <div className="mt-4 mb-4 flex gap-2" role="tablist">
        <Chip active={tab === 'guide'} onClick={() => setTab('guide')}>
          {t('Slik gjør du', 'How to')}
        </Chip>
        <Chip active={tab === 'history'} onClick={() => setTab('history')}>
          {t('Historikk', 'History')}
        </Chip>
      </div>

      {tab === 'guide' ? (
        <ExerciseGuide exercise={exercise} autoStartDemo={demo} />
      ) : sessions.length === 0 ? (
        <p className="py-6 text-center text-muted">{t('Du har ikke logget denne øvelsen ennå.', 'You have not logged this exercise yet.')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map(({ workout, sets }) => (
            <li key={workout.id} className="rounded-xl border border-line bg-raised p-3">
              <div className="mb-1 text-sm text-muted">
                {dateShort(workout.started_at)} · {workout.name}
              </div>
              <div className="font-num flex flex-wrap gap-x-3 gap-y-1 font-semibold">
                {sets.map((s) => (
                  <span key={s.id}>{formatSet(s, kind, unit)}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {exercise.custom ? (
        <Button variant="secondary" full icon="edit" className="mt-4" onClick={() => setEditing(true)}>
          {t('Rediger øvelse', 'Edit exercise')}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        full
        className="mt-2"
        onClick={() => {
          onClose();
          navigate(`/exercise/${exercise.id}`);
        }}
      >
        <Icon name="chart" size={18} /> {t('Rekorder og grafer', 'Records and charts')}
      </Button>
      {editing && <EditExerciseSheet exercise={exercise} onClose={() => setEditing(false)} onDeleted={() => { setEditing(false); onClose(); }} />}
    </Sheet>
  );
}
