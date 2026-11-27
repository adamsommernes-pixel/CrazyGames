import { useAutosave } from '../../lib/autosave';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, ExerciseKind, WorkoutExercise, WorkoutSet } from '../../db/types';
import { KIND_LABEL, SET_TYPES, SET_TYPE_LABEL } from '../../db/types';
import {
  addSet,
  addWarmupSets,
  applyWeightToPending,
  deleteSet,
  lastNotes,
  lastPerformance,
  moveWorkoutExercise,
  removeWorkoutExercise,
  restore,
  setExerciseNotes,
  setExerciseRest,
  swapWorkoutExercise,
  updateSet,
} from '../../db/repo';
import type { PRKind } from '../../lib/calc';
import { stepFor, suggestNext, warmupSets } from '../../lib/progression';
import { kindColumns } from '../../lib/kinds';
import { ActionList, Button, Card, Chip, IconButton, NumberStepper, Sheet } from '../../components/ui';
import { PlateCalculator } from '../../components/PlateCalculator';
import { MuscleDot } from '../../components/MuscleTag';
import { undoToast } from '../../components/toast';
import { Icon } from '../../components/Icon';
import { SET_GRID, SetRow } from './SetRow';
import { ExercisePicker } from './ExercisePicker';
import { ExerciseInfoSheet } from '../exercise/ExerciseInfoSheet';
import { startRest } from './restTimer';
import { duration, fromDisplay, num, toDisplay } from '../../lib/format';
import { useSetting } from '../../lib/settings';
import { exerciseName } from '../../lib/exerciseName';
import { t } from '../../i18n';

