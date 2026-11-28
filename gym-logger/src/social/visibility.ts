import type { IconName } from '../components/Icon';
import type { Visibility } from './types';
import { t } from '../i18n';

export const VISIBILITIES: Visibility[] = [1, 2, 3];

export const VISIBILITY_ICON: Record<Visibility, IconName> = { 1: 'lock', 2: 'trophy', 3: 'users' };

export function visibilityName(v: Visibility): string {
  return v === 1 ? t('Privat', 'Private') : v === 2 ? t('Ledertavler', 'Leaderboards') : t('Åpen', 'Open');
}

export function visibilityText(v: Visibility): string {
  switch (v) {
    case 1:
      return t('Bare følgere du godtar ser øktene og nivået ditt.', 'Only followers you accept see your workouts and level.');
    case 2:
      return t(
        'Som Privat, men navnet og nivået ditt vises på ledertavler. Du får også se ledertavlene.',
        'Like Private, but your name and level show on leaderboards. You also get to see the leaderboards.',
      );
    default:
      return t(
        'Alle med RepGrade kan se profilen og øktene dine, du vises i Oppdag, og folk kan følge deg uten å spørre.',
        'Everyone on RepGrade can see your profile and workouts, you show up in Discover, and people can follow you without asking.',
      );
  }
}
