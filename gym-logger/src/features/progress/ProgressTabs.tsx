import { NavLink } from 'react-router-dom';
import { useSocialMode } from '../../lib/socialMode';
import { t } from '../../i18n';

/**
 * Sosial konto: Historikk ligger under Fremgang. Fanevelger øverst på begge sidene.
 * Treningskonto: vises ikke (Historikk har egen fane i bunnmenyen som før).
 */
export function ProgressTabs() {
  const social = useSocialMode();
  if (!social) return null;
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${isActive ? 'bg-raised text-ink' : 'text-muted'}`;
  return (
    <nav aria-label={t('Fremgang og historikk', 'Progress and history')} className="mb-3 flex gap-1 rounded-xl border border-line bg-surface p-1">
      <NavLink to="/progress" replace className={tab}>
        {t('Fremgang', 'Progress')}
      </NavLink>
      <NavLink to="/history" end replace className={tab}>
        {t('Historikk', 'History')}
      </NavLink>
    </nav>
  );
}
