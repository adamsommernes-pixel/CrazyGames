import { getLang, t } from '../i18n';
import { englishName, keepsNorwegianName } from '../db/library';

/**
 * Navnet som vises for en øvelse. På engelsk vises alltid det engelske navnet. På norsk beholder
 * bare de store basisløftene (og kondisjon) norsk navn; resten heter det samme som i et vanlig
 * treningsstudio, altså det engelske navnet. Egne øvelser beholder navnet brukeren skrev.
 */
export function exerciseName(ex: { id: string; name: string; custom?: number } | null | undefined): string {
  if (!ex) return t('Ukjent øvelse', 'Unknown exercise');
  if (ex.custom) return ex.name;
  if (getLang() === 'en' || !keepsNorwegianName(ex.id)) return englishName(ex.id) ?? ex.name;
  return ex.name;
}

/** Alle navn en øvelse kan søkes etter: visningsnavnet, det norske og det engelske. */
export function searchNames(ex: { id: string; name: string; custom?: number }): string[] {
  return ex.custom ? [ex.name] : [ex.name, englishName(ex.id) ?? ''];
}
