import { db } from './dexie';
import { SYNCED_TABLES, type Exercise, type KV, type Row, type Workout, type WorkoutSet } from './types';
import { exerciseName } from '../lib/exerciseName';
import { computePRMap } from '../lib/prs';
import { t } from '../i18n';

// Backup: JSON (alt, kan leses inn igjen) og CSV (alle sets, for regneark).

export const BACKUP_APP = 'repgrade';
/** Navn som godtas ved import (også det gamle navnet Gym Logger, så gamle filer kan leses inn). */
const KNOWN_APPS = new Set([BACKUP_APP, 'gym-logger']);

export interface Backup {
  app: string;
  version: 1 | 2;
  exported_at: string;
  tables: Record<string, Row[]>;
  /** v2: innstillinger, favoritter, notater og hviletider. */
  kv?: KV[];
}

/** Nøkler i kv som er lokale for enheten og ikke skal med (synk-markører). */
const isLocalOnlyKey = (key: string) => key.startsWith('pull:') || key === 'last_backup_at';

export async function exportBackup(): Promise<Backup> {
  const tables: Record<string, Row[]> = {};
  for (const tbl of SYNCED_TABLES) {
    let rows = (await db.table<Row & { custom?: number }>(tbl).toArray()).filter((r) => !r.deleted);
    if (tbl === 'exercises') rows = rows.filter((r) => r.custom);
    tables[tbl] = rows.map(({ dirty: _d, ...r }) => r as Row);
  }
  const kv = (await db.kv.toArray()).filter((r) => !isLocalOnlyKey(r.key));
  return { app: BACKUP_APP, version: 2, exported_at: new Date().toISOString(), tables, kv };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

export const backupFileName = (ext: 'json' | 'csv') => `${BACKUP_APP}-backup-${new Date().toISOString().slice(0, 10)}.${ext}`;

/** Lagrer tidspunktet for siste backup (brukes til påminnelsen på Hjem). */
export async function markBackedUp() {
  await db.kv.put({ key: 'last_backup_at', value: new Date().toISOString() });
}

export async function lastBackupAt(): Promise<string | null> {
  return ((await db.kv.get('last_backup_at'))?.value as string | undefined) ?? null;
}

// ---------- CSV ----------

/** Ett felt i CSV: anførselstegn rundt hvis det trengs, doble anførselstegn inni. */
export function csvField(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function setsToCSV(
  sets: WorkoutSet[],
  workouts: Map<string, Workout>,
  exercises: Map<string, Pick<Exercise, 'id' | 'name' | 'custom'>>,
  prIds: Set<string>,
): string {
  const header = ['date', 'workout', 'exercise', 'set', 'type', 'weight_kg', 'reps', 'distance_km', 'pr'];
  const rows = sets
    .filter((s) => !s.deleted && s.completed_at && workouts.has(s.workout_id))
    .sort((a, b) => (a.completed_at! < b.completed_at! ? -1 : a.completed_at! > b.completed_at! ? 1 : a.position - b.position))
    .map((s) => {
      const w = workouts.get(s.workout_id)!;
      return [
        s.completed_at!.slice(0, 16).replace('T', ' '),
        w.name,
        exerciseName(exercises.get(s.exercise_id)) || s.exercise_id,
        s.position + 1,
        s.set_type,
        s.weight,
        s.reps,
        s.distance_km ?? '',
        prIds.has(s.id) ? 'yes' : '',
      ]
        .map(csvField)
        .join(',');
    });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

export async function exportCSV(): Promise<string> {
  const sets = await db.sets.toArray();
  const workouts = new Map((await db.workouts.toArray()).filter((w) => !w.deleted).map((w) => [w.id, w]));
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const prIds = new Set(computePRMap(sets).keys());
  // BOM så Excel leser æøå riktig.
  return '﻿' + setsToCSV(sets, workouts, exercises, prIds);
}

// ---------- Import ----------

export interface BackupSummary {
  workouts: number;
  sets: number;
  routines: number;
  bodyweights: number;
  exportedAt: string;
}

export function parseBackup(json: unknown): Backup {
  const b = json as Partial<Backup>;
  if (!b || !KNOWN_APPS.has(b.app ?? '') || !b.tables || typeof b.tables !== 'object') {
    throw new Error(t('Filen er ikke en backup fra denne appen.', 'The file is not a backup from this app.'));
  }
  return b as Backup;
}

export function summarizeBackup(b: Backup): BackupSummary {
  const n = (tbl: string) => (b.tables[tbl] ?? []).filter((r) => !r.deleted).length;
  return { workouts: n('workouts'), sets: n('sets'), routines: n('routines'), bodyweights: n('bodyweights'), exportedAt: b.exported_at };
}

/** Slår sammen en backup med lokale data. Nyeste versjon av hver rad vinner. Returnerer antall rader lagt inn. */
export async function importBackup(json: unknown): Promise<number> {
  const b = parseBackup(json);
  let n = 0;
  await db.transaction('rw', [...SYNCED_TABLES.map((tbl) => db.table(tbl)), db.kv], async () => {
    for (const tbl of SYNCED_TABLES) {
      const rows = b.tables[tbl] ?? [];
      for (const r of rows) {
        if (!r?.id || typeof r.updated_at !== 'string') continue;
        const local = await db.table<Row>(tbl).get(r.id);
        if (!local || r.updated_at > local.updated_at) {
          await db.table(tbl).put({ ...r, dirty: 1 });
          n++;
        }
      }
    }
    // Innstillinger og notater: legg bare inn det som mangler, så lokale valg ikke overskrives.
    for (const row of b.kv ?? []) {
      if (!row?.key || isLocalOnlyKey(row.key)) continue;
      if (!(await db.kv.get(row.key))) {
        await db.kv.put(row);
        n++;
      }
    }
  });
  return n;
}
