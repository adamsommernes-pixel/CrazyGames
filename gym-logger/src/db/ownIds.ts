import { db } from './dexie';
import type { Backup } from './backup';
import type { Row } from './types';

// Id-er må være unike på tvers av alle brukere i skyen (primærnøkkel = id). Importer fra Hevy, Strong og
// Lyfto lager faste id-er ut fra innholdet, så to personer som importerer det samme fikk like id-er, og
// den siste ble nektet av databasen. Nå får slike id-er et merke for kontoen: «<id>-u<kode>».
// Samme regel brukes når synken reparerer en id som allerede tilhører en annen (se sync.ts).

const IMPORT_PREFIX = /^(hevy|strong|lyfto)-/;
const REF_FIELDS = ['exercise_id', 'workout_id', 'workout_exercise_id', 'routine_id'] as const;

/** Kort, fast kode for en konto (samme på alle enheter). */
export function accountCode(userId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

/** Id-en med kontoens merke (uendret om den allerede har det). */
export function ownId(id: string, userId: string): string {
  const tag = `-u${accountCode(userId)}`;
  return id.endsWith(tag) ? id : `${id}${tag}`;
}

/** Innlogget konto, fra navnet på den lokale databasen («gym-<id>»). */
export const currentUserId = () => (db.name.startsWith('gym-') && db.name !== 'gym-none' ? db.name.slice(4) : null);

/**
 * Gir importerte rader (og alt som peker på dem) kontoens merke. En id som allerede finnes lokalt uten merke
 * (importert før denne endringen) beholdes, så samme fil kan leses inn igjen uten duplikater. Andre id-er røres ikke.
 */
export async function ownImported(b: Backup, userId: string): Promise<Backup> {
  const imported = new Set<string>();
  for (const rows of Object.values(b.tables))
    for (const r of rows) {
      const rec = r as unknown as Record<string, unknown>;
      for (const v of [rec.id, ...REF_FIELDS.map((f) => rec[f])]) if (typeof v === 'string' && IMPORT_PREFIX.test(v)) imported.add(v);
    }
  // Finnes id-en allerede (uten merke) i en lokal tabell, er den denne kontoens egen.
  const ids = [...imported];
  const mine = new Set<string>();
  for (const t of ['exercises', 'routines', 'routine_exercises', 'workouts', 'workout_exercises', 'sets']) {
    const found = await db.table(t).bulkGet(ids);
    found.forEach((row, i) => row && mine.add(ids[i]));
  }
  const fix = (v: unknown) => (typeof v === 'string' && imported.has(v) && !mine.has(v) ? ownId(v, userId) : v);
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(b.tables)) {
    tables[name] = rows.map((r) => {
      const out: Record<string, unknown> = { ...r, id: fix(r.id) };
      for (const f of REF_FIELDS) if (f in out) out[f] = fix(out[f]);
      return out as unknown as Row;
    });
  }
  return { ...b, tables };
}
