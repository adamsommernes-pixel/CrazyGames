// Import fra Lyfto (JSON-eksporten, schema «lyfto-export»). Filen gjøres om til en vanlig
// Repgrade-backup og leses inn med importBackup, så forhåndsvisning, sammenslåing og synk er de
// samme som for egne backuper. Id-ene er faste («lyfto-…»), så samme fil kan leses inn flere ganger
// uten duplikater.
import type { Backup } from './backup';
import { BUILTIN_EXERCISES } from './library';
import type { Equipment, ExerciseKind, MuscleGroup, Row } from './types';
import { MUSCLE_LABEL } from './types';

/** Lyfto-øvelse → Repgrade-slug. Øvelser som mangler her blir egne øvelser. */
export const LYFTO_MAP: Record<string, string> = {
  'bench-press': 'benkpress',
  'incline-bench-press': 'skrabenk',
  'decline-bench-press': 'nedoverbenk',
  'dumbbell-bench-press': 'benkpress-med-manualer',
  'incline-dumbbell-press': 'skrabenk-med-manualer',
  'chest-press-machine': 'brystpress-i-maskin',
  'dumbbell-fly': 'flyes-med-manualer',
  'cable-fly': 'kabelflyes',
  'pec-deck': 'pec-deck',
  'push-up': 'push-ups',
  dip: 'dips',
  dips: 'dips',
  deadlift: 'markloft',
  'romanian-deadlift': 'rumensk-markloft',
  'sumo-deadlift': 'sumo-markloft',
  'barbell-row': 'stangroing',
  'pendlay-row': 'pendlay-roing',
  'pull-up': 'pull-ups',
  'weighted-pull-up': 'pull-ups',
  'chin-up': 'chin-ups',
  'lat-pulldown': 'nedtrekk',
  'close-grip-lat-pulldown': 'nedtrekk-smalt-grep',
  'cable-row': 'sittende-roing',
  'wide-grip-cable-row': 'sittende-roing',
  'dumbbell-row': 'roing-med-manual',
  'tbar-row': 't-bar-roing',
  't-bar-row': 't-bar-roing',
  'chest-supported-t-bar-row': 't-bar-roing',
  'machine-iso-row': 'maskinroing',
  'back-extension': 'hyperekstensjon',
  'good-morning': 'good-morning',
  'rack-pull': 'rack-pull',
  'straight-arm-pulldown': 'rett-arm-nedtrekk',
  'overhead-press': 'militaerpress',
  'seated-barbell-press': 'sittende-militaerpress',
  'dumbbell-shoulder-press': 'skulderpress-med-manualer',
  'machine-shoulder-press': 'skulderpress-i-maskin',
  'leverage-shoulder-press': 'skulderpress-i-maskin',
  'arnold-press': 'arnoldpress',
  'lateral-raise': 'sidehev',
  'cable-lateral-raise': 'sidehev-i-kabel',
  'single-arm-cable-lateral-raise': 'sidehev-i-kabel',
  'face-pull': 'face-pulls',
  'reverse-fly': 'omvendt-flyes',
  'cable-rear-delt-fly': 'kabel-omvendt-flyes',
  'front-raise': 'frontloft',
  'upright-row': 'oppstaende-roing',
  shrug: 'shrugs',
  'barbell-curl': 'bicepscurl-med-stang',
  'dumbbell-curl': 'bicepscurl-med-manualer',
  'hammer-curl': 'hammercurl',
  'cable-curl': 'kabelcurl',
  'cable-hammer-curl': 'kabel-hammercurl',
  'preacher-curl': 'preacher-curl',
  'incline-curl': 'incline-curl',
  'concentration-curl': 'konsentrasjonscurl',
  'ez-bar-curl': 'ez-curl',
  'dumbbell-reverse-curl': 'reverse-curl',
  'reverse-curl': 'reverse-curl',
  'tricep-pushdown': 'triceps-pushdown',
  'rope-pushdown': 'tau-pushdown',
  'skull-crusher': 'fransk-press',
  'cable-overhead-extension': 'triceps-overhead-i-kabel',
  'overhead-tricep-extension': 'overhead-manual',
  'close-grip-bench-press': 'smal-benkpress',
  'wrist-curl-dumbbell': 'handleddscurl',
  'wrist-curl': 'handleddscurl',
  squat: 'kneboy',
  'front-squat': 'frontboy',
  'leg-press': 'beinpress',
  lunge: 'utfall',
  'walking-lunge': 'walking-lunges',
  'bulgarian-split-squat': 'bulgarsk-splittboy',
  'leg-extension': 'beinspark',
  'leg-curl': 'larcurl',
  'seated-leg-curl': 'setelarcurl',
  'standing-calf-raise': 'tahev-staende',
  'seated-calf-raise': 'tahev-sittende',
  'hack-squat': 'hack-squat',
  'barbell-hack-squat': 'hack-squat',
  'goblet-squat': 'goblet-squat',
  'dumbbell-step-up': 'step-ups',
  'step-up': 'step-ups',
  'hip-thrust': 'hip-thrust',
  'glute-bridge': 'glute-bridge',
  'abductor-machine': 'hip-abduction',
  'adductor-machine': 'adduktor-maskin',
  plank: 'planke',
  'dead-bug': 'dead-bug',
  'hanging-leg-raise': 'hengende-beinhev',
  'ab-wheel': 'ab-wheel',
  'cable-crunch': 'kabel-crunch',
  'russian-twist': 'russian-twist',
  'stationary-bike': 'sykkel',
  treadmill: 'tredemolle',
  'rowing-machine': 'romaskin',
  running: 'loping',
};

