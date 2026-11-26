import { db } from '../db/dexie';
import { releaseStaleScrollLock } from './scrollLock';

// Når appen kommer tilbake etter lang tid i bakgrunnen (særlig på iPhone), kan nettleseren ha
// kuttet forbindelsen til den lokale databasen. Da reagerer knapper som lagrer ikke lenger.
// Her sjekker vi forbindelsen og laster appen på nytt hvis den er borte. Alt er lagret før.

const LONG_AWAY_MS = 5 * 60 * 1000;
const RELOAD_KEY = 'repgrade-resume-reload';
let hiddenAt = 0;

function isDbLost(e: unknown) {
  const m = `${(e as { name?: string })?.name ?? ''} ${(e as Error)?.message ?? e}`.toLowerCase();
  return (
    m.includes('databaseclosed') ||
    m.includes('connection to indexed database') ||
    m.includes('database connection is closing') ||
    (m.includes('invalidstateerror') && /database|indexeddb|transaction/.test(m))
  );
}

function reloadOnce() {
  // Unngå en løkke av omlastinger: høyst én gang per minutt.
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* ignorer */
  }
  location.reload();
}

async function dbHealthy(): Promise<boolean> {
  try {
    await Promise.race([db.kv.get('__ping'), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500))]);
    return true;
  } catch {
    return false;
  }
}

async function onVisible() {
  releaseStaleScrollLock();
  const away = hiddenAt ? Date.now() - hiddenAt : 0;
  hiddenAt = 0;
  if (away > LONG_AWAY_MS && !(await dbHealthy())) reloadOnce();
}

export function watchResume() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else void onVisible();
  });
  // Siden hentet fra «tilbake»-hurtigbufferen: samme sjekk.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) void onVisible();
  });
  // Mistet databaseforbindelse midt i bruk: last på nytt i stedet for å henge.
  window.addEventListener('unhandledrejection', (e) => {
    if (isDbLost(e.reason)) reloadOnce();
  });
}
