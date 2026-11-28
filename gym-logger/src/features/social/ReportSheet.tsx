import { useState } from 'react';
import { Button, Chip, Sheet, inputClass } from '../../components/ui';
import { showToast } from '../../components/toast';
import { social, type Person } from '../../social';
import { errorText } from '../../social/store';
import { t } from '../../i18n';

const REASONS = () => [
  { id: 'spam', label: t('Spam', 'Spam') },
  { id: 'name', label: t('Upassende navn eller bilde', 'Inappropriate name or picture') },
  { id: 'harass', label: t('Trakassering', 'Harassment') },
  { id: 'fake', label: t('Falske tall', 'Fake numbers') },
  { id: 'other', label: t('Annet', 'Other') },
];

/** Rapporter en bruker (og valgfritt en økt). Rapporten leses bare av RepGrade. */
export function ReportSheet({ person, activityId, open, onClose }: { person: Person; activityId?: string; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const label = REASONS().find((r) => r.id === reason)?.label ?? reason;
      await social()?.report(person.user_id, `${reason}: ${label}${text.trim() ? ` – ${text.trim()}` : ''}`.slice(0, 500), activityId);
      showToast(t('Takk. Rapporten er sendt.', 'Thanks. The report has been sent.'));
      setReason(null);
      setText('');
      onClose();
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t(`Rapporter ${person.display_name}`, `Report ${person.display_name}`)}>
      <p className="mb-3 text-sm text-muted">{t('Hva er galt? Rapporten er anonym for den du rapporterer.', "What's wrong? The person you report won't see who reported them.")}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {REASONS().map((r) => (
          <Chip key={r.id} active={reason === r.id} onClick={() => setReason(r.id)}>
            {r.label}
          </Chip>
        ))}
      </div>
      <textarea className={`${inputClass} mb-4 min-h-20 py-2`} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Mer om hva som skjedde (valgfritt)', 'More about what happened (optional)')} />
      <Button full disabled={!reason || busy} onClick={() => void send()}>
        {t('Send rapport', 'Send report')}
      </Button>
    </Sheet>
  );
}
