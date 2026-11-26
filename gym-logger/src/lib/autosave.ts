import { useCallback, useEffect, useRef } from 'react';

// Lagring mens du skriver: venter litt etter siste tastetrykk, men lagrer straks hvis
// siden skjules, lukkes eller lastes på nytt, eller feltet forsvinner.

const pending = new Set<() => void>();
let listening = false;

export function flushPendingSaves() {
  for (const f of [...pending]) f();
}

function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pagehide', flushPendingSaves);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSaves();
  });
}

/** Gir `schedule(fn)`: kjører fn etter `delay` ms uten nye kall, eller tidligere ved flush. */
export function useAutosave(delay = 400) {
  const job = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(() => {
    clearTimeout(timer.current);
    const fn = job.current;
    if (!fn) return;
    job.current = null;
    pending.delete(run);
    fn();
  }, []);

  const schedule = useCallback(
    (fn: () => void) => {
      listen();
      job.current = fn;
      pending.add(run);
      clearTimeout(timer.current);
      timer.current = setTimeout(run, delay);
    },
    [delay, run],
  );

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    job.current = null;
    pending.delete(run);
  }, [run]);

  useEffect(() => run, [run]);
  return { schedule, flush: run, cancel };
}
