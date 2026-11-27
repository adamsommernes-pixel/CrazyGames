import { describe, expect, it } from 'vitest';
import { navDirection } from './PageTransition';

describe('sideoverganger', () => {
  it('fanene tones, nye sider glir fram, tilbake glir tilbake', () => {
    expect(navDirection('/', '/history', 'PUSH', 0, 1)).toBe('fade');
    expect(navDirection('/progress', '/exercise/ex-kneboy', 'PUSH', 1, 2)).toBe('forward');
    expect(navDirection('/exercise/ex-kneboy', '/progress', 'POP', 2, 1)).toBe('back');
    expect(navDirection('/progress', '/exercise/ex-kneboy', 'POP', 1, 2)).toBe('forward');
    expect(navDirection('/workout', '/summary/x', 'REPLACE', 3, 3)).toBe('fade');
  });
});
