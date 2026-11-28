import { showToast } from '../components/toast';
import { t } from '../i18n';

// Invitasjonslenke: …/app/#/u/<brukernavn>. Åpnes den før innlogging, huskes den til etterpå.

const KEY = 'repgrade-invite';

export function inviteUrl(handle: string): string {
  const app = new URL(import.meta.env.BASE_URL, location.origin);
  return `${app.href}#/u/${encodeURIComponent(handle)}`;
}

export async function shareInvite(handle: string): Promise<void> {
  const url = inviteUrl(handle);
  const text = t(`Følg meg på RepGrade: @${handle}`, `Follow me on RepGrade: @${handle}`);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'RepGrade', text, url });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    showToast(t('Lenken er kopiert.', 'Link copied.'));
  } catch {
    showToast(url, undefined, 10_000);
  }
}

export function rememberInvite(handle: string) {
  try {
    localStorage.setItem(KEY, handle);
  } catch {
    /* ignorer */
  }
}

/** Gir og glemmer en invitasjon som ble åpnet før innlogging. */
export function takeInvite(): string | null {
  try {
    const h = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return h;
  } catch {
    return null;
  }
}