const MUSCLE: Record<string, MuscleGroup> = {
  chest: 'Bryst', back: 'Rygg', lats: 'Rygg', traps: 'Rygg', shoulders: 'Skuldre', delts: 'Skuldre', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Underarmer', quads: 'Bein', quadriceps: 'Bein', hamstrings: 'Bein', calves: 'Bein', legs: 'Bein', glutes: 'Rumpe', abs: 'Mage', core: 'Mage', cardio: 'Kondisjon',
};
const EQUIP: Record<string, Equipment> = { barbell: 'Stang', dumbbell: 'Manualer', machine: 'Maskin', cable: 'Kabel', bodyweight: 'Kroppsvekt', kettlebell: 'Kettlebell' };

/** Gjetter muskelgruppe og utstyr for en ukjent Lyfto-øvelse ut fra id-en. */
export function guess(id: string): { group: MuscleGroup; equipment: Equipment } {
  const has = (...w: string[]) => w.some((x) => id.includes(x));
  const group: MuscleGroup = has('wrist') ? 'Underarmer' : has('curl') ? 'Biceps' : has('pushdown', 'tricep', 'kickback') ? 'Triceps' : has('calf', 'squat', 'leg') ? 'Bein'
    : has('delt', 'shoulder', 'raise', 'pull-apart') ? 'Skuldre' : has('row', 'pull') ? 'Rygg' : has('press', 'fly', 'chest') ? 'Bryst' : has('landmine', 'ab', 'crunch') ? 'Mage' : 'Annet';
  const equipment: Equipment = has('cable') ? 'Kabel' : has('machine', 'smith') ? 'Maskin' : has('dumbbell') ? 'Manualer' : has('barbell', 'landmine') ? 'Stang' : has('band') ? 'Annet' : 'Annet';
  return { group, equipment };
}
export const prettify = (id: string) => id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

interface LSet { weight?: number; reps?: number; completed?: boolean; isWarmup?: boolean; completedAt?: string }
interface LExercise { id: string; exerciseId: string; sets?: LSet[]; restSeconds?: number; notes?: string }
interface LWorkout { id: string; date: string; durationSeconds?: number; notes?: string; exercises?: LExercise[] }
interface LCustom { id: string; name: string; primaryMuscles?: string[]; equipment?: string }
export interface LyftoExport {
  schema: 'lyfto-export';
  exportedAt?: string;
  workouts?: LWorkout[];
  bodyWeight?: { date: string; weight: number }[];
  templates?: { id: string; name: string; exerciseIds?: string[] }[];
  customExercises?: LCustom[];
  coachPrefs?: { weightUnit?: string };
}

export const isLyfto = (json: unknown): json is LyftoExport => (json as { schema?: unknown })?.schema === 'lyfto-export';

const BUILTIN = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));

