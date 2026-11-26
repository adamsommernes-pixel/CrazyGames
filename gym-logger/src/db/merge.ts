import type { Row } from './types';

const TIME_FIELDS = ['updated_at', 'started_at', 'ended_at', 'completed_at'] as const;

/** Postgres gir «…+00:00». Lokalt brukes alltid toISOString (…Z), så tider kan sammenlignes som tekst. */
export function normalizeRemote<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  delete out.user_id;
  delete out.server_updated_at;
  for (const f of TIME_FIELDS) {
    const v = out[f];
    if (typeof v === 'string') out[f] = new Date(v).toISOString();
  }
  return out as T;
}

/**
 * Skal den innkommende raden erstatte den lokale? Siste endring vinner.
 * En lokal rad som ikke er sendt ennå (dirty) og er nyere, beholdes.
 */
export function remoteWins(local: Row | undefined, remote: Pick<Row, 'updated_at'>): boolean {
  if (!local) return true;
  if (!local.dirty) return true;
  return remote.updated_at >= local.updated_at;
}
