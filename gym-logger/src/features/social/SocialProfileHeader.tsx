import { Avatar } from '../../components/widgets';
import { Icon } from '../../components/Icon';
import { TierEmblem } from '../../components/TierBadge';
import type { SocialProfile } from '../../social';
import { VISIBILITY_ICON, visibilityName } from '../../social/visibility';
import { tierAt } from '../../lib/strength';
import { t } from '../../i18n';

/** Navn, @brukernavn, synlighet og nivå. Brukes på Sosialt og i Profil. */
export function SocialProfileHeader({ profile }: { profile: SocialProfile }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={profile.display_name} color={profile.color} size={52} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold">{profile.display_name}</div>
        <div className="truncate text-sm text-muted">@{profile.handle}</div>
        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
          <Icon name={VISIBILITY_ICON[profile.visibility]} size={12} />
          {visibilityName(profile.visibility)}
        </div>
      </div>
      {profile.tier_index !== null && (
        <div className="flex flex-col items-center gap-0.5" aria-label={`${t('Nivå', 'Level')}: ${tierAt(profile.tier_index).name}`}>
          <TierEmblem index={profile.tier_index} size={40} />
          <span className="text-[11px] font-semibold text-muted">{tierAt(profile.tier_index).name}</span>
        </div>
      )}
    </div>
  );
}