export function ExerciseCard({
  we,
  exercise,
  sets,
  unit,
  prMap,
  isFirst,
  isLast,
  currentSetId,
}: {
  we: WorkoutExercise;
  exercise?: Exercise;
  sets: WorkoutSet[];
  unit: 'kg' | 'lbs';
  prMap: Map<string, PRKind[]>;
  isFirst: boolean;
  isLast: boolean;
  /** Neste set som skal gjøres i hele økta. */
  currentSetId?: string;
}) {
  const barWeight = useSetting('barWeight');
  const plates = useSetting('plates');
  const kind: ExerciseKind = exercise?.kind ?? 'weight';
  const previous = useLiveQuery(
    async () => (await lastPerformance(we.exercise_id, we.workout_id)).filter((s) => s.set_type !== 'warmup'),
    [we.exercise_id, we.workout_id],
    [],
  );
  const previousNote = useLiveQuery(() => lastNotes(we.exercise_id, we.workout_id), [we.exercise_id, we.workout_id], '');
  const [menu, setMenu] = useState(false);
  const [restSheet, setRestSheet] = useState(false);
  const [rest, setRest] = useState(we.rest_seconds);
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [plateSheet, setPlateSheet] = useState(false);
  const [plateTarget, setPlateTarget] = useState(barWeight);
  const [showNotes, setShowNotes] = useState(!!we.notes);
  const [notes, setNotes] = useState(we.notes);
  const notesSave = useAutosave(600);
  const [info, setInfo] = useState(false);
  const [swapping, setSwapping] = useState(false);

  // Etter et bytte av øvelse hører notatet til den nye øvelsen.
  useEffect(() => {
    setNotes(we.notes);
    setShowNotes(!!we.notes);
    // Bare ved bytte av øvelse, ikke etter egen autolagring (da ville teksten hoppet).
  }, [we.exercise_id]);

  const sorted = [...sets].sort((a, b) => a.position - b.position);
  const openRest = () => {
    setRest(we.rest_seconds);
    setRestSheet(true);
  };
  const openPlates = () => {
    const pending = sorted.find((s) => !s.completed_at && s.weight > 0) ?? [...sorted].reverse().find((s) => s.weight > 0);
    setPlateTarget(pending?.weight || barWeight);
    setPlateSheet(true);
  };
  const isWeight = kind === 'weight';
  const barbell = isWeight && exercise?.equipment === 'Stang';
  const doneCount = sorted.filter((s) => s.completed_at).length;
  const pendingWork = sorted.filter((s) => !s.completed_at && s.set_type !== 'warmup');
  const workSetCount = sorted.filter((s) => s.set_type !== 'warmup').length;
  const cols = kindColumns(kind, unit);

  // Progresjon: nådde du målet på alle sett sist, foreslås ett steg tyngre (bare vekt × reps).
  const suggestion = isWeight ? suggestNext(previous, we.target_reps, stepFor(exercise?.equipment, unit)) : null;
  const showSuggestion = suggestion !== null && pendingWork.length > 0 && pendingWork.some((s) => Math.abs(s.weight - suggestion) > 0.001);

  // Oppvarming: bare for stang, og bare før første arbeidssett er gjort.
  const firstWork = sorted.find((s) => s.set_type !== 'warmup' && s.weight > 0);
  const hasWarmups = sorted.some((s) => s.set_type === 'warmup');
  const warmups = barbell && firstWork && !firstWork.completed_at && !hasWarmups ? warmupSets(firstWork.weight, barWeight, plates) : [];

  let workIndex = 0;
  let label = 0;
  let warmIndex = 0;

  return (
    <Card className={`p-3 transition-shadow ${sorted.some((s) => s.id === currentSetId) ? 'border-accent/30' : ''}`}>
      <div className="mb-1 flex items-center gap-1 pl-1">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setInfo(true)} aria-label={`${exerciseName(exercise)}: ${t('slik gjør du og historikk', 'how to and history')}`}>
          <h2 className="flex items-center gap-2 truncate text-lg font-bold text-accent">
            {exercise && <MuscleDot group={exercise.muscle_group} size={9} />}
            <span className="truncate">{exerciseName(exercise)}</span>
          </h2>
          <p className="font-num text-xs text-faint">
            {doneCount}/{sorted.length} sets
            {we.target_reps ? ` · ${t('mål', 'goal')} ${workSetCount} × ${we.target_reps}` : ''}
            {!isWeight ? ` · ${KIND_LABEL[kind]}` : ''} · {t('hvile', 'rest')} {duration(we.rest_seconds * 1000)}
          </p>
        </button>
        <IconButton icon="info" label={t('Slik gjør du', 'How to')} onClick={() => setInfo(true)} />
        {barbell && <IconButton icon="plates" label={t('Platekalkulator', 'Plate calculator')} onClick={openPlates} />}
        <IconButton icon="more" label={t('Valg for øvelse', 'Exercise options')} onClick={() => setMenu(true)} />
      </div>

      {!showNotes && previousNote && (
        <button
          type="button"
          onClick={() => {
            setNotes(previousNote);
            setShowNotes(true);
            void setExerciseNotes(we.id, previousNote);
          }}
          className="mb-2 flex w-full items-center gap-2 rounded-xl bg-raised/70 px-3 py-2 text-left text-sm text-muted"
          aria-label={t(`Notat fra sist: ${previousNote}. Trykk for å bruke det igjen.`, `Note from last time: ${previousNote}. Tap to use it again.`)}
        >
          <Icon name="note" size={15} className="shrink-0 text-faint" />
          <span className="min-w-0 flex-1 truncate">
            <span className="text-faint">{t('Sist', 'Last')}: </span>
            {previousNote}
          </span>
        </button>
      )}

      {showNotes && (
        <textarea
          aria-label={t('Notat for øvelsen', 'Exercise note')}
          className="mb-2 min-h-11 w-full resize-none rounded-xl border border-line bg-raised px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
          placeholder={t('Notat, f.eks. setehøyde 4', 'Note, e.g. seat height 4')}
          rows={1}
          value={notes}
          onChange={(e) => {
            const v = e.target.value;
            setNotes(v);
            notesSave.schedule(() => void setExerciseNotes(we.id, v));
          }}
          onBlur={notesSave.flush}
        />
      )}

      {showSuggestion && (
        <button
          type="button"
          onClick={() => void applyWeightToPending(we.id, suggestion)}
          className="mb-2 flex w-full items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft/30 px-3 py-2 text-left text-sm active:bg-accent-soft/50"
        >
          <Icon name="sparkle" size={16} className="shrink-0 text-accent" />
          <span className="flex-1">
            {t('Du klarte målet sist. Forslag:', 'You hit the goal last time. Suggestion:')}{' '}
            <span className="font-num font-bold text-accent-strong">
              {num(toDisplay(suggestion, unit))} {unit}
            </span>
          </span>
          <span className="font-semibold text-accent">{t('Bruk', 'Use')}</span>
        </button>
      )}

      <div className={`${SET_GRID} px-1 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase`}>
        <span className="text-center">Set</span>
        <span>{t('Forrige', 'Previous')}</span>
        <span className="text-center">{cols.first}</span>
        <span className="text-center">{cols.second}</span>
        <span />
      </div>
      <div className="flex flex-col gap-1">
        {sorted.map((s) => {
          const prev = s.set_type === 'warmup' ? undefined : previous[workIndex];
          if (s.set_type !== 'warmup') workIndex++;
          if (s.set_type === 'normal') label++;
          return (
            <SetRow
              key={s.id}
              set={s}
              kind={kind}
              current={s.id === currentSetId}
              label={s.set_type === 'normal' ? label : s.set_type === 'warmup' ? `${t('oppvarming', 'warm-up')} ${++warmIndex}` : `${label + 1} (${SET_TYPE_LABEL[s.set_type].toLowerCase()})`}
              previous={prev}
              unit={unit}
              prs={prMap.get(s.id)}
              targetReps={s.set_type === 'warmup' ? null : we.target_reps}
              onCompleted={() => void startRest(we.rest_seconds)}
              onMenu={() => setEditing(s)}
            />
          );
        })}
      </div>
      <Button variant="ghost" icon="plus" full className="mt-1" onClick={() => void addSet(we)}>
        {t('Legg til set', 'Add set')}
      </Button>

      <Sheet open={menu} onClose={() => setMenu(false)} title={exerciseName(exercise)}>
        <ActionList
          actions={[
            ...(warmups.length
              ? [
                  {
                    label: `${t('Legg til oppvarming', 'Add warm-up')} (${warmups.map((w) => num(toDisplay(w.weight, unit))).join(' / ')} ${unit})`,
                    icon: 'flame' as const,
                    onClick: () => void addWarmupSets(we, warmups).then(() => setMenu(false)),
                  },
                ]
              : []),
            { label: t('Slik gjør du', 'How to'), icon: 'book', onClick: () => { setMenu(false); setInfo(true); } },
            { label: t('Bytt øvelse', 'Swap exercise'), icon: 'swap', onClick: () => { setMenu(false); setSwapping(true); } },
            { label: showNotes ? t('Skjul notat', 'Hide note') : t('Legg til notat', 'Add note'), icon: 'note', onClick: () => { setShowNotes(!showNotes); setMenu(false); } },
            { label: t('Endre hviletid', 'Change rest time'), icon: 'timer', onClick: () => { setMenu(false); openRest(); } },
            ...(isWeight && !barbell ? [{ label: t('Platekalkulator', 'Plate calculator'), icon: 'plates' as const, onClick: () => { setMenu(false); openPlates(); } }] : []),
            ...(!isFirst ? [{ label: t('Flytt opp', 'Move up'), icon: 'up' as const, onClick: () => void moveWorkoutExercise(we.workout_id, we.id, -1).then(() => setMenu(false)) }] : []),
            ...(!isLast ? [{ label: t('Flytt ned', 'Move down'), icon: 'down' as const, onClick: () => void moveWorkoutExercise(we.workout_id, we.id, 1).then(() => setMenu(false)) }] : []),
            {
              label: t('Fjern øvelse', 'Remove exercise'),
              icon: 'trash',
              danger: true,
              onClick: async () => {
                setMenu(false);
                const removed = await removeWorkoutExercise(we.id);
                undoToast(t(`${exerciseName(exercise)} er fjernet`, `${exerciseName(exercise)} removed`), () => restore(removed));
              },
            },
          ]}
        />
      </Sheet>

      <Sheet open={restSheet} onClose={() => setRestSheet(false)} title={t('Hviletid', 'Rest time')}>
        <p className="mb-3 text-muted">{t(`Timeren starter når du huker av et set. Hviletiden huskes for ${exerciseName(exercise)} til neste gang.`, `The timer starts when you tick off a set. The rest time is remembered for ${exerciseName(exercise)} next time.`)}</p>
        <NumberStepper label={t('Hviletid', 'Rest time')} size="lg" value={rest} step={15} min={0} max={600} onChange={setRest} format={(v) => (v ? duration(v * 1000) : t('Av', 'Off'))} />
        <Button full className="mt-4" onClick={() => void setExerciseRest(we.id, rest).then(() => setRestSheet(false))}>
          {t('Lagre', 'Save')}
        </Button>
      </Sheet>

      <Sheet open={plateSheet} onClose={() => setPlateSheet(false)} title={t('Platekalkulator', 'Plate calculator')}>
        <NumberStepper
          label={t('Målvekt', 'Target weight')}
          size="lg"
          value={toDisplay(plateTarget, unit)}
          step={unit === 'kg' ? 2.5 : 5}
          min={0}
          max={unit === 'kg' ? 500 : 1100}
          onChange={(v) => setPlateTarget(fromDisplay(v, unit))}
          format={(v) => `${num(v)} ${unit}`}
        />
        <div className="mt-4">
          <PlateCalculator targetKg={plateTarget} barKg={barWeight} plates={plates} />
        </div>
        <p className="mt-3 text-xs text-faint">{t('Stangvekt og skiver endres under Profil → Innstillinger.', 'Bar weight and plates are changed under Profile → Settings.')}</p>
      </Sheet>

      <SetEditor set={editing} unit={unit} kind={kind} onClose={() => setEditing(null)} />
      {info && exercise && <ExerciseInfoSheet exercise={exercise} onClose={() => setInfo(false)} />}
      <ExercisePicker
        open={swapping}
        single
        title={`${t('Bytt ut', 'Replace')} ${exerciseName(exercise)}`}
        onClose={() => setSwapping(false)}
        onPick={([id]) => void swapWorkoutExercise(we.id, id)}
      />
    </Card>
  );
}

