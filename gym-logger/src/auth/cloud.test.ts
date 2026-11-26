import { describe, expect, it } from 'vitest';
import { confirmRedirect } from './cloud';

describe('email confirmation redirect', () => {
  it('points back to the app with ?confirmed=1 and no hash', () => {
    expect(confirmRedirect('https://x.github.io/Web-Appdevelopment/app/#/signup')).toBe('https://x.github.io/Web-Appdevelopment/app/?confirmed=1');
  });
});
