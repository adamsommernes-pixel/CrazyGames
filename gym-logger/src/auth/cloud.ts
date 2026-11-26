import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthError, MIN_PASSWORD, validateSignUp, type AuthBackend, type AuthUser } from './types';
import { userDbName } from '../db/dexie';
import Dexie from 'dexie';

const toUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email ?? '',
  name: (u.user_metadata?.name as string | undefined) ?? '',
  kind: 'cloud',
  created_at: u.created_at,
});

function message(e: { message: string; code?: string } | null): string {
  if (!e) return 'Noe gikk galt.';
  const m = e.message.toLowerCase();
  if (m.includes('invalid login')) return 'Feil e-post eller passord.';
  if (m.includes('already registered')) return 'Det finnes allerede en konto med denne e-posten. Logg inn i stedet.';
  if (m.includes('email not confirmed')) return 'Bekreft e-posten din først. Sjekk innboksen.';
  if (m.includes('fetch') || m.includes('network')) return 'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.';
  return e.message;
}

/** Kontoer i Supabase. Brukes når appen er bygget med Supabase-nøkler. */
export function createCloudBackend(sb: SupabaseClient): AuthBackend {
  return {
    kind: 'cloud',

    async current() {
      const { data } = await sb.auth.getSession();
      return data.session ? toUser(data.session.user) : null;
    },

    async signUp(name, email, password) {
      validateSignUp(name, email, password);
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw new AuthError(message(error));
      if (!data.session || !data.user) return { needsConfirmation: true };
      return toUser(data.user);
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) throw new AuthError(message(error));
      return toUser(data.user);
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async changePassword(oldPassword, newPassword) {
      const { data } = await sb.auth.getUser();
      if (!data.user?.email) throw new AuthError('Du er ikke logget inn.');
      const check = await sb.auth.signInWithPassword({ email: data.user.email, password: oldPassword });
      if (check.error) throw new AuthError('Nåværende passord er feil.');
      if (newPassword.length < MIN_PASSWORD) throw new AuthError(`Nytt passord må ha minst ${MIN_PASSWORD} tegn.`);
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw new AuthError(message(error));
    },

    async deleteAccount(password) {
      const { data } = await sb.auth.getUser();
      if (!data.user?.email) throw new AuthError('Du er ikke logget inn.');
      const check = await sb.auth.signInWithPassword({ email: data.user.email, password });
      if (check.error) throw new AuthError('Passordet er feil.');
      // Databasefunksjonen delete_user() sletter kontoen og alle rader (se 002_profiles.sql).
      const { error } = await sb.rpc('delete_user');
      if (error) throw new AuthError(message(error));
      await sb.auth.signOut();
      await Dexie.delete(userDbName(data.user.id));
    },

    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw new AuthError(message(error));
    },

    subscribe(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },
  };
}
