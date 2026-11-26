import { db } from './dexie';
import { SYNCED_TABLES, type Row } from './types';

export interface Backup {
  app: 'gym-logger';
  version: 1;
  exported_at: string;
  tables: Record<string, Row[]>;
}

export async function exportBackup(): Promise<Backup> {
  const tables: Record<string, Row[]> = {};
  for (const t of SYNCED_TABLES) {
    let rows = (await db.table<Row & { custom?: number }>(t).toArray()).filter((r) => !r.deleted);
    if (t === 'exercises') rows = rows.filter((r) => r.custom);
    tables[t] = rows.map(({ dirty: _d, ...r }) => r as Row);
  }
  return { app: 'gym-logger', version: 1, exported_at: new Date().toISOString(), tables };
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Slår sammen en backup med lokale data. Nyeste versjon av hver rad vinner. Returnerer antall rader lagt inn. */
export async function importBackup(json: unknown): Promise<number> {
  const b = json as Partial<Backup>;
  if (b?.app !== 'gym-logger' || !b.tables) throw new Error('Filen er ikke en Gym Logger-backup.');
  let n = 0;
  await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
    for (const t of SYNCED_TABLES) {
      const rows = b.tables![t] ?? [];
      for (const r of rows) {
        if (!r?.id || typeof r.updated_at !== 'string') continue;
        const local = await db.table<Row>(t).get(r.id);
        if (!local || r.updated_at > local.updated_at) {
          await db.table(t).put({ ...r, dirty: 1 });
          n++;
        }
      }
    }
  });
  return n;
}
