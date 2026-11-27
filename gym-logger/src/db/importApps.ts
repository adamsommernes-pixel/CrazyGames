// Import fra andre apper: Hevy og Strong (CSV-eksport). Radene gjøres om til en vanlig
// Repgrade-backup (som Lyfto-importen), så sammenslåing og synk er de samme. Id-ene lages fra
// innholdet, så samme fil kan leses inn flere ganger uten duplikater.
import type { Backup } from './backup';
import { isLyfto, lyftoToBackup, guess, LYFTO_MAP, prettify } from './importLyfto';
import { BUILTIN_EXERCISES, englishName } from './library';
import type { ExerciseKind, MuscleGroup, Row, SetType } from './types';
import { t } from '../i18n';

export type ImportSource = 'repgrade' | 'lyfto' | 'hevy' | 'strong';
export const SOURCE_LABEL: Record<ImportSource, string> = { repgrade: 'Repgrade', lyfto: 'Lyfto', hevy: 'Hevy', strong: 'Strong' };

// ---------- CSV ----------

/** Leser CSV med anførselstegn. Skilletegn (komma eller semikolon) finnes fra første linje. */
export function parseCSV(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.indexOf('\n') >>> 0);
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// ---------- Øvelsesnavn ----------

const norm = (s: string) => s.toLowerCase().replace(/\bbiceps?\b/g, 'bicep').replace(/\btriceps?\b/g, 'tricep').replace(/[^a-z0-9]+/g, ' ').trim();

/** Navn fra Hevy/Strong som ikke treffes automatisk. Nøkkel: normalisert navn. */
const NAME_MAP: Record<string, string> = {
  'bent over row barbell': 'stangroing',
  'bent over row dumbbell': 'roing-med-manual',
  'dumbbell row': 'roing-med-manual',
  'incline bench press dumbbell': 'skrabenk-med-manualer',
  'bench press dumbbell': 'benkpress-med-manualer',
  'bench press smith machine': 'smith-benkpress',
  'shoulder press dumbbell': 'skulderpress-med-manualer',
  'seated overhead press dumbbell': 'skulderpress-med-manualer',
  'overhead press dumbbell': 'skulderpress-med-manualer',
  'shoulder press machine': 'skulderpress-i-maskin',
  'bicep curl barbell': 'bicepscurl-med-stang',
  'bicep curl dumbbell': 'bicepscurl-med-manualer',
  'bicep curl cable': 'kabelcurl',
  'ez bar bicep curl': 'ez-curl',
  'tricep pushdown': 'triceps-pushdown',
  'tricep pushdown cable': 'triceps-pushdown',
  'tricep rope pushdown': 'tau-pushdown',
  'skullcrusher barbell': 'fransk-press',
  'skullcrusher ez bar': 'skull-crushers-ez',
  'lying leg curl machine': 'larcurl',
  'seated leg curl machine': 'setelarcurl',
  'leg extension machine': 'beinspark',
  'leg press machine': 'beinpress',
  'calf raise standing': 'tahev-staende',
  'standing calf raise machine': 'tahev-staende',
  'seated calf raise machine': 'tahev-sittende',
  'lat pulldown cable': 'nedtrekk',
  'seated cable row v grip cable': 'sittende-roing',
  'seated row cable': 'sittende-roing',
  'chest fly dumbbell': 'flyes-med-manualer',
  'cable fly crossovers': 'kabelflyes',
  'chest press machine': 'brystpress-i-maskin',
  'hip thrust barbell': 'hip-thrust',
  'romanian deadlift barbell': 'rumensk-markloft',
  'romanian deadlift dumbbell': 'rumensk-markloft-manualer',
  'lunge dumbbell': 'utfall',
  'walking lunge dumbbell': 'walking-lunges',
  'goblet squat kettlebell': 'goblet-squat',
  'shrug dumbbell': 'shrugs',
  'shrug barbell': 'shrugs',
  'lateral raise cable': 'sidehev-i-kabel',
  'reverse fly dumbbell': 'omvendt-flyes',
  'triceps dip': 'dips',
  'chest dip': 'dips',
  'pull up': 'pull-ups',
  'chin up': 'chin-ups',
  'push up': 'push-ups',
  'sit up': 'situps',
  crunch: 'situps',
  'hanging leg raise': 'hengende-beinhev',
  running: 'loping',
  cycling: 'sykkel-ute',
  'cycling indoor': 'sykkel',
  'stationary bike': 'sykkel',
  'rowing machine': 'romaskin',
  'elliptical trainer': 'ellipsemaskin',
  'stair machine': 'trappemaskin',
  'jump rope': 'hoppetau',
};

const BY_EN = new Map(BUILTIN_EXERCISES.map((e) => [norm(englishName(e.id) ?? ''), e]));
const BY_NB = new Map(BUILTIN_EXERCISES.map((e) => [norm(e.name), e]));
const BY_ID = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));

