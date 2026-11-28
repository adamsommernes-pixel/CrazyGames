import { describe, expect, it } from 'vitest';
import { cleanHandle, handleCandidates, isValidHandle, suggestHandle } from './handle';

describe('brukernavn', () => {
  it('rydder input', () => {
    expect(cleanHandle('@Ola Nordmann')).toBe('ola_nordmann');
    expect(cleanHandle('Bjørn Ærlig-Ås!')).toBe('bjorn_aerligas');
    expect(cleanHandle('José')).toBe('jose');
    expect(cleanHandle('a'.repeat(30))).toHaveLength(20);
  });

  it('foreslår gyldige navn', () => {
    expect(suggestHandle('Ola Nordmann')).toBe('ola_nordmann');
    expect(suggestHandle('  Bø  ')).toBe('bo1');
    expect(suggestHandle('李')).toBe('lofter');
    expect(suggestHandle('__anna__')).toBe('anna');
    for (const n of ['Ola Nordmann', 'Bø', '李', 'x', 'Kari Kristine Langnavn-Etternavnsen']) expect(isValidHandle(suggestHandle(n))).toBe(true);
  });

  it('lager alternativer når navnet er tatt', () => {
    expect(handleCandidates('anna', 3)).toEqual(['anna', 'anna2', 'anna3']);
    expect(handleCandidates('a'.repeat(20), 2)[1]).toHaveLength(20);
  });
});
