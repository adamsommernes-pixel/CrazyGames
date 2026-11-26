import { useEffect } from 'react';

type Sentinel = { release: () => Promise<void>; released?: boolean };
type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> };

/**
 * Holder skjermen på mens komponenten er montert (brukes under en aktiv økt).
 * Nettleseren slipper låsen når appen går i bakgrunnen, så den bes om igjen når appen vises.
 * Gjør ingenting der nettleseren ikke støtter det eller nekter.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!enabled || !api) return;
    let sentinel: Sentinel | null = null;
    let active = true;

    const request = async () => {
      if (!active || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      try {
        sentinel = await api.request('screen');
      } catch {
        sentinel = null; // f.eks. strømsparing eller manglende tillatelse
      }
    };
    const onVisible = () => void request();

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
