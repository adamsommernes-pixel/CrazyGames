import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthBackend, AuthUser } from './types';
import { createLocalBackend } from './local';
import { createCloudBackend } from './cloud';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'signed-in' | 'signed-out';
  backend: AuthBackend;
  signUp: (name: string, email: string, password: string) => Promise<'ok' | 'confirm-email'>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (oldPw: string, newPw: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

// Sky-konto når appen er bygget med Supabase-nøkler, ellers konto lagret på enheten.
const backend: AuthBackend = supabase ? createCloudBackend(supabase) : createLocalBackend();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const refresh = useCallback(async () => {
    const u = await backend.current().catch(() => null);
    setUser((prev) => (prev?.id === u?.id && prev?.name === u?.name ? prev : u));
    setStatus(u ? 'signed-in' : 'signed-out');
  }, []);

  useEffect(() => {
    void refresh();
    return backend.subscribe?.(() => void refresh());
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      status,
      backend,
      async signUp(name, email, password) {
        const r = await backend.signUp(name, email, password);
        if ('needsConfirmation' in r) return 'confirm-email';
        setUser(r);
        setStatus('signed-in');
        return 'ok';
      },
      async signIn(email, password) {
        const u = await backend.signIn(email, password);
        setUser(u);
        setStatus('signed-in');
      },
      async signOut() {
        await backend.signOut();
        setUser(null);
        setStatus('signed-out');
      },
      changePassword: (o, n) => backend.changePassword(o, n),
      async deleteAccount(password) {
        await backend.deleteAccount(password);
        setUser(null);
        setStatus('signed-out');
      },
    }),
    [user, status],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth må brukes inne i AuthProvider');
  return v;
}

/** Innlogget bruker. Brukes bare i den innloggede delen av appen. */
export function useUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('Ingen innlogget bruker');
  return user;
}
