import { useState } from 'react';
import { useUser } from '../../auth/AuthProvider';
import { Icon } from '../../components/Icon';
import { useSetting } from '../../lib/settings';
import { useSocialMode } from '../../lib/socialMode';
import { socialAvailable } from '../../social';
import { setShared } from '../../social/publish';
import { useMySocial } from '../../social/store';
import { visibilityName } from '../../social/visibility';
import { t } from '../../i18n';

/** På oppsummeringen (sosial konto): «Delt med følgerne» – kan slås av for akkurat denne økta. */
export function ShareToFollowers({ workoutId }: { workoutId: string }) {
  const user = useUser();
  const social = useSocialMode();
  const { profile } = useMySocial();
  const off = useSetting('socialUnshared');
  // Vis valget med en gang, ikke først når lagringen er ferdig (ellers hopper bryteren tilbake et øyeblikk).
  const [pending, setPending] = useState<boolean | null>(null);
  if (!social || !socialAvailable(user) || !profile) return null;
  const shared = pending ?? !off.includes(workoutId);
  const who = profile.visibility === 3 ? t('Alle kan se den (åpen konto).', 'Everyone can see it (open account).') : t('Bare følgerne dine ser den.', 'Only your followers see it.');
  return (
    <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <Icon name="users" size={20} className={shared ? 'text-accent' : 'text-faint'} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{t('Del i feeden', 'Share to the feed')}</span>
        <span className="block text-xs text-faint">
          {shared ? who : t('Bare du ser denne økta.', 'Only you see this workout.')} ({visibilityName(profile.visibility)})
        </span>
      </span>
      <input type="checkbox" role="switch" className="size-5 accent-[var(--color-accent)]" checked={shared} onChange={(e) => {
          const v = e.target.checked;
          setPending(v);
          void setShared(workoutId, v).finally(() => setPending(null));
        }} aria-label={t('Del i feeden', 'Share to the feed')} />
    </label>
  );
}
