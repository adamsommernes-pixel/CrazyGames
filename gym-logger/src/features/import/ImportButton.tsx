import { useRef, useState } from 'react';
import { importBackup, parseBackup, summarizeBackup } from '../../db/backup';
import { convertImport, SOURCE_LABEL } from '../../db/importApps';
import { getSetting } from '../../lib/settings';
import { askConfirm } from '../../components/confirm';
import { Button } from '../../components/ui';
import { dateShort } from '../../lib/format';
import { t } from '../../i18n';

/** Kort forklaring på hvor eksportfila finnes i de andre appene. */
export function ImportHelp() {
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer text-faint">{t('Hvor finner jeg eksportfila?', 'Where do I find the export file?')}</summary>
      <ul className="mt-2 flex flex-col gap-1 pl-4 [list-style:disc]">
        <li>{t('Hevy: Profil → Innstillinger → «Export & Import Data» → «Export Workouts» (CSV).', 'Hevy: Profile → Settings → “Export & Import Data” → “Export Workouts” (CSV).')}</li>
        <li>{t('Strong: Innstillinger → «Export Strong Data» (CSV).', 'Strong: Settings → “Export Strong Data” (CSV).')}</li>
        <li>{t('Lyfto: Innstillinger → eksporter data (JSON).', 'Lyfto: Settings → export data (JSON).')}</li>
        <li>{t('Lagre fila i Filer/iCloud og velg den her.', 'Save the file to Files/iCloud and pick it here.')}</li>
      </ul>
    </details>
  );
}

/**
 * Knapp som leser inn en backup fra Repgrade eller en eksport fra Lyfto, Hevy eller Strong.
 * Viser et sammendrag og spør før noe legges inn.
 */
export function ImportButton({ label, variant = 'secondary', onDone }: { label?: string; variant?: 'primary' | 'secondary'; onDone?: (rows: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setMsg(null);
    try {
      const unit = await getSetting('unit');
      const { source, data } = convertImport(await file.text(), unit);
      const backup = parseBackup(data);
      const sum = summarizeBackup(backup);
      if (!sum.workouts && !sum.routines && !sum.bodyweights) throw new Error(t('Fant ingen økter i fila.', 'No workouts found in the file.'));
      const from = source === 'repgrade' ? t(`Backup fra ${dateShort(sum.exportedAt)}`, `Backup from ${dateShort(sum.exportedAt)}`) : t(`Eksport fra ${SOURCE_LABEL[source]}`, `Export from ${SOURCE_LABEL[source]}`);
      const unitNote = source === 'strong' ? ' ' + t(`Vektene leses som ${unit} (samme enhet som i Repgrade).`, `Weights are read as ${unit} (the same unit as in Repgrade).`) : '';
      const ok = await askConfirm(
        t(
          `${from}: ${sum.workouts} økter og ${sum.sets} sets${sum.routines ? `, ${sum.routines} rutiner` : ''}${sum.bodyweights ? `, ${sum.bodyweights} kroppsvekter` : ''}. Legge det til i Repgrade? Ingenting slettes.${unitNote}`,
          `${from}: ${sum.workouts} workouts and ${sum.sets} sets${sum.routines ? `, ${sum.routines} routines` : ''}${sum.bodyweights ? `, ${sum.bodyweights} bodyweights` : ''}. Add it to Repgrade? Nothing is deleted.${unitNote}`,
        ),
        { confirmLabel: t('Importer', 'Import'), danger: false },
      );
      if (!ok) return;
      setBusy(true);
      const n = await importBackup(backup);
      setMsg(t(`Ferdig! ${sum.workouts} økter er hentet inn.`, `Done! ${sum.workouts} workouts imported.`));
      onDone?.(n);
    } catch (err) {
      setMsg(err instanceof Error && !(err instanceof SyntaxError) ? err.message : t('Kunne ikke lese filen.', 'Could not read the file.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} icon="upload" full disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? t('Importerer …', 'Importing …') : (label ?? t('Importer data', 'Import data'))}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,text/csv,.csv"
        className="hidden"
        aria-label={t('Velg fil å importere', 'Choose file to import')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />
      {msg && (
        <p className="text-sm text-accent-strong" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
