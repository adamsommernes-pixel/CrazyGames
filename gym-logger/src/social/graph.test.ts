import { describe, expect, it } from 'vitest';
import { relationTo, relations } from './graph';
import type { Follow } from './types';

const f = (follower: string, followee: string, status: Follow['status'], at: string): Follow => ({ follower, followee, status, created_at: at, accepted_at: null });

describe('følgelister', () => {
  const rows = [
    f('B', 'ME', 'pending', '2026-01-02'),
    f('C', 'ME', 'pending', '2026-01-05'),
    f('D', 'ME', 'accepted', '2026-01-01'),
    f('ME', 'D', 'accepted', '2026-01-01'),
    f('ME', 'E', 'pending', '2026-01-03'),
    f('ME', 'F', 'accepted', '2026-01-04'),
  ];
  const r = relations(rows, 'ME');

  it('deler inn i forespørsler, følgere, følger og forespurt (nyeste først)', () => {
    expect(r.requests).toEqual(['C', 'B']);
    expect(r.followers).toEqual(['D']);
    expect(r.following).toEqual(['F', 'D']);
    expect(r.requested).toEqual(['E']);
  });

  it('gir status overfor en person', () => {
    expect(relationTo(r, 'ME', 'ME')).toBe('self');
    expect(relationTo(r, 'ME', 'D')).toBe('following');
    expect(relationTo(r, 'ME', 'E')).toBe('requested');
    expect(relationTo(r, 'ME', 'B')).toBe('none');
    expect(relationTo(relations([f('X', 'ME', 'accepted', '2026-01-01')], 'ME'), 'ME', 'X')).toBe('follows-you');
  });
});
