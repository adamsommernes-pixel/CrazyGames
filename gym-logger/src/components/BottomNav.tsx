import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon, type IconName } from './Icon';
import { getActiveWorkout } from '../db/repo';
import { openStartSheet } from '../features/workout/StartSheet';
import { useNow } from '../features/workout/restTimer';
import { duration, isLongAgo } from '../lib/format';
import { useSocialMode } from '../lib/socialMode';
import { useInbox } from '../social/inbox';
import { t } from '../i18n';

// Sosial konto: Sosialt tar plassen til Historikk, og Historikk ligger under Fremgang.
const left = (social: boolean): { to: string; label: string; icon: IconName }[] => [
  { to: '/', label: t('Hjem', 'Home'), icon: 'home' },
  social ? { to: '/social', label: t('Sosialt', 'Social'), icon: 'users' } : { to: '/history', label: t('Historikk', 'History'), icon: 'history' },
];
const right = (): { to: string; label: string; icon: IconName }[] => [
  { to: '/progress', label: t('Fremgang', 'Progress'), icon: 'chart' },
  { to: '/profile', label: t('Profil', 'Profile'), icon: 'user' },
];

function Tab({ to, label, icon, alsoActive, badge }: { to: string; label: string; icon: IconName; alsoActive?: boolean; badge?: number }) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${isActive || alsoActive ? 'text-accent' : 'text-faint'}`
        }
      >
        <span className="relative">
          <Icon name={icon} size={23} />
          {!!badge && (
            <span className="absolute -top-1 -right-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-on-accent" aria-label={t(`${badge} nye varsler`, `${badge} new notifications`)}>
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        {label}
      </NavLink>
    </li>
  );
}

export function BottomNav() {
  const navigate = useNavigate();
  const active = useLiveQuery(() => getActiveWorkout(), []);
  const now = useNow(1000, !!active);
  const social = useSocialMode();
  const { unread } = useInbox();
  const { pathname } = useLocation();
  // Historikk hører til Fremgang-fanen på en sosial konto.
  const historyInProgress = social && pathname.startsWith('/history');
  return (
    <nav className="pb-safe border-t border-line bg-bg" aria-label={t('Hovedmeny', 'Main menu')}>
      <ul className="mx-auto flex max-w-xl items-end">
        {left(social).map((t) => (
          <Tab key={t.to} {...t} badge={t.to === '/social' ? unread : undefined} />
        ))}
        <li className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => (active ? navigate('/workout') : openStartSheet())}
            aria-label={active ? t('Fortsett økt', 'Continue workout') : t('Start økt', 'Start workout')}
            className="-mt-5 mb-1 flex flex-col items-center gap-0.5"
          >
            <span className={`grid size-13 place-items-center rounded-full bg-accent text-on-accent ring-4 ring-bg transition active:scale-95 ${active ? 'animate-pulse' : ''}`}>
              <Icon name={active ? 'play' : 'plus'} size={24} strokeWidth={2.6} />
            </span>
            <span className="font-num text-[11px] font-semibold text-accent">
              {active ? (isLongAgo(active.started_at, now) ? t('Økt', 'Workout') : duration(now - new Date(active.started_at).getTime())) : 'Start'}
            </span>
          </button>
        </li>
        {right().map((t) => (
          <Tab key={t.to} {...t} alsoActive={t.to === '/progress' && historyInProgress} />
        ))}
      </ul>
    </nav>
  );
}
