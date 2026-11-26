import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { hashPassword, newSalt, passwordStrength, safeEqual } from './crypto';
import { createLocalBackend } from './local';

describe('crypto', () => {
  it('samme passord og salt gir samme hash, annet passord gir annen', async () => {
    const salt = newSalt();
    const a = await hashPassword('hemmelig123', salt, 1000);
    expect(await hashPassword('hemmelig123', salt, 1000)).toBe(a);
    expect(await hashPassword('hemmelig124', salt, 1000)).not.toBe(a);
  });
  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
  it('passordstyrke', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('kort')).toBe(1);
    expect(passwordStrength('Langtpassord2026!')).toBe(4);
  });
});

describe('lokal konto', () => {
  it('registrering, innlogging, feil passord, bytte og sletting', async () => {
    const auth = createLocalBackend();
    const u = await auth.signUp('Ola', 'Ola@Eksempel.no', 'sterkt-passord');
    expect(u).toMatchObject({ name: 'Ola', email: 'ola@eksempel.no', kind: 'local' });
    expect((await auth.current())?.email).toBe('ola@eksempel.no');

    await expect(auth.signUp('Ola', 'ola@eksempel.no', 'annet-passord')).rejects.toThrow(/allerede/);
    await auth.signOut();
    expect(await auth.current()).toBeNull();

    await expect(auth.signIn('ola@eksempel.no', 'feil-passord')).rejects.toThrow('Feil e-post eller passord.');
    await expect(auth.signIn('ingen@eksempel.no', 'sterkt-passord')).rejects.toThrow('Feil e-post eller passord.');
    await auth.signIn(' OLA@eksempel.no ', 'sterkt-passord');

    await expect(auth.changePassword('feil', 'nytt-passord-1')).rejects.toThrow(/Nåværende/);
    await auth.changePassword('sterkt-passord', 'nytt-passord-1');
    await auth.signOut();
    await expect(auth.signIn('ola@eksempel.no', 'sterkt-passord')).rejects.toThrow();
    await auth.signIn('ola@eksempel.no', 'nytt-passord-1');

    await auth.deleteAccount('nytt-passord-1');
    expect(await auth.current()).toBeNull();
    await expect(auth.signIn('ola@eksempel.no', 'nytt-passord-1')).rejects.toThrow();
  }, 20000);

  it('avviser ugyldig registrering', async () => {
    const auth = createLocalBackend();
    await expect(auth.signUp('', 'a@b.no', 'passord123')).rejects.toThrow(/navnet/);
    await expect(auth.signUp('A', 'ikke-epost', 'passord123')).rejects.toThrow(/E-post/);
    await expect(auth.signUp('A', 'a@b.no', 'kort')).rejects.toThrow(/minst 8/);
  });
});
