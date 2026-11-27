import { SWATCHES, normalizeAccent } from '../lib/theme';
import { getLang } from '../i18n';
import { Icon } from './Icon';

/** De kuraterte appfargene. Valgt farge får en hake. */
export function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const selected = normalizeAccent(value);
  return (
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={label}>
      {SWATCHES.map((s) => {
        const on = s.hex === selected;
        return (
          <button
            key={s.hex}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={getLang() === 'en' ? s.en : s.nb}
            title={getLang() === 'en' ? s.en : s.nb}
            onClick={() => onChange(s.hex)}
            className={`grid size-10 place-items-center rounded-full transition ${on ? 'ring-2 ring-ink ring-offset-2 ring-offset-bg' : ''}`}
            style={{ background: s.hex }}
          >
            {on && <Icon name="check" size={18} strokeWidth={3} className={s.hex === '#e8e8e8' || s.hex === '#e8c547' ? 'text-black' : 'text-white'} />}
          </button>
        );
      })}
    </div>
  );
}
