import type { IconName } from '../../components/Icon';
import type { Goal } from '../../db/types';
import { t } from '../../i18n';

/** Ikon og forklaring per mål, brukt i oppstarten og under Profil. */
export const GOAL_INFO: Record<Goal, { icon: IconName; text: string }> = {
  strength: { icon: 'dumbbell', get text() { return t('Tunge løft, få reps, lang hvile.', 'Heavy lifts, few reps, long rest.'); } },
  hypertrophy: { icon: 'flame', get text() { return t('Moderat vekt, 8–12 reps.', 'Moderate weight, 8–12 reps.'); } },
  general: { icon: 'target', get text() { return t('Allsidig trening og god form.', 'Well-rounded training and good fitness.'); } },
  endurance: { icon: 'timer', get text() { return t('Flere reps, kortere hvile.', 'More reps, shorter rest.'); } },
  own: { icon: 'user', get text() { return t('Bare trene på min måte. Ingen føringer, du bestemmer selv.', 'Just do my own thing. No guidance, you decide.'); } },
};
