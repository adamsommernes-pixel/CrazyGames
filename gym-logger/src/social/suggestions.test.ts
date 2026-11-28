import { describe, expect, it } from 'vitest';
import { suggestionChunk, suggestionReason } from './suggestions';
import type { Suggestion } from './types';

const s = (over: Partial<Suggestion> = {}): Suggestion => ({ user_id: 'u', handle: 'u', display_name: 'U', color: '#34c56a', visibility: 1, mutual_count: 0, mutual_names: [], follows_you: false, ...over });

describe('forslag i feeden', () => {
  it('nye folk i hvert kort, til de er brukt opp', () => {
    const list = Array.from({ length: 14 }, (_, i) => i);
    expect(suggestionChunk(list, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(suggestionChunk(list, 1)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(suggestionChunk(list, 2)).toEqual([12, 13]);
    expect(suggestionChunk(list, 3)).toBeNull();
    // Ett forslag igjen er for lite til et eget kort, men nok til det første.
    expect(suggestionChunk([1, 2, 3, 4, 5, 6, 7], 1)).toBeNull();
    expect(suggestionChunk([1], 0)).toEqual([1]);
    expect(suggestionChunk([], 0)).toBeNull();
  });

  it('forklarer hvorfor noen foreslås', () => {
    expect(suggestionReason(s({ mutual_count: 1, mutual_names: ['Frida'] }))).toMatch(/Frida$/);
    expect(suggestionReason(s({ mutual_count: 2, mutual_names: ['Frida', 'Geir'] }))).toMatch(/Frida (og|and) Geir/);
    expect(suggestionReason(s({ mutual_count: 4, mutual_names: ['Frida', 'Geir'] }))).toMatch(/Frida \+ 3/);
    expect(suggestionReason(s({ follows_you: true }))).toMatch(/Følger deg|Follows you/);
    expect(suggestionReason(s({ visibility: 3 }))).toMatch(/Åpen|Open/);
  });
});
