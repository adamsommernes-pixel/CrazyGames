import { describe, expect, it } from 'vitest';
import { shouldShowAfterUpdate } from './whatsNew';
import { shouldAskForPush } from './PushPrompt';

describe('nyheter etter oppdatering', () => {
  it('vises for brukere med økter som ikke har sett denne versjonen', () => {
    expect(shouldShowAfterUpdate('1.1.0', null, true)).toBe(true); // oppdaterte fra 1.0 via det gamle varselet
    expect(shouldShowAfterUpdate('1.1.0', '1.0.0', true)).toBe(true);
  });
  it('vises ikke for nye brukere eller når de allerede er sett', () => {
    expect(shouldShowAfterUpdate('1.1.0', null, false)).toBe(false);
    expect(shouldShowAfterUpdate('1.1.0', '1.1.0', true)).toBe(false);
  });
});

describe('spørsmål om varsler', () => {
  const base = { cloud: true, status: 'ready' as const, enabled: false, permission: 'default', asked: false };
  it('spør én gang når alt ligger til rette', () => expect(shouldAskForPush(base)).toBe(true));
  it('spør ikke uten konto, når det er på, blokkert, spurt før eller ikke mulig', () => {
    expect(shouldAskForPush({ ...base, cloud: false })).toBe(false);
    expect(shouldAskForPush({ ...base, enabled: true })).toBe(false);
    expect(shouldAskForPush({ ...base, permission: 'denied' })).toBe(false);
    expect(shouldAskForPush({ ...base, asked: true })).toBe(false);
    expect(shouldAskForPush({ ...base, status: 'install-first' })).toBe(false);
  });
});
