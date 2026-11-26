import { NavLink, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon, type IconName } from './Icon';
import { getActiveWorkout } from '../db/repo';
import { openStartSheet } from '../features/workout/StartSheet';
import { useNow } from '../features/workout/restTimer';
import { duration, isLongAgo } from '../lib/format';
import { t } from '../i18n';

const left = (): { to: string; label: string; icon: IconName }[] => [
  { to: '/', label: t('Hjem', 'Home'), icon: 'home' },
  { to: '/history', label: t('Historikk', 'History'), icon: 'history' },
];
const right = (): { to: string; label: string; icon: IconName }[] => [
  { to: '/progress', label: t('Fremgang', 'Progress'), icon: 'chart' },
  { to: '/profile', label: t('Profil', 'Profile'), icon: 'user' },
];

function Tab({ to, label, icon }: { to: string; label: string; icon: IconName }) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${isActive ? 'text-green' : 'text-faint'}`
        }
      >
        <Icon name={icon} size={23} />
        {label}
      </NavLink>
    </li>
  );
}

export function BottomNav() {
  const navigate = useNavigate();
  const active = useLiveQuery(() => getActiveWorkout(), []);
  const now = useNow(1000, !!active);
  return (
    <nav className="pb-safe border-t border-line bg-bg/90 backdrop-blur-lg" aria-label={t('Hovedmeny', 'Main menu')}>
      <ul className="mx-auto flex max-w-xl items-end">
        {left().map((t) => (
          <Tab key={t.to} {...t} />
        ))}
        <li className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => (active ? navigate('/workout') : openStartSheet())}
            aria-label={active ? t('Fortsett økt', 'Continue workout') : t('Start økt', 'Start workout')}
            className="-mt-5 mb-1 flex flex-col items-center gap-0.5"
          >
            <span className={`grid size-14 place-items-center rounded-full bg-green text-black shadow-glow ring-4 ring-bg transition active:scale-95 ${active ? 'animate-pulse' : ''}`}>
              <Icon name={active ? 'play' : 'plus'} size={26} strokeWidth={2.6} />
            </span>
            <span className="font-num text-[11px] font-semibold text-green">
              {active ? (isLongAgo(active.started_at, now) ? t('Økt', 'Workout') : duration(now - new Date(active.started_at).getTime())) : 'Start'}
            </span>
          </button>
        </li>
        {right().map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </ul>
    </nav>
  );
}
