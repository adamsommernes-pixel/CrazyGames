import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '../../db/dexie';
import { Icon } from '../../components/Icon';
import { ImportButton, ImportHelp } from '../import/ImportButton';
import { t } from '../../i18n';

/** Settes når brukeren har sett tilbudet om import (i oppstarten eller her). */
export const IMPORT_OFFER_KEY = 'import_offer_seen';
const markSeen = () => db.kv.put({ key: IMPORT_OFFER_KEY, value: now() });

/** Diskret tilbud til eksisterende brukere: hent inn data fra Hevy, Strong eller Lyfto. */
export function ImportBanner() {
  const seen = useLiveQuery(async () => !!(await db.kv.get(IMPORT_OFFER_KEY)), [], true);
  const [open, setOpen] = useState(false);
  if (seen) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-w-0 flex-1 text-left text-muted">
          <span className="text-ink">{t('Vil du importere data?', 'Want to import data?')}</span> {t('Hent inn øktene dine fra Hevy, Strong eller Lyfto', 'Bring your workouts over from Hevy, Strong or Lyfto')} {open ? '' : '→'}
        </button>
        <button type="button" aria-label={t('Skjul', 'Hide')} onClick={() => void markSeen()} className="grid size-7 shrink-0 place-items-center text-faint">
          <Icon name="x" size={14} />
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2 pb-1">
          <ImportButton label={t('Velg eksportfil', 'Choose export file')} onDone={() => setTimeout(() => void markSeen(), 4000)} />
          <ImportHelp />
        </div>
      )}
    </div>
  );
}
