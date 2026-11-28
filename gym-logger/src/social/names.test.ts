import sql from '../../supabase/migrations/012_social.sql?raw';
import { describe, expect, it } from 'vitest';
import { BANNED, RESERVED, nameProblem } from './names';

describe('navnefilter', () => {
  it('stopper reserverte og støtende navn, men ikke vanlige navn', () => {
    expect(nameProblem('repgrade_team', 'X')).toBe('reserved');
    expect(nameProblem('admin', 'X')).toBe('reserved');
    expect(nameProblem('ola', 'Big Fuck')).toBe('banned');
    for (const [h, n] of [['nazira', 'Nazira'], ['fittest_ola', 'Pikkolo'], ['scott', 'Anna Berg'], ['administrer', 'Ola']]) expect(nameProblem(h, n)).toBeNull();
  });

  it('listene er de samme som i databasen (012_social.sql)', () => {
    const fn = sql.slice(sql.indexOf('function public.name_problem'), sql.indexOf('end;\n$$;', sql.indexOf('function public.name_problem')));
    const words = (from: string) => [...fn.slice(fn.indexOf(from)).split(']')[0].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(words("= any (array[").sort()).toEqual([...RESERVED].sort());
    expect(words('unnest(array[').sort()).toEqual([...BANNED].sort());
  });
});
