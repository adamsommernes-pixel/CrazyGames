import { getLang, t } from '../i18n';
import { englishName } from '../db/library';

/**
 * Navnet som vises for en øvelse. Innebygde øvelser har navn på begge språk;
 * egne øvelser beholder navnet brukeren skrev.
 */
export function exerciseName(ex: { id: string; name: string; custom?: number } | null | undefined): string {
  if (!ex) return t('Ukjent øvelse', 'Unknown exercise');
  if (getLang() === 'en' && !ex.custom) return englishName(ex.id) ?? ex.name;
  return ex.name;
}
