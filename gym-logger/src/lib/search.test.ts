import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearch } from './search';

describe('søk', () => {
  it('skriver om norske bokstaver', () => expect(normalizeSearch('Knebøy')).toBe('kneboy'));
  it('finner uten æøå', () => {
    expect(matchesSearch('Knebøy', 'kneboy')).toBe(true);
    expect(matchesSearch('Militærpress', 'militaer')).toBe(true);
    expect(matchesSearch('Tåhev stående', 'tahev')).toBe(true);
  });
  it('ignorerer mellomrom og bindestrek', () => {
    expect(matchesSearch('Markløft', 'mark loft')).toBe(true);
    expect(matchesSearch('Pull-ups', 'pullups')).toBe(true);
  });
  it('tomt søk matcher alt, feil søk matcher ikke', () => {
    expect(matchesSearch('Benkpress', '  ')).toBe(true);
    expect(matchesSearch('Benkpress', 'knebøy')).toBe(false);
  });
});
