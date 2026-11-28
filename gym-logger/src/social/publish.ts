import { db } from '../db/dexie';
import type { Workout } from '../db/types';
import { getSetting, setSetting } from '../lib/settings';
import type { SocialBackend } from './backend';
import { buildActivity, type BuildContext } from './activity';

// Holder feeden i takt med treningen: ferdige økter publiseres, endrede publiseres på nytt,
// slettede (eller de du slår av deling for) fjernes. Hva som er sendt, huskes per økt med en
// signatur, så bare endringer sendes. Feiler det (f.eks. uten nett), prøves det igjen neste gang.

const SENT_KEY = 'social-published';
type Sent = Record<string, string>;

async function sentMap(): Promise<Sent> {
  return ((await db.kv.get(SENT_KEY))?.value as Sent | undefined) ?? {};
}

/** Økter som kan deles: ferdige og startet etter at den sosiale profilen ble laget. */
async function candidates(since: string): Promise<Workout[]> {
  return (await db.workouts.toArray()).filter((w) => w.ended_at && w.started_at >= since);
}

/** Endres når økta eller noen av settene endres (navn, tider, vekt, reps, sletting). */
export async function signatures(since: string): Promise<Map<string, string>> {
  const ws = await candidates(since);
  const sets = await db.sets.where('workout_id').anyOf(ws.map((w) => w.id)).toArray();
  const out = new Map<string, string>();
  for (const w of ws) {
    const own = sets.filter((s) => s.workout_id === w.id && !s.deleted && s.completed_at);
    const last = own.reduce((m, s) => (s.updated_at > m ? s.updated_at : m), '');
    out.set(w.id, `${w.deleted}|${w.updated_at}|${own.length}|${last}`);
  }
  return out;
}

export async function setShared(workoutId: string, shared: boolean) {
  const off = await getSetting('socialUnshared');
  await setSetting('socialUnshared', shared ? off.filter((x) => x !== workoutId) : [...new Set([...off, workoutId])]);
}

let running: Promise<{ published: number; removed: number }> | null = null;

/** Sender det som er nytt eller endret, og fjerner det som ikke skal deles lenger. */
export function syncActivities(backend: SocialBackend, ctx: BuildContext, since: string): Promise<{ published: number; removed: number }> {
  running ??= (async () => {
    let published = 0;
    let removed = 0;
    try {
      const sent = await sentMap();
      const off = new Set(await getSetting('socialUnshared'));
      const sigs = await signatures(since);
      const ws = new Map((await candidates(since)).map((w) => [w.id, w]));
      for (const [id, sig] of sigs) {
        const w = ws.get(id)!;
        const hide = !!w.deleted || off.has(id);
        if (hide) {
          if (sent[id] !== undefined) {
            await backend.unpublish(id);
            delete sent[id];
            removed++;
          }
          continue;
        }
        if (sent[id] === sig) continue;
        const activity = await buildActivity(id, ctx);
        if (!activity) {
          if (sent[id] !== undefined) {
            await backend.unpublish(id);
            delete sent[id];
            removed++;
          }
          continue;
        }
        await backend.publish(activity);
        sent[id] = sig;
        published++;
        // Lagre fortløpende, så det som er sendt ikke sendes igjen om noe senere feiler.
        await db.kv.put({ key: SENT_KEY, value: { ...sent } });
      }
      await db.kv.put({ key: SENT_KEY, value: sent });
    } finally {
      running = null;
    }
    return { published, removed };
  })();
  return running;
}

/** Er økta delt (eller i ferd med å bli det)? */
export async function isShared(workoutId: string): Promise<boolean> {
  return !(await getSetting('socialUnshared')).includes(workoutId);
}
