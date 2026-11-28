import { describe, expect, it } from 'vitest';
import { badgeIcon, badgeText } from './badges';

describe('merker', () => {
  it('tekst for utfordring og månedstavle', () => {
    expect(badgeText({ kind: 'challenge', title: 'Uka', board: null, tier_index: null, period: null })).toBe('Vant «Uka»');
    expect(badgeText({ kind: 'board', title: null, board: 'level', tier_index: 3, period: '2026-11-01' })).toBe('#1 Sterkest · Gymrotte · nov 2026');
    expect(badgeIcon({ kind: 'challenge' })).toBe('🏆');
    expect(badgeIcon({ kind: 'board' })).toBe('🥇');
  });
});