/** Finner en innebygd øvelse for et navn som «Bench Press (Dumbbell)». */
export function matchExercise(name: string) {
  const full = norm(name);
  const equip = /\(([^)]*)\)/.exec(name)?.[1] ?? '';
  const base = norm(name.replace(/\([^)]*\)/g, '').replace(/\s+-\s+.*$/, ''));
  const eq = norm(equip.replace(/\s+-.*$/, ''));
  const slug = NAME_MAP[full] ?? NAME_MAP[base];
  if (slug) return BY_ID.get(`ex-${slug}`);
  for (const key of [full, eq ? `${eq} ${base}` : '', base]) {
    if (!key) continue;
    const hit = BY_EN.get(key) ?? BY_NB.get(key);
    if (hit) return hit;
  }
  const lyfto = LYFTO_MAP[base.replace(/ /g, '-')];
  return lyfto ? BY_ID.get(`ex-${lyfto}`) : undefined;
}

// ---------- Felles bygging ----------

interface FlatSet {
  workoutKey: string;
  workoutName: string;
  start: string;
  end: string | null;
  workoutNotes: string;
  exercise: string;
  exerciseNotes: string;
  type: SetType;
  weightKg: number;
  reps: number;
  km: number;
  seconds: number;
}

/** Kort, stabil hash for id-er. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function buildBackup(source: ImportSource, rows: FlatSet[]): Backup {
  const stamp = new Date().toISOString();
  const row = (id: string): Row => ({ id, updated_at: stamp, deleted: 0, dirty: 1 });
  const exercises: Row[] = [];
  const made = new Map<string, { id: string; kind: ExerciseKind }>();
  const exerciseFor = (name: string, sample: FlatSet) => {
    const hit = made.get(name);
    if (hit) return hit;
    const builtin = matchExercise(name);
    let out: { id: string; kind: ExerciseKind };
    if (builtin) out = { id: builtin.id, kind: builtin.kind ?? 'weight' };
    else {
      const g = guess(norm(name).replace(/ /g, '-'));
      const kind: ExerciseKind = sample.km > 0 ? 'cardio' : sample.seconds > 0 && !sample.reps ? 'time' : 'weight';
      const group: MuscleGroup = kind === 'cardio' ? 'Kondisjon' : g.group;
      const id = `${source}-ex-${hash(name)}`;
      exercises.push({ ...row(id), name: name || prettify(id), muscle_group: group, equipment: g.equipment, custom: 1, kind } as Row);
      out = { id, kind };
    }
    made.set(name, out);
    return out;
  };

  const byWorkout = new Map<string, FlatSet[]>();
  for (const r of rows) {
    if (!byWorkout.has(r.workoutKey)) byWorkout.set(r.workoutKey, []);
    byWorkout.get(r.workoutKey)!.push(r);
  }
  const workouts: Row[] = [];
  const wes: Row[] = [];
  const sets: Row[] = [];
  for (const [key, list] of byWorkout) {
    const wid = `${source}-w-${hash(key)}`;
    const first = list[0];
    const order: string[] = [];
    for (const r of list) if (!order.includes(r.exercise)) order.push(r.exercise);
    order.forEach((name, pos) => {
      const items = list.filter((r) => r.exercise === name);
      const ex = exerciseFor(name, items[0]);
      const weid = `${wid}-${pos}`;
      wes.push({ ...row(weid), workout_id: wid, exercise_id: ex.id, position: pos, rest_seconds: 120, notes: items[0].exerciseNotes } as Row);
      items.forEach((r, i) => {
        // Kondisjon: minutter i reps-feltet. Tid: sekunder.
        const reps = ex.kind === 'cardio' ? Math.round((r.seconds / 60) * 10) / 10 : ex.kind === 'time' ? r.seconds || r.reps : r.reps;
        sets.push({
          ...row(`${weid}-${i}`),
          workout_exercise_id: weid,
          workout_id: wid,
          exercise_id: ex.id,
          position: i,
          weight: Math.round(r.weightKg * 100) / 100,
          reps,
          distance_km: ex.kind === 'cardio' && r.km ? r.km : null,
          set_type: r.type,
          completed_at: r.end ?? r.start,
        } as Row);
      });
    });
    workouts.push({ ...row(wid), routine_id: null, name: first.workoutName || SOURCE_LABEL[source], started_at: first.start, ended_at: first.end ?? first.start, notes: first.workoutNotes } as Row);
  }
  return { app: 'repgrade', version: 2, exported_at: stamp, tables: { exercises, workouts, workout_exercises: wes, sets } };
}

const num = (s: string | undefined) => {
  const n = parseFloat((s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Leser datoer som «15 Jan 2024, 10:30», «2024-01-15 10:30:00» eller ISO. Uten tidssone = lokal tid. */
