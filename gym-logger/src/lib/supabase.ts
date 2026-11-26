import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { normalizeSupabaseConfig } from './supabaseConfig';

const config = normalizeSupabaseConfig(import.meta.env.VITE_SUPABASE_URL as string | undefined, import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/** Feilmelding når Supabase-oppsettet er ugyldig. Da viser appen en feilskjerm i stedet for å krasje. */
export let supabaseConfigError: string | null = config && 'error' in config ? config.error : null;

function create(): SupabaseClient | null {
  if (!config || 'error' in config) return null;
  try {
    return createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  } catch (e) {
    supabaseConfigError = e instanceof Error ? e.message : String(e);
    return null;
  }
}

/** null når appen er bygget uten Supabase-nøkler (lokal modus) eller oppsettet er ugyldig. */
export const supabase: SupabaseClient | null = create();

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
