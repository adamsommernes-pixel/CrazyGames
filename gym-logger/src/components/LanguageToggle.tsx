import { setLang, useLang, type Lang } from '../i18n';

const OPTIONS: { lang: Lang; short: string; label: string }[] = [
  { lang: 'nb', short: 'NO', label: 'Norsk' },
  { lang: 'en', short: 'EN', label: 'English' },
];

/** Liten NO/EN-bryter. Hvert valg er merket på sitt eget språk, så det er lett å finne igjen. */
export function LanguageToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const lang = useLang();
  return (
    <div className="inline-flex rounded-xl border border-line bg-raised p-0.5" role="radiogroup" aria-label="Språk / Language">
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          role="radio"
          aria-checked={lang === o.lang}
          aria-label={o.label}
          onClick={() => setLang(o.lang)}
          className={`rounded-[10px] font-semibold transition ${size === 'md' ? 'min-h-10 px-4' : 'min-h-8 px-2.5 text-xs'} ${
            lang === o.lang ? 'bg-accent text-on-accent' : 'text-muted'
          }`}
        >
          {size === 'md' ? o.label : o.short}
        </button>
      ))}
    </div>
  );
}
