import { Logo } from '../../components/Logo';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db/dexie';
import { renameWorkout, setsForWorkout, workoutExercises } from '../../db/repo';
import { Button, Card, PRBadge, SectionTitle, Sheet, Stat, inputClass } from '../../components/ui';
import { Confetti } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { useExerciseMap } from '../workout/ExercisePicker';
import { usePRMap } from '../../lib/prs';
import { useSetting } from '../../lib/settings';
import { PR_LABEL, volume } from '../../lib/calc';
import { durationShort, num, toDisplay } from '../../lib/format';
import { formatSetShort, kindOf } from '../../lib/kinds';
import { exerciseName } from '../../lib/exerciseName';
import { MUSCLE_LABEL, type MuscleGroup } from '../../db/types';
import { t } from '../../i18n';

const ShareSheet = lazy(() => import('../share/ShareSheet'));

const prText = (n: number) => t(`${n} ny${n === 1 ? '' : 'e'} rekord${n === 1 ? '' : 'er'}`, `${n} new record${n === 1 ? '' : 's'}`);

/** Oppsummering rett etter en økt: tall, rekorder og sammenligning med forrige gang. */
export function Summary() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const unit = useSetting('unit');
  const exMap = useExerciseMap();
  const prMap = usePRMap();
  const [copied, setCopied] = useState(false);
  const [fire, setFire] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');

  const data = useLiveQuery(async () => {
    const workout = await db.workouts.get(id);
    if (!workout) return null;
    const sets = (await setsForWorkout(id)).filter((s) => s.completed_at);
    const wes = await workoutExercises(id);
    // Forrige økt av samme rutine (eller med samme navn) til sammenligning.
    const earlier = (await db.workouts.toArray())
      .filter((w) => !w.deleted && w.ended_at && w.id !== id && w.started_at < workout.started_at)
      .filter((w) => (workout.routine_id ? w.routine_id === workout.routine_id : w.name === workout.name))
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
    const prevVolume = earlier ? volume((await setsForWorkout(earlier.id)).filter((s) => s.completed_at)) : null;
    return { workout, sets, wes, prevVolume };
  }, [id]);

  const prSets = useMemo(() => (data?.sets ?? []).filter((s) => prMap.has(s.id)), [data, prMap]);
  useEffect(() => {
    if (prSets.length) setFire((f) => f + 1);
  }, [prSets.length]);

  if (data === undefined) return null;
  if (data === null) return <Navigate to="/" replace />;
  const { workout, sets, wes, prevVolume } = data;
  const vol = volume(sets);
  const diff = prevVolume ? ((vol - prevVolume) / prevVolume) * 100 : null;
  const groups = [...new Set(wes.map((we) => exMap.get(we.exercise_id)?.muscle_group).filter(Boolean))] as string[];
  const minutes = workout.ended_at ? new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime() : 0;

  const share = async () => {
    const lines = [
      `${workout.name} – ${durationShort(minutes)}, ${num(toDisplay(vol, unit), 0)} ${unit} ${t('totalt', 'total')}`,
      ...wes.map((we) => {
        const ex = sets.filter((s) => s.workout_exercise_id === we.id);
        return `${exerciseName(exMap.get(we.exercise_id))}: ${ex.map((s) => formatSetShort(s, kindOf(s.exercise_id), unit)).join(', ')}`;
      }),
      prSets.length ? `🏆 ${prText(prSets.length)}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="pt-safe mx-auto w-full max-w-xl px-4 pb-44">
      <Confetti fire={fire} />
      <section className="flex flex-col items-center pt-10 pb-6 text-center">
        <div className="relative mb-5 grid size-24 place-items-center">
          <div className="absolute inset-0 rounded-full bg-green/25 blur-2xl" />
          <div className="relative grid size-24 animate-pop place-items-center rounded-full bg-green text-black shadow-glow">
            <Icon name={prSets.length ? 'trophy' : 'check'} size={44} strokeWidth={2.4} />
          </div>
        </div>
        <p className="text-sm font-semibold tracking-wide text-green uppercase">{t('Økt fullført', 'Workout complete')}</p>
        <button type="button" onClick={() => { setTitle(workout.name); setRenaming(true); }} className="mt-1 flex items-center gap-2" aria-label={`${t('Endre tittel', 'Change title')}: ${workout.name}`}>
          <h1 className="font-num text-4xl font-bold tracking-tight">{workout.name}</h1>
          <Icon name="edit" size={18} className="text-faint" />
        </button>
        {prSets.length > 0 && (
          <p className="mt-2 text-lg text-green-light">
            {prText(prSets.length)}!
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('Varighet', 'Duration')} value={durationShort(minutes)} />
        <Stat label="Sets" value={String(sets.length)} />
        <Stat label={`${t('Volum', 'Volume')} (${unit})`} value={num(toDisplay(vol, unit), 0)} />
      </div>
      {diff !== null && (
        <p className={`mt-3 rounded-2xl px-4 py-3 text-center font-medium ${diff >= 0 ? 'bg-green-dim/40 text-green-light' : 'bg-raised text-muted'}`}>
          {diff >= 0 ? '▲' : '▼'} {num(Math.abs(diff), 0)} % {t('volum mot forrige gang', 'volume vs. last time')}
        </p>
      )}

      {prSets.length > 0 && (
        <>
          <SectionTitle>{t('Rekorder', 'Records')}</SectionTitle>
          <Card className="divide-y divide-line">
            {prSets.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{exerciseName(exMap.get(s.exercise_id))}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {prMap.get(s.id)!.map((k) => (
                      <PRBadge key={k} label={PR_LABEL[k]} />
                    ))}
                  </span>
                </span>
                <span className="font-num text-xl font-bold">{formatSetShort(s, kindOf(s.exercise_id), unit)}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {groups.length > 0 && (
        <>
          <SectionTitle>{t('Trent i dag', 'Trained today')}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <span key={g} className="rounded-full border border-line bg-raised px-3 py-1.5 text-sm">
                {MUSCLE_LABEL[g as MuscleGroup]}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 flex flex-col gap-2">
        <Button full className="min-h-14 text-lg" onClick={() => navigate('/', { replace: true })}>
          {t('Ferdig', 'Done')}
        </Button>
        <Button full variant="secondary" icon="share" onClick={() => setSharing(true)}>
          {t('Del økta', 'Share workout')}
        </Button>
        <Button full variant="ghost" onClick={() => void share()}>
          {copied ? t('Kopiert!', 'Copied!') : t('Kopier som tekst', 'Copy as text')}
        </Button>
        <Button full variant="ghost" onClick={() => navigate(`/history/${id}`)}>
          {t('Se detaljer', 'See details')}
        </Button>
      </div>
      <div className="mt-10 flex justify-center">
        <Logo size={18} className="text-sm text-faint" />
      </div>
      <Sheet open={renaming} onClose={() => setRenaming(false)} title={t('Tittel på økta', 'Workout title')}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (title.trim()) await renameWorkout(id, title.trim());
            setRenaming(false);
          }}
        >
          <input id="summary-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} autoFocus />
          <Button full type="submit" className="mt-4">
            {t('Lagre', 'Save')}
          </Button>
        </form>
      </Sheet>
      {sharing && (
        <Suspense fallback={null}>
          <ShareSheet workoutId={id} onClose={() => setSharing(false)} />
        </Suspense>
      )}
    </div>
  );
}
