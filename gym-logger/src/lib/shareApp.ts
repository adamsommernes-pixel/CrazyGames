import { showToast } from '../components/toast';
import { t } from '../i18n';

/** Adressen til nettsiden (appen ligger under /app/, nettsiden i mappen over). */
export function siteUrl(): string {
  const here = new URL(import.meta.env.BASE_URL, location.origin);
  return new URL(here.pathname.replace(/app\/?$/, ''), location.origin).href;
}

/**
 * Del RepGrade med en venn: telefonens delemeny der den finnes, ellers kopieres lenken.
 * Appen finnes ikke i App Store, så lenken til nettsiden er den enkleste måten å spre den på.
 */
export async function shareApp(): Promise<void> {
  const url = siteUrl();
  const text = t('Jeg logger treningen min i RepGrade. Gratis, uten reklame, og den måler styrken din:', 'I log my training in RepGrade. Free, no ads, and it measures your strength:');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'RepGrade', text, url });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return; // brukeren lukket delemenyen
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    showToast(t('Lenken er kopiert. Lim den inn i en melding.', 'Link copied. Paste it into a message.'));
  } catch {
    showToast(url, undefined, 10_000);
  }
}
