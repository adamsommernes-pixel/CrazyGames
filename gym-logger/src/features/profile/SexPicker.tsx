import { Chip } from '../../components/ui';
import { SEXES, SEX_LABEL, type Sex } from '../../db/types';
import { t } from '../../i18n';

/** Valgfritt kjønn, brukt til standardene for styrkenivå. */
export function SexPicker({ value, onChange }: { value: Sex | null; onChange: (s: Sex | null) => void }) {
  return (
    <div className="mt-6" role="group" aria-label={t('Kjønn (for styrkenivå)', 'Sex (for strength level)')}>
      <h3 className="mb-1 text-sm font-semibold text-muted">{t('Kjønn (for styrkenivå)', 'Sex (for strength level)')}</h3>
      <p className="mb-2 text-xs text-faint">{t('Styrkestandardene er ulike for menn og kvinner.', 'Strength standards differ for men and women.')}</p>
      <div className="flex flex-wrap gap-2">
        {SEXES.map((s) => (
          <Chip key={s} active={value === s} onClick={() => onChange(s)}>
            {SEX_LABEL[s]}
          </Chip>
        ))}
        <Chip active={value === null} onClick={() => onChange(null)}>
          {t('Vil ikke si', 'Prefer not to say')}
        </Chip>
      </div>
    </div>
  );
}