/** Gjør en Lyfto-eksport om til en Repgrade-backup. Bare fullførte sets tas med. */
export function lyftoToBackup(data: LyftoExport): Backup {
  const stamp = data.exportedAt ?? new Date().toISOString();
  const row = (id: string): Row => ({ id, updated_at: stamp, deleted: 0, dirty: 1 });
  const kg = data.coachPrefs?.weightUnit === 'lbs' ? 0.45359237 : 1;
  const exercises: Row[] = [];
  const made = new Map<string, { id: string; group: MuscleGroup; kind: ExerciseKind }>();

  /** Repgrade-øvelsen for en Lyfto-id (lager en egen øvelse første gang den trengs). */
  const exerciseFor = (lid: string) => {
    const hit = made.get(lid);
    if (hit) return hit;
    const slug = LYFTO_MAP[lid];
    const builtin = slug ? BUILTIN.get(`ex-${slug}`) : undefined;
    let out: { id: string; group: MuscleGroup; kind: ExerciseKind };
    if (builtin) {
      out = { id: builtin.id, group: builtin.muscle_group, kind: builtin.kind ?? 'weight' };
    } else {
      const custom = data.customExercises?.find((c) => c.id === lid);
      const g = guess(lid);
      const group = (custom?.primaryMuscles ?? []).map((m) => MUSCLE[m]).find(Boolean) ?? g.group;
      const equipment = (custom?.equipment && EQUIP[custom.equipment]) || g.equipment;
      const id = `lyfto-ex-${lid}`;
      exercises.push({ ...row(id), name: custom?.name ?? prettify(lid), muscle_group: group, equipment, custom: 1, kind: 'weight' } as Row);
      out = { id, group, kind: 'weight' };
    }
    made.set(lid, out);
    return out;
  };

  const workouts: Row[] = [];
  const workoutExercises: Row[] = [];
  const sets: Row[] = [];
  for (const w of data.workouts ?? []) {
    const wid = `lyfto-w-${w.id}`;
    const groups = new Map<MuscleGroup, number>();
    let firstSet = w.date;
    let any = false;
    (w.exercises ?? []).forEach((e, pos) => {
      const done = (e.sets ?? []).filter((s) => s.completed);
      if (!done.length) return;
      any = true;
      const ex = exerciseFor(e.exerciseId);
      const weid = `lyfto-we-${e.id}`;
      workoutExercises.push({ ...row(weid), workout_id: wid, exercise_id: ex.id, position: pos, rest_seconds: e.restSeconds ?? 120, notes: e.notes ?? '' } as Row);
      groups.set(ex.group, (groups.get(ex.group) ?? 0) + done.length);
      done.forEach((s, i) => {
        if (s.completedAt && s.completedAt < firstSet) firstSet = s.completedAt;
        sets.push({
          ...row(`lyfto-s-${e.id}-${i}`),
          workout_exercise_id: weid,
          workout_id: wid,
          exercise_id: ex.id,
          position: i,
          weight: Math.round((s.weight ?? 0) * kg * 100) / 100,
          reps: s.reps ?? 0,
          distance_km: null,
          set_type: s.isWarmup ? 'warmup' : 'normal',
          completed_at: s.completedAt ?? w.date,
        } as Row);
      });
    });
    if (!any) continue;
    const end = w.date;
    const fromDuration = new Date(new Date(end).getTime() - (w.durationSeconds ?? 0) * 1000).toISOString();
    const started = firstSet < fromDuration ? firstSet : fromDuration;
    // Lyfto lagrer ikke navn på økter: bruk de to muskelgruppene med flest sets.
    const top = [...groups.entries()].filter(([g]) => g !== 'Kondisjon').sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => MUSCLE_LABEL[g]);
    const name = top.length ? top.join(' + ') : MUSCLE_LABEL.Kondisjon;
    workouts.push({ ...row(wid), routine_id: null, name, started_at: started, ended_at: end, notes: w.notes ?? '' } as Row);
  }

  const routines: Row[] = [];
  const routineExercises: Row[] = [];
  for (const tpl of data.templates ?? []) {
    const rid = `lyfto-r-${tpl.id}`;
    routines.push({ ...row(rid), name: tpl.name, notes: '', source: null, position: null } as Row);
    (tpl.exerciseIds ?? []).forEach((lid, i) =>
      routineExercises.push({ ...row(`lyfto-re-${tpl.id}-${i}`), routine_id: rid, exercise_id: exerciseFor(lid).id, position: i, target_sets: 3, target_reps: 10, rest_seconds: 120 } as Row),
    );
  }

  const bodyweights = (data.bodyWeight ?? []).map((b) => ({ ...row(`lyfto-bw-${b.date.slice(0, 10)}`), date: b.date, weight_kg: Math.round(b.weight * kg * 10) / 10 }) as Row);

  return {
    app: 'repgrade',
    version: 2,
    exported_at: stamp,
    tables: { exercises, workouts, workout_exercises: workoutExercises, sets, routines, routine_exercises: routineExercises, bodyweights },
  };
}
