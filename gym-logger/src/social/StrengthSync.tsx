import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUser } from '../auth/AuthProvider';
import { getProfile } from '../db/repo';
import { useStrength } from '../lib/strengthLive';
import type { StrengthProfile } from '../lib/strength';
import { inputOf, saveMySocial, useMySocial } from './store';
import type { SocialProfile } from './types';

// Holder styrkenivået og appfargen i den sosiale profilen oppdatert. Nivået regnes ut på telefonen;
// bare resultatet sendes (aldri kroppsvekten). Løft som ikke teller nå (ikke trent på 30 dager), sendes ikke.

const r1 = (n: number) => Math.round(n * 10) / 10;

export function strengthPayload(s: StrengthProfile): Pick<SocialProfile, 'tier_index' | 'score' | 'lift_scores'> {
  const active = s.lifts.filter((l) => l.active);
  if (!active.length) return { tier_index: null, score: null, lift_scores: {} };
  return { tier_index: s.tier.index, score: r1(s.score), lift_scores: Object.fromEntries(active.map((l) => [l.exerciseId, r1(l.score)])) };
}

const same = (a: Record<string, number>, b: Record<string, number>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => b[k] === a[k]);
};

/** Usynlig komponent i den innloggede appen (bare på sosial konto). */
export function StrengthSync() {
  const user = useUser();
  const strength = useStrength();
  const color = useLiveQuery(async () => (await getProfile(user.id))?.color, [user.id]);
  const { profile } = useMySocial();
  useEffect(() => {
    if (!profile || !strength) return;
    const next = strengthPayload(strength.profile);
    const c = color ?? profile.color;
    if (next.tier_index === profile.tier_index && next.score === (profile.score === null ? null : r1(profile.score)) && same(next.lift_scores, profile.lift_scores) && c === profile.color) return;
    // Litt venting, så flere endringer rett etter hverandre (f.eks. under en økt) blir én lagring.
    const id = setTimeout(() => void saveMySocial({ ...inputOf(profile), ...next, color: c }).catch(() => {}), 1500);
    return () => clearTimeout(id);
  }, [profile, strength, color]);
  return null;
}
