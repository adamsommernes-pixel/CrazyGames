import { useEffect, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import { db } from './dexie';
import { SYNCED_TABLES, type Row, type SyncedTable } from './types';
import { normalizeRemote, remoteWins } from './merge';
import { supabase } from '../lib/supabase';
import { t } from '../i18n';
import { cloudPayload, hasHealthConsent, keepLocalSensitive, SENSITIVE_TABLES } from './consent';

// ---------- Status (enkel global store) ----------

export interface SyncStatus {
  state: 'disabled' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';
  lastSync: string | null;
  error: string | null;
  pending: number;
}

let status: SyncStatus = { state: supabase ? 'signed-out' : 'disabled', lastSync: null, error: null, pending: 0 };
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

// ---------- Push / pull ----------

const PAGE = 500;
const table = (t: SyncedTable) => db.table<Row & Record<string, unknown>, string>(t);

/** Samtykke til kroppsdata i skyen, lest fra den lokale profilen. */
async function consentFor(userId: string) {
  return hasHealthConsent(await db.profiles.get(userId));
}

async function push(userId: string) {
  const consent = await consentFor(userId);
  for (const t of SYNCED_TABLES) {
    // Uten samtykke blir kroppsvekt-loggen liggende lokalt (fortsatt markert som ikke synket).
    if (!consent && SENSITIVE_TABLES.includes(t)) continue;
    const rows = await table(t).where('dirty').equals(1).toArray();
    for (let i = 0; i < rows.length; i += PAGE) {
      const chunk = rows.slice(i, i + PAGE);
      const payload = chunk
        .map(({ dirty: _dirty, ...r }) => cloudPayload(t, r as Record<string, unknown>, consent))
        .filter((r) => r !== null)
        .map((r) => ({ ...r, user_id: userId }));
      const { error } = await supabase!.from(t).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(`${t}: ${error.message}`);
      // Fjern dirty bare hvis raden ikke er endret igjen mens vi sendte.
      await db.transaction('rw', table(t), async () => {
        for (const r of chunk) {
          const cur = await table(t).get(r.id);
          if (cur && cur.updated_at === r.updated_at) await table(t).put({ ...cur, dirty: 0 });
        }
      });
    }
  }
}

async function pull(userId: string) {
  const consent = await consentFor(userId);
  for (const t of SYNCED_TABLES) {
    const cursorKey = `pull:${userId}:${t}`;
    let cursor = ((await db.kv.get(cursorKey))?.value as { at: string; id: string } | undefined) ?? {
      at: '1970-01-01T00:00:00Z',
      id: '',
    };
    for (;;) {
      const { data, error } = await supabase!
        .from(t)
        .select('*')
        .or(`server_updated_at.gt."${cursor.at}",and(server_updated_at.eq."${cursor.at}",id.gt."${cursor.id}")`)
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(PAGE);
      if (error) throw new Error(`${t}: ${error.message}`);
      if (!data?.length) break;
      await db.transaction('rw', table(t), db.kv, async () => {
        for (const raw of data) {
          const remote = normalizeRemote(raw as Row & Record<string, unknown>);
          const local = await table(t).get(remote.id);
          if (remoteWins(local, remote)) {
            const merged = t === 'profiles' ? keepLocalSensitive(remote, local, consent) : remote;
            await table(t).put({ ...merged, dirty: 0 });
          }
        }
        const last = data[data.length - 1] as { server_updated_at: string; id: string };
        cursor = { at: last.server_updated_at, id: last.id };
        await db.kv.put({ key: cursorKey, value: cursor });
      });
      if (data.length < PAGE) break;
    }
  }
}

async function countPending() {
  const user = supabase ? (await supabase.auth.getSession()).data.session?.user : undefined;
  const consent = user ? await consentFor(user.id) : true;
  let n = 0;
  for (const t of SYNCED_TABLES) {
    if (!consent && SENSITIVE_TABLES.includes(t)) continue;
    n += await table(t).where('dirty').equals(1).count();
  }
  return n;
}

/** Gir samtykke: kroppsvekt-loggen og profilfeltene lastes opp ved neste synk. */
export async function grantHealthConsent(userId: string) {
  const now = new Date().toISOString();
  await db.transaction('rw', db.profiles, db.bodyweights, async () => {
    const p = await db.profiles.get(userId);
    if (p) await db.profiles.put({ ...p, health_consent_at: now, updated_at: now, dirty: 1 });
    await db.bodyweights.toCollection().modify({ dirty: 1 });
  });
  void syncNow();
}

/**
 * Trekker samtykket: sletter kroppsvekt-loggen i skyen og tømmer de sensitive profilfeltene der.
 * Dataene blir liggende på telefonen.
 */
export async function withdrawHealthConsent(userId: string) {
  const now = new Date().toISOString();
  const p = await db.profiles.get(userId);
  if (p) await db.profiles.put({ ...p, health_consent_at: null, updated_at: now, dirty: 1 });
  if (supabase) {
    const { error } = await supabase.from('bodyweights').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    await syncNow(); // sender profilen uten de sensitive feltene
  }
}

let running: Promise<void> | null = null;

/** Gjør vanlige oppsettsfeil i Supabase forståelige. */
export function friendlySyncError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('does not exist') || m.includes('could not find the') || m.includes('schema cache')) {
    return t(
      'Databasen er ikke satt opp. Kjør supabase/setup.sql i Supabase → SQL Editor.',
      'The database is not set up. Run supabase/setup.sql in Supabase → SQL Editor.',
    );
  }
  if (m.includes('jwt') || m.includes('invalid api key') || m.includes('no api key')) {
    return t('Feil Supabase-nøkkel. Sjekk VITE_SUPABASE_ANON_KEY.', 'Wrong Supabase key. Check VITE_SUPABASE_ANON_KEY.');
  }
  if (m.includes('row-level security')) {
    return t('Tilgang nektet av databasen. Kjør supabase/setup.sql på nytt.', 'Access denied by the database. Run supabase/setup.sql again.');
  }
  return message;
}

/** Sender lokale endringer og henter nye fra skyen. Trygg å kalle ofte. */
export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    try {
      const { data } = await supabase!.auth.getSession();
      const user = data.session?.user;
      if (!user) return setStatus({ state: 'signed-out' });
      if (!navigator.onLine) return setStatus({ state: 'offline' });
      setStatus({ state: 'syncing', error: null });
      await push(user.id);
      await pull(user.id);
      setStatus({ state: 'idle', lastSync: new Date().toISOString(), pending: await countPending() });
    } catch (e) {
      setStatus({ state: navigator.onLine ? 'error' : 'offline', error: friendlySyncError(e instanceof Error ? e.message : String(e)) });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Synker ved oppstart, innlogging, når nettet kommer tilbake, når appen åpnes igjen og kort tid etter endringer. */
export function useAutoSync(enabled: boolean) {
  useEffect(() => {
    if (!supabase || !enabled) return;
    void syncNow();
    const { data: auth } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void syncNow();
      if (event === 'SIGNED_OUT') setStatus({ state: 'signed-out' });
    });
    const onOnline = () => void syncNow();
    const onVisible = () => document.visibilityState === 'visible' && void syncNow();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = liveQuery(countPending).subscribe((n) => {
      setStatus({ pending: n });
      if (n > 0) {
        clearTimeout(timer);
        timer = setTimeout(() => void syncNow(), 4000);
      }
    });
    const interval = setInterval(() => void syncNow(), 5 * 60 * 1000);
    return () => {
      auth.subscription.unsubscribe();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      sub.unsubscribe();
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [enabled]);
}
