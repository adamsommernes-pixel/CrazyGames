import type { Profile, SyncedTable } from './types';

// Samtykke til kroppsdata i skyen (GDPR art. 9: kroppsvekt kan være helseopplysninger).
// Uten samtykke blir kroppsvekt, høyde, fødselsår og kjønn bare på enheten.

/** Profilfelt som bare sendes til skyen med samtykke. */
export const SENSITIVE_PROFILE_FIELDS = ['bodyweight_kg', 'height_cm', 'birth_year', 'sex'] as const;
/** Tabeller som bare synkes med samtykke. */
export const SENSITIVE_TABLES: SyncedTable[] = ['bodyweights'];

export const hasHealthConsent = (profile: Pick<Profile, 'health_consent_at'> | undefined | null) => !!profile?.health_consent_at;

/**
 * Raden slik den kan sendes til skyen, eller null hvis den ikke skal sendes.
 * Profilen sendes alltid, men uten de sensitive feltene når samtykke mangler.
 */
export function cloudPayload<T extends Record<string, unknown>>(table: SyncedTable, row: T, consent: boolean): T | null {
  if (consent) return row;
  if (SENSITIVE_TABLES.includes(table)) return null;
  if (table === 'profiles') {
    const copy: Record<string, unknown> = { ...row };
    for (const f of SENSITIVE_PROFILE_FIELDS) copy[f] = null;
    return copy as T;
  }
  return row;
}

/**
 * Ved henting uten samtykke: behold de lokale sensitive feltene, så en profil fra skyen
 * (der de er tomme) ikke visker ut det som ligger på telefonen.
 */
export function keepLocalSensitive<T extends Record<string, unknown>>(remote: T, local: T | undefined, consent: boolean): T {
  if (consent || !local) return remote;
  const copy: Record<string, unknown> = { ...remote };
  for (const f of SENSITIVE_PROFILE_FIELDS) if (copy[f] === null || copy[f] === undefined) copy[f] = local[f] ?? null;
  return copy as T;
}

/** Kolonner som er heltall i Supabase. Desimaler (f.eks. 53,8 minutter kondisjon) avvises der. */
const INTEGER_COLUMNS: Partial<Record<SyncedTable, string[]>> = {
  sets: ['position', 'reps'],
  routine_exercises: ['position', 'target_sets', 'target_reps', 'rest_seconds'],
  workout_exercises: ['position', 'rest_seconds', 'target_reps'],
  routines: ['position'],
  profiles: ['weekly_target', 'birth_year'],
};

/** Runder heltallskolonnene, så én rad med desimal ikke stopper hele synken. */
export function fitIntegers<T extends Record<string, unknown>>(table: SyncedTable, row: T): T {
  const cols = INTEGER_COLUMNS[table];
  if (!cols) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const c of cols) if (typeof copy[c] === 'number') copy[c] = Math.round(copy[c] as number);
  return copy as T;
}
