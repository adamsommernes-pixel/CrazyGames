import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Økt', icon: 'dumbbell' },
  { to: '/history', label: 'Historikk', icon: 'history' },
  { to: '/routines', label: 'Rutiner', icon: 'list' },
  { to: '/progress', label: 'Fremgang', icon: 'chart' },
  { to: '/profile', label: 'Profil', icon: 'user' },
];

export function BottomNav() {
  return (
    <nav className="pb-safe border-t border-line bg-bg/95 backdrop-blur" aria-label="Hovedmeny">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-green' : 'text-faint'
                }`
              }
            >
              <Icon name={t.icon} size={24} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
