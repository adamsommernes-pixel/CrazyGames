/** A boolean kept in sessionStorage, readable with useSyncExternalStore. */
export function createSessionFlag(key: string) {
  const listeners = new Set<() => void>();
  let fallback = false;
  return {
    read(): boolean {
      try {
        return window.sessionStorage.getItem(key) === "1" || fallback;
      } catch {
        return fallback;
      }
    },
    set(value: boolean) {
      fallback = value;
      try {
        if (value) window.sessionStorage.setItem(key, "1");
        else window.sessionStorage.removeItem(key);
      } catch {
        // Storage unavailable: the flag lives for this page view only.
      }
      for (const l of listeners) l();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Logged in to Admin. Also opens Ansatte, so the owner is never locked out of the daily view. */
export const adminSession = createSessionFlag("salong-demo:admin");
/** Logged in to Ansatte with the staff password. */
export const staffSession = createSessionFlag("salong-demo:staff");
