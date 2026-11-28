// Navn som ikke er lov på sosiale profiler. Samme lister som name_problem() i 012_social.sql,
// slik at appen kan si fra mens du skriver (databasen stopper det uansett).
// Ordene sjekkes som del av teksten, så listen holdes til ord som ikke finnes inni vanlige navn.

export const RESERVED = ['admin', 'administrator', 'support', 'moderator', 'mod', 'staff', 'official', 'help', 'system', 'root', 'null', 'undefined', 'anonymous', 'me', 'settings', 'privacy', 'api'];
export const BANNED = ['nigger', 'nigga', 'faggot', 'retard', 'hitler', 'fuck', 'cunt', 'whore', 'neger', 'hestkuk'];

export function nameProblem(handle: string, name: string): 'reserved' | 'banned' | null {
  const h = handle.toLowerCase();
  const n = name.toLowerCase();
  if (h.startsWith('repgrade') || RESERVED.includes(h)) return 'reserved';
  if (BANNED.some((w) => h.includes(w) || n.includes(w))) return 'banned';
  return null;
}
