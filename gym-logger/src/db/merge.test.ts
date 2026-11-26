import { describe, expect, it } from 'vitest';
import { normalizeRemote, remoteWins } from './merge';

const local = (updated_at: string, dirty: 0 | 1) => ({ id: 'a', updated_at, deleted: 0 as const, dirty });

describe('remoteWins', () => {
  it('ny rad fra skyen legges inn', () => expect(remoteWins(undefined, { updated_at: '2026-01-01T00:00:00.000Z' })).toBe(true));
  it('lokal rad uten endringer erstattes', () =>
    expect(remoteWins(local('2026-02-01T00:00:00.000Z', 0), { updated_at: '2026-01-01T00:00:00.000Z' })).toBe(true));
  it('nyere lokal endring beholdes', () =>
    expect(remoteWins(local('2026-02-01T00:00:00.000Z', 1), { updated_at: '2026-01-01T00:00:00.000Z' })).toBe(false));
  it('nyere endring i skyen vinner', () =>
    expect(remoteWins(local('2026-01-01T00:00:00.000Z', 1), { updated_at: '2026-02-01T00:00:00.000Z' })).toBe(true));
});

describe('normalizeRemote', () => {
  it('fjerner serverfelt og normaliserer tider', () => {
    const r = normalizeRemote({ id: 'x', user_id: 'u', server_updated_at: 'z', updated_at: '2026-01-01T10:00:00.5+00:00', ended_at: null });
    expect(r).toEqual({ id: 'x', updated_at: '2026-01-01T10:00:00.500Z', ended_at: null });
  });
});
