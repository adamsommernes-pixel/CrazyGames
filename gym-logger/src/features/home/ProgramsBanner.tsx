import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, now } from '../../db/dexie';
import { PROGRAMS_SEEN_KEY } from '../../db/repo';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n';

/** Diskret linje for eksisterende brukere: nye programmer finnes, finn et som passer uka di. */
export function ProgramsBanner({ days }: { days: number }) {
  const seen = useLiveQuery(async () => !!(await db.kv.get(PROGRAMS_SEEN_KEY)), [], true);
  if (seen) return null;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm">
      <Icon name="sparkle" size={16} className="shrink-0 text-accent" />
      <Link to={`/programs?days=${days}`} className="min-w-0 flex-1 text-muted">
        <span className="text-ink">{t('Nye programmer er her.', 'New programs are here.')}</span> {t('Finn et som passer uka di', 'Find one that fits your week')} →
      </Link>
      <button type="button" aria-label={t('Skjul', 'Hide')} onClick={() => void db.kv.put({ key: PROGRAMS_SEEN_KEY, value: now() })} className="grid size-7 shrink-0 place-items-center text-faint">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
