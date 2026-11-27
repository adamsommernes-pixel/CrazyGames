import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { backupFileName, downloadJSON, exportBackup, lastBackupAt, markBackedUp } from '../../db/backup';
import { Button, Card } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useUser } from '../../auth/AuthProvider';
import { t } from '../../i18n';

const DAY = 86_400_000;
const DISMISS_KEY = 'backup_reminder_dismissed_at';

/** Påminnelse om backup for lokale kontoer: minst 5 økter og over 14 dager siden sist. */
export function BackupReminder() {
  const user = useUser();
  const show = useLiveQuery(async () => {
    if (user.kind === 'cloud') return false;
    const workouts = (await db.workouts.toArray()).filter((w) => !w.deleted && w.ended_at).length;
    if (workouts < 5) return false;
    const last = await lastBackupAt();
    const dismissed = (await db.kv.get(DISMISS_KEY))?.value as string | undefined;
    const since = (iso?: string | null) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);
    return since(last) > 14 * DAY && since(dismissed) > 14 * DAY;
  }, [user.kind], false);
  if (!show) return null;
  return (
    <Card className="border-warn/30 p-3.5">
      <div className="flex gap-3">
        <Icon name="download" size={20} className="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t('Ta en backup', 'Back up your data')}</p>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              'Øktene dine ligger bare på denne enheten. Last ned en backup og lagre den trygt, så mister du ingenting om telefonen blir borte.',
              'Your workouts only live on this device. Download a backup and keep it safe, so you lose nothing if the phone is lost.',
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          icon="download"
          className="flex-1"
          onClick={async () => {
            downloadJSON(await exportBackup(), backupFileName('json'));
            await markBackedUp();
          }}
        >
          {t('Last ned backup', 'Download backup')}
        </Button>
        <Button variant="ghost" onClick={() => void db.kv.put({ key: DISMISS_KEY, value: new Date().toISOString() })}>
          {t('Senere', 'Later')}
        </Button>
      </div>
    </Card>
  );
}
