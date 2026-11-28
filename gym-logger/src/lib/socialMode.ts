import { useLiveQuery } from 'dexie-react-hooks';
import { useUser } from '../auth/AuthProvider';
import { getProfile, saveProfile } from '../db/repo';
import { social } from '../social';

// Kontotype: «trening» (appen som før) eller «sosial» (Sosialt-fanen tar plassen til Historikk,
// og Historikk flyttes inn under Fremgang). Lagres i profilen (profiles.social), så den følger
// kontoen til andre enheter. På serveren skjuler/viser den den sosiale profilen (012_social.sql).

export function useSocialMode(): boolean {
  const user = useUser();
  return useLiveQuery(async () => (await getProfile(user.id))?.social === 1, [user.id], false);
}

export async function setSocialMode(userId: string, on: boolean) {
  await saveProfile(userId, { social: on ? 1 : 0 });
  // Den falske varianten har ingen synk; den ekte følger profilen via synken.
  await social()?.setActive(on).catch(() => {});
}
