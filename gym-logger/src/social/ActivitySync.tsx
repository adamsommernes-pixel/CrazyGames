import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStrength } from '../lib/strengthLive';
import { useSetting } from '../lib/settings';
import { social } from './index';
import { useMySocial } from './store';
import { signatures, syncActivities } from './publish';

/** Usynlig komponent (bare på sosial konto): publiserer økter når de blir ferdige eller endres. */
export function ActivitySync() {
  const { profile } = useMySocial();
  const strength = useStrength();
  const off = useSetting('socialUnshared');
  const since = profile?.created_at;
  const sig = useLiveQuery(async () => (since ? [...(await signatures(since))].join(';') : ''), [since]);
  const [online, setOnline] = useState(0);
  useEffect(() => {
    const on = () => setOnline((n) => n + 1);
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, []);
  useEffect(() => {
    const b = social();
    if (!b || !since || !strength || sig === undefined) return;
    const ctx = { bw: strength.bw, sex: strength.sex, tier: strength.profile.lifts.some((l) => l.active) ? { index: strength.profile.tier.index, score: Math.round(strength.profile.score * 10) / 10 } : null };
    // Vent litt, så mange endringer på rad (f.eks. retting av flere sets) blir én sending.
    const id = setTimeout(() => void syncActivities(b, ctx, since).catch(() => {}), 1500);
    return () => clearTimeout(id);
    // strength endres ofte; signaturen styrer når det sendes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, since, off, online, !!strength]);
  return null;
}
