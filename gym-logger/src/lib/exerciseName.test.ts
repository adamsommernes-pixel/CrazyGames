import { afterEach, describe, expect, it } from 'vitest';
import { exerciseName, searchNames } from './exerciseName';
import { matchesSearch } from './search';
import { BUILTIN_EXERCISES, NB_NAMED } from '../db/library';
import { setLang } from '../i18n';

const ex = (slug: string) => BUILTIN_EXERCISES.find((e) => e.id === `ex-${slug}`)!;
const find = (q: string) => BUILTIN_EXERCISES.filter((e) => searchNames(e).some((n) => matchesSearch(n, q))).map(exerciseName);

describe('øvelsesnavn', () => {
  afterEach(() => setLang('nb'));

  it('de 12 store løftene finnes i biblioteket', () => {
    for (const slug of NB_NAMED) expect(ex(slug), slug).toBeTruthy();
    expect(NB_NAMED.size).toBe(12);
  });

  it('norsk: store løft på norsk, resten på engelsk, kondisjon på norsk', () => {
    setLang('nb');
    expect(exerciseName(ex('kneboy'))).toBe('Knebøy');
    expect(exerciseName(ex('rumensk-markloft'))).toBe('Rumensk markløft');
    expect(exerciseName(ex('triceps-pushdown'))).toBe('Triceps pushdown');
    expect(exerciseName(ex('tahev-staende'))).toBe('Standing calf raise');
    expect(exerciseName(ex('sidehev'))).toBe('Lateral raise');
    expect(exerciseName(ex('loping'))).toBe('Løping');
  });

  it('engelsk: alt på engelsk', () => {
    setLang('en');
    expect(exerciseName(ex('kneboy'))).toBe('Squat');
    expect(exerciseName(ex('loping'))).toBe('Running');
  });

  it('egne øvelser beholder navnet', () => {
    expect(exerciseName({ id: 'c-1', name: 'Min øvelse', custom: 1 })).toBe('Min øvelse');
  });

  it('kan fortsatt søkes opp på norsk', () => {
    setLang('nb');
    expect(find('tåhev')).toContain('Standing calf raise');
    expect(find('sidehev')).toContain('Lateral raise');
    expect(find('beinspark')).toContain('Leg extension');
    expect(find('calf')).toContain('Standing calf raise');
    expect(find('kneboy')).toContain('Knebøy');
  });
});
