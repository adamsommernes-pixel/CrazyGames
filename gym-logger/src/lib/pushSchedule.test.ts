import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Falsk Supabase: logger kallene mot rest_alarms.
const calls: { op: string; row?: Record<string, unknown> }[] = [];
vi.mock('./supabase', () => {
  const ok = Promise.resolve({ data: null, error: null });
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
      from: () => ({
        upsert: (row: Record<string, unknown>) => (calls.push({ op: 'upsert', row }), ok),
        delete: () => ({ eq: () => (calls.push({ op: 'delete' }), ok) }),
      }),
    },
  };
});

const { openUserDb } = await import('../db/dexie');
const { setSetting } = await import('./settings');
const { startRest, adjustRest, stopRest } = await import('../features/workout/restTimer');

let n = 0;
beforeEach(() => {
  openUserDb(`push-${++n}`);
  calls.length = 0;
});
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('pausealarm på serveren', () => {
  it('planlegges, flyttes og avlyses sammen med hviletimeren', async () => {
    await setSetting('restPush', true);
    const before = Date.now();
    await startRest(90);
    await flush();
    expect(calls.at(-1)?.op).toBe('upsert');
    const at = new Date(calls.at(-1)!.row!.send_at as string).getTime();
    expect(at - before).toBeGreaterThanOrEqual(89_000);
    expect(at - before).toBeLessThanOrEqual(91_000);
    await adjustRest(15);
    await flush();
    expect(new Date(calls.at(-1)!.row!.send_at as string).getTime()).toBe(at + 15_000);
    await stopRest();
    await flush();
    expect(calls.at(-1)?.op).toBe('delete');
  });

  it('ingenting sendes når varsler er av', async () => {
    await setSetting('restPush', false);
    await startRest(60);
    await flush();
    expect(calls).toHaveLength(0);
  });
});
