import { useEffect } from 'react';
import { db } from '../db/dexie';
import { fetchWhatsNew, markVersionSeen, seenVersion, shouldShowAfterUpdate, showWhatsNew } from './whatsNew';

/**
 * Etter en oppdatering: vis «Nytt i denne versjonen» én gang, også for dem som oppdaterte via det
 * gamle, lille varselet (versjon 1.0 hadde ikke nyhetsskjermen). Nye brukere får den ikke.
 */
export function AfterUpdateNews() {
  useEffect(() => {
    if (__ARTIFACT__) return;
    const version = __APP_VERSION__;
    const seen = seenVersion();
    if (seen === version) return;
    let cancelled = false;
    void (async () => {
      const hasWorkouts = (await db.workouts.filter((w) => !w.deleted && !!w.ended_at).count()) > 0;
      if (cancelled) return;
      if (!shouldShowAfterUpdate(version, seen, hasWorkouts)) return markVersionSeen(version);
      const news = await fetchWhatsNew();
      if (cancelled || !news || news.version !== version) return markVersionSeen(version);
      showWhatsNew(news, () => {}, () => markVersionSeen(version), 'info');
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