/** Ark for ett set: verdier med hold-inne-knapper, set-type og sletting. Feltene følger øvelsestypen. */
function SetEditor({ set, unit, kind, onClose }: { set: WorkoutSet | null; unit: 'kg' | 'lbs'; kind: ExerciseKind; onClose: () => void }) {
  const [first, setFirst] = useState(0);
  const [second, setSecond] = useState(0);
  const cardio = kind === 'cardio';
  useEffect(() => {
    if (set) {
      setFirst(cardio ? (set.distance_km ?? 0) : toDisplay(set.weight, unit));
      setSecond(set.reps);
    }
  }, [set, unit, cardio]);
  if (!set) return null;
  const values = () => (cardio ? { distance_km: first, reps: second } : { weight: fromDisplay(first, unit), reps: second });
  const save = async () => {
    await updateSet(set.id, values());
    onClose();
  };
  const cols = kindColumns(kind, unit);
  const firstLabel = cardio ? t('Distanse (km)', 'Distance (km)') : kind === 'weight' ? `${t('Vekt', 'Weight')} (${unit})` : `${t('Ekstra vekt', 'Extra weight')} (${unit})`;
  const secondLabel = kind === 'time' ? t('Sekunder', 'Seconds') : cardio ? t('Minutter', 'Minutes') : 'Reps';
  return (
    <Sheet open onClose={() => void save()} title={t('Rediger set', 'Edit set')}>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <div className="mb-1.5 text-sm text-muted">{firstLabel}</div>
          <NumberStepper
            label={cols.first}
            size="lg"
            value={first}
            step={cardio ? 0.5 : unit === 'kg' ? 2.5 : 5}
            max={cardio ? 200 : unit === 'kg' ? 500 : 1100}
            onChange={setFirst}
            format={(v) => num(v, 2)}
          />
        </div>
        <div>
          <div className="mb-1.5 text-sm text-muted">{secondLabel}</div>
          <NumberStepper
            label={secondLabel}
            size="lg"
            value={second}
            step={kind === 'time' ? 5 : 1}
            max={kind === 'time' ? 3600 : cardio ? 600 : 100}
            onChange={setSecond}
            format={(v) => (kind === 'time' ? duration(v * 1000) : String(v))}
          />
        </div>
      </div>
      <div className="mt-5 mb-2 text-sm text-muted">{t('Type set', 'Set type')}</div>
      <div className="flex flex-wrap gap-2">
        {SET_TYPES.map((t) => (
          <Chip key={t} active={set.set_type === t} onClick={() => void updateSet(set.id, { set_type: t, ...values() }).then(onClose)}>
            {SET_TYPE_LABEL[t]}
          </Chip>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <Button
          variant="danger"
          icon="trash"
          onClick={async () => {
            const removed = await deleteSet(set.id);
            onClose();
            undoToast(t('Settet er slettet', 'Set deleted'), () => restore(removed));
          }}
        >
          {t('Slett', 'Delete')}
        </Button>
        <Button className="flex-1" onClick={() => void save()}>
          <Icon name="check" /> {t('Lagre', 'Save')}
        </Button>
      </div>
    </Sheet>
  );
}
