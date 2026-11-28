import { tierAt } from '../lib/strength';
import { locale, t } from '../i18n';
import type { Badge } from './types';

// Teksten på et merke. Merkene deles ut av databasen (award_* i 012_social.sql).

function boardName(b: Badge['board']) {
  return b === 'level' ? t('Sterkest', 'Strongest') : b === 'gain' ? t('Fremgang', 'Most improved') : t('Flest økter', 'Most workouts');
}

export function badgeIcon(b: Pick<Badge, 'kind'>): string {
  return b.kind === 'challenge' ? '🏆' : '🥇';
}

export function badgeText(b: Pick<Badge, 'kind' | 'title' | 'board' | 'tier_index' | 'period'>): string {
  if (b.kind === 'challenge') return t(`Vant «${b.title ?? ''}»`, `Won “${b.title ?? ''}”`);
  const month = b.period ? new Date(`${b.period.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString(locale(), { month: 'short', year: 'numeric' }).replace('.', '') : '';
  const tier = b.tier_index !== null ? tierAt(b.tier_index).name : '';
  return `#1 ${boardName(b.board)} · ${tier} · ${month}`;
}
