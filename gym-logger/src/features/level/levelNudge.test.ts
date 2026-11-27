import { describe, expect, it } from 'vitest';
import { levelNudge } from './LevelNudge';
import { strengthProfile } from '../../lib/strength';

const now = Date.parse('2026-12-31T12:00:00Z');
const at = (days: number) => new Date(now - days * 86_400_000).toISOString();
const set = (ex: string, weight: number, days: number) => ({ id: `${ex}${days}`, exercise_id: `ex-${ex}`, weight, reps: 1, set_type: 'normal', completed_at: at(days) });

describe('påminnelse om løft som slutter å telle', () => {
  it('sier fra når et løft har sluttet å telle, men ikke om løft brukeren har lagt bort', () => {
    const p = strengthProfile([set('benkpress', 100, 40), set('kneboy', 140, 2)], 80, 'male', undefined, now);
    expect(levelNudge(p, {}, now)).toMatchObject({ kind: 'dropped', ids: ['ex-benkpress'] });
    expect(levelNudge(p, { 'ex-benkpress': at(1) }, now)).toBeNull();
  });
  it('varsler en uke før et løft slutter å telle', () => {
    const p = strengthProfile([set('benkpress', 100, 26), set('kneboy', 140, 2)], 80, 'male', undefined, now);
    expect(levelNudge(p, {}, now)).toMatchObject({ kind: 'soon', ids: ['ex-benkpress'], days: 4 });
  });
  it('trener du løftet igjen etter at du la det bort, teller det og påminnelsen kommer tilbake ved behov', () => {
    const p = strengthProfile([set('benkpress', 100, 1)], 80, 'male', undefined, now);
    expect(levelNudge(p, { 'ex-benkpress': at(10) }, now)).toBeNull(); // aktivt, ingenting å si
  });
});