export function parseDate(s: string): string | null {
  if (!s) return null;
  let m = /^(\d{1,2}) (\w{3})\w* (\d{4}),? (\d{1,2}):(\d{2})/.exec(s);
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase());
    if (mon >= 0) return new Date(+m[3], mon, +m[1], +m[4], +m[5]).toISOString();
  }
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** «1h 5m», «45m», «30s» eller sekunder. */
function durationSec(s: string): number {
  if (/^\d+(\.\d+)?$/.test(s)) return num(s);
  let sec = 0;
  for (const [, v, u] of s.matchAll(/(\d+)\s*([hms])/g)) sec += +v * (u === 'h' ? 3600 : u === 'm' ? 60 : 1);
  return sec;
}

const LB = 0.45359237;
const MI = 1.609344;

// ---------- Hevy ----------

export const isHevy = (rows: Record<string, string>[]) => !!rows[0] && 'exercise_title' in rows[0] && 'start_time' in rows[0];

export function hevyToBackup(rows: Record<string, string>[]): Backup {
  const flat: FlatSet[] = [];
  for (const r of rows) {
    const start = parseDate(r.start_time);
    if (!start) continue;
    const t = r.set_type;
    const lbs = 'weight_lbs' in r && !('weight_kg' in r);
    const miles = 'distance_miles' in r && !('distance_km' in r);
    flat.push({
      workoutKey: `${r.title}|${r.start_time}`,
      workoutName: r.title,
      start,
      end: parseDate(r.end_time),
      workoutNotes: r.description ?? '',
      exercise: r.exercise_title,
      exerciseNotes: r.exercise_notes ?? '',
      type: t === 'warmup' ? 'warmup' : t === 'dropset' ? 'drop' : t === 'failure' ? 'failure' : 'normal',
      weightKg: lbs ? num(r.weight_lbs) * LB : num(r.weight_kg),
      reps: num(r.reps),
      km: miles ? num(r.distance_miles) * MI : num(r.distance_km),
      seconds: num(r.duration_seconds),
    });
  }
  return buildBackup('hevy', flat);
}

// ---------- Strong ----------

export const isStrong = (rows: Record<string, string>[]) => !!rows[0] && 'Exercise Name' in rows[0] && 'Set Order' in rows[0];

/** Strong lagrer vekt i brukerens enhet uten å si hvilken, så den må oppgis. */
export function strongToBackup(rows: Record<string, string>[], unit: 'kg' | 'lbs'): Backup {
  const flat: FlatSet[] = [];
  for (const r of rows) {
    const start = parseDate(r.Date);
    const order = (r['Set Order'] ?? '').toUpperCase();
    if (!start || !r['Exercise Name'] || !/^(\d+|W|D|F)$/.test(order)) continue;
    const dur = durationSec(r.Duration ?? r['Duration (sec)'] ?? '');
    const weight = num(r.Weight ?? r['Weight (kg)'] ?? r['Weight (lbs)']);
    const lbs = 'Weight (lbs)' in r || (!('Weight (kg)' in r) && unit === 'lbs');
    const km = num(r.Distance ?? r['Distance (km)'] ?? r['Distance (mi)']);
    flat.push({
      workoutKey: `${r['Workout Name']}|${r.Date}`,
      workoutName: r['Workout Name'],
      start,
      end: dur ? new Date(new Date(start).getTime() + dur * 1000).toISOString() : null,
      workoutNotes: r['Workout Notes'] ?? '',
      exercise: r['Exercise Name'],
      exerciseNotes: r.Notes ?? '',
      type: order === 'W' ? 'warmup' : order === 'D' ? 'drop' : order === 'F' ? 'failure' : 'normal',
      weightKg: lbs ? weight * LB : weight,
      reps: num(r.Reps),
      km: 'Distance (mi)' in r || (!('Distance (km)' in r) && unit === 'lbs') ? km * MI : km,
      seconds: num(r.Seconds),
    });
  }
  return buildBackup('strong', flat);
}

// ---------- Hva slags fil? ----------

/** Leser en fil fra Repgrade, Lyfto, Hevy eller Strong og gir data som parseBackup/importBackup forstår. */
export function convertImport(text: string, unit: 'kg' | 'lbs'): { source: ImportSource; data: unknown } {
  const trimmed = text.replace(/^﻿/, '').trimStart();
  if (trimmed.startsWith('{')) {
    const json: unknown = JSON.parse(trimmed);
    return isLyfto(json) ? { source: 'lyfto', data: lyftoToBackup(json) } : { source: 'repgrade', data: json };
  }
  const rows = parseCSV(trimmed);
  if (isHevy(rows)) return { source: 'hevy', data: hevyToBackup(rows) };
  if (isStrong(rows)) return { source: 'strong', data: strongToBackup(rows, unit) };
  throw new Error(t('Fant ikke ut hvilken app filen kommer fra. Bruk eksporten fra Repgrade, Lyfto, Hevy eller Strong.', 'Could not tell which app the file is from. Use the export from Repgrade, Lyfto, Hevy or Strong.'));
}
