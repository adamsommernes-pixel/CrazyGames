import { afterEach, describe, expect, it } from 'vitest';
import { LIBRARY, guideFor, englishName } from './index';
import { EN } from './en';
import { setLang } from '../../i18n';
import { matchesSearch } from '../../lib/search';
import { exerciseName } from '../../lib/exerciseName';

afterEach(() => setLang('nb'));

describe('English exercise library', () => {
  it('covers every built-in exercise with the same structure as the Norwegian', () => {
    for (const e of LIBRARY) {
      const en = EN[e.slug];
      expect(en, e.slug).toBeDefined();
      expect(en.steps.length, `${e.slug} steps`).toBe(e.guide.steps.length);
      expect(en.tips.length, `${e.slug} tips`).toBe(e.guide.tips.length);
      expect(en.mistakes.length, `${e.slug} mistakes`).toBe(e.guide.mistakes.length);
      expect(en.name.trim().length, e.slug).toBeGreaterThan(0);
    }
  });

  it('has no extra entries and unique English names', () => {
    const slugs = new Set(LIBRARY.map((e) => e.slug));
    for (const slug of Object.keys(EN)) expect(slugs.has(slug), slug).toBe(true);
    const names = Object.values(EN).map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('guideFor and exerciseName follow the language', () => {
    expect(guideFor('ex-planke')!.steps[0]).toMatch(/underarmene/);
    expect(exerciseName({ id: 'ex-kneboy', name: 'Knebøy', custom: 0 })).toBe('Knebøy');
    setLang('en');
    expect(guideFor('ex-planke')!.steps[0]).toMatch(/forearms/);
    expect(exerciseName({ id: 'ex-kneboy', name: 'Knebøy', custom: 0 })).toBe('Squat');
    // Custom exercises keep the name the user typed.
    expect(exerciseName({ id: 'abc', name: 'Min øvelse', custom: 1 })).toBe('Min øvelse');
  });

  it('search finds Norwegian exercises by their English name', () => {
    expect(matchesSearch(englishName('ex-kneboy')!, 'squat')).toBe(true);
    expect(matchesSearch(englishName('ex-benkpress')!, 'bench')).toBe(true);
  });
});
