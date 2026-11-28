import type { AuthUser } from '../auth/types';
import { supabase } from '../lib/supabase';
import type { SocialBackend } from './backend';
import { createFakeSocial } from './fake';
import { createSupabaseSocial } from './supabase';

export type { SocialBackend } from './backend';
export * from './types';

/**
 * Den falske varianten (alt på enheten) slås på med localStorage «repgrade-social-fake» = «1».
 * Brukes av e2e-testene og ved utvikling uten Supabase. Ekte brukere har den aldri på.
 */
export const FAKE_FLAG = 'repgrade-social-fake';
const fakeEnabled = () => {
  try {
    return localStorage.getItem(FAKE_FLAG) === '1';
  } catch {
    return false;
  }
};

let current: AuthUser | null = null;
let backend: SocialBackend | null = null;

/** Kalles når en bruker logger inn (App → SignedIn). */
export function bindSocialUser(user: AuthUser | null) {
  current = user;
  backend = null;
}

/** Sosialt for innlogget bruker, eller null når det ikke er mulig (lokal konto uten nett). */
export function social(): SocialBackend | null {
  if (backend) return backend;
  if (!current) return null;
  if (current.kind === 'cloud' && supabase) backend = createSupabaseSocial(supabase);
  else if (fakeEnabled()) backend = createFakeSocial(() => current?.id ?? null);
  return backend;
}

/** Kan denne kontoen bruke Sosialt? (Konto på nett, eller den falske varianten i tester.) */
export const socialAvailable = (user: Pick<AuthUser, 'kind'>) => (user.kind === 'cloud' && !!supabase) || fakeEnabled();
