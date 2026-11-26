import { t } from '../i18n';
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** local = lagret på denne enheten, cloud = Supabase-konto. */
  kind: 'local' | 'cloud';
  created_at: string;
}

export interface AuthBackend {
  kind: AuthUser['kind'];
  current(): Promise<AuthUser | null>;
  signUp(name: string, email: string, password: string): Promise<AuthUser | { needsConfirmation: true }>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  resetPassword?(email: string): Promise<void>;
  /** Varsler ved endringer som skjer utenfor appen (f.eks. utløpt sesjon). */
  subscribe?(cb: () => void): () => void;
}

/** Feil med en melding som kan vises direkte til brukeren. */
export class AuthError extends Error {}

export const MIN_PASSWORD = 8;

export function validateSignUp(name: string, email: string, password: string) {
  if (!name.trim()) throw new AuthError(t('Skriv inn navnet ditt.', 'Enter your name.'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new AuthError(t('E-postadressen ser ikke riktig ut.', "That email address doesn't look right."));
  if (password.length < MIN_PASSWORD) throw new AuthError(t(`Passordet må ha minst ${MIN_PASSWORD} tegn.`, `The password must be at least ${MIN_PASSWORD} characters.`));
}
