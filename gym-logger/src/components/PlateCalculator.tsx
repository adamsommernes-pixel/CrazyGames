import { platesPerSide } from '../lib/plates';
import { num } from '../lib/format';
import { t } from '../i18n';

// Skivefarger etter vanlig standard (IWF), så det ligner skivene på gymmen.
const PLATE_STYLE: Record<string, { bg: string; h: number; fg: string }> = {
  '25': { bg: '#e5484d', h: 100, fg: '#fff' },
  '20': { bg: '#3b82f6', h: 100, fg: '#fff' },
  '15': { bg: '#facc15', h: 88, fg: '#111' },
  '10': { bg: '#22c55e', h: 76, fg: '#111' },
  '5': { bg: '#f2f5f3', h: 60, fg: '#111' },
  '2.5': { bg: '#3a403c', h: 48, fg: '#fff' },
  '1.25': { bg: '#9ba59f', h: 40, fg: '#111' },
};
const styleFor = (p: number) => PLATE_STYLE[String(p)] ?? { bg: '#66706a', h: 52, fg: '#fff' };

/** Viser hvilke skiver som skal på hver side av stanga. Alle vekter i kg. */
export function PlateCalculator({ targetKg, barKg, plates }: { targetKg: number; barKg: number; plates: number[] }) {
  const r = platesPerSide(targetKg, barKg, plates);
  return (
    <div>
      <div className="card relative flex h-32 items-center overflow-hidden rounded-3xl px-3" role="img" aria-label={`${t('Hver side', 'Each side')}: ${r.perSide.length ? r.perSide.map((p) => `${num(p, 2)} kg`).join(', ') : t('ingen skiver', 'no plates')}`}>
        <div className="absolute inset-x-3 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[#7c847f]" />
        <div className="relative z-10 h-8 w-4 rounded-sm bg-[#9ba59f]" />
        <div className="relative z-10 flex items-center gap-[3px] pl-1">
          {r.perSide.map((p, i) => {
            const st = styleFor(p);
            return (
              <div
                key={i}
                className="font-num grid w-6 place-items-center rounded-[5px] text-[10px] font-bold [writing-mode:vertical-rl]"
                style={{ height: `${st.h}%`, minHeight: 36, maxHeight: 112, background: st.bg, color: st.fg }}
              >
                {num(p, 2)}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-muted">
          {t('Per side', 'Per side')}:{' '}
          <span className="font-num font-bold text-ink">{r.perSide.length ? r.perSide.map((p) => num(p, 2)).join(' + ') : t('ingen skiver', 'no plates')}</span>
        </p>
        <p className="text-sm text-faint">{t('Stang', 'Bar')} {num(barKg, 2)} kg</p>
      </div>
      {r.remainder > 0 && (
        <p className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
          {num(r.remainder, 2)} kg {t('går ikke opp med skivene. Nærmeste er', 'cannot be loaded with your plates. Closest is')} {num(r.achieved, 2)} kg.
        </p>
      )}
    </div>
  );
}
