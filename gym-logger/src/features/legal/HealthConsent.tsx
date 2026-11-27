import { useState } from 'react';
import { Sheet } from '../../components/ui';
import { PrivacyContent } from './PrivacyPage';
import { t } from '../../i18n';

/** Avkrysning for samtykke til kroppsdata i skyen (bare sky-kontoer). */
export function HealthConsent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-line bg-raised p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#2bd66b]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-sm">
          {t(
            'Jeg samtykker til at kroppsvekt, høyde, fødselsår og kjønn lagres i skyen for å beregne styrkenivået og synke mellom enheter.',
            'I consent to my bodyweight, height, year of birth and sex being stored in the cloud to calculate my strength level and sync between devices.',
          )}
        </span>
      </label>
      <p className="mt-2 pl-8 text-xs text-faint">
        {t('Uten samtykke blir disse bare på telefonen. Du kan trekke samtykket når som helst.', 'Without consent they stay on your phone only. You can withdraw consent at any time.')}{' '}
        <button type="button" className="underline" onClick={() => setOpen(true)}>
          {t('Les personvernerklæringen', 'Read the privacy policy')}
        </button>
      </p>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Personvern', 'Privacy')} tall>
        <PrivacyContent />
      </Sheet>
    </div>
  );
}
