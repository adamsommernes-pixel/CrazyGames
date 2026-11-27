import { useState } from 'react';
import type { MuscleGroup } from '../db/types';
import { MUSCLE_LABEL } from '../db/types';
import { loadLevel, type MuscleLoad } from '../lib/stats';
import { t } from '../i18n';
import { dateLong, num } from '../lib/format';
import { BACK, BACK_BODY, FRONT, FRONT_BODY, type Part } from './bodymap/anatomy';

// Anatomisk kropp forfra og bakfra. Musklene (se bodymap/anatomy.ts) glattes til myke former og
// fylles med brukerens aksentfarge etter hvor mye gruppen er trent. Silhuetten ligger bak og gir
// tynne skillelinjer mellom musklene.

/** Glatter et polygon med Chaikins algoritme (hjørner kuttes til runde kurver). */
function smooth(flat: number[], iterations: number): string {
  let p: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) p.push([flat[i], flat[i + 1]]);
  for (let k = 0; k < iterations; k++) {
    const q: [number, number][] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    p = q;
  }
  return `M${p.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`;
}

type Shape = { group: MuscleGroup | null; d: string };
const shapes = (parts: Part[]): Shape[] => parts.map(([group, , pts]) => ({ group, d: smooth(pts, 3) }));
const silhouette = (parts: Part[], extra: number[][]) => [...extra, ...parts.map((p) => p[2])].map((pts) => smooth(pts, 2));

const VIEW = { w: 100, h: 206 };
const FIGURES = {
  front: { muscles: shapes(FRONT), body: silhouette(FRONT, FRONT_BODY) },
  back: { muscles: shapes(BACK), body: silhouette(BACK, BACK_BODY) },
};

/** Faste flatefarger for kroppen (mørkt tema). */
const SKIN = { body: '#232326', muscle: '#38383d', neutral: '#2d2d31' };
const MIX = [0, 34, 56, 78, 100];

/** Fyllfarge for et nivå 0–4 med aksentfargen som CSS-variabel (appen). */
const FILL = MIX.map((p) => (p ? `color-mix(in srgb, var(--color-accent) ${p}%, ${SKIN.muscle})` : SKIN.muscle));

function BodySvg({
  view,
  fillOf,
  strokeOf,
  onSelect,
  className,
}: {
  view: keyof typeof FIGURES;
  fillOf: (g: MuscleGroup) => string;
  strokeOf?: (g: MuscleGroup) => string | undefined;
  onSelect?: (g: MuscleGroup) => void;
  className?: string;
}) {
  const fig = FIGURES[view];
  return (
    <g className={className}>
      <g style={{ fill: SKIN.body, stroke: SKIN.body }} strokeWidth={3.2} strokeLinejoin="round">
        {fig.body.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {fig.muscles.map((m, i) => {
        if (!m.group) return <path key={i} d={m.d} style={{ fill: SKIN.neutral }} />;
        const g = m.group;
        const stroke = strokeOf?.(g);
        return (
          <path
            key={i}
            d={m.d}
            style={{ fill: fillOf(g), stroke: stroke ?? 'none', cursor: onSelect ? 'pointer' : undefined, transition: 'fill 400ms ease' }}
            strokeWidth={stroke ? 0.6 : 0}
            strokeLinejoin="round"
            onClick={onSelect ? () => onSelect(g) : undefined}
          />
        );
      })}
    </g>
  );
}

function Figure({
  view,
  load,
  days,
  selected,
  onSelect,
  title,
}: {
  view: keyof typeof FIGURES;
  load: Map<MuscleGroup, MuscleLoad>;
  days: number;
  selected: MuscleGroup | null;
  onSelect: (g: MuscleGroup) => void;
  title: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox={`-2 -2 ${VIEW.w + 4} ${VIEW.h + 4}`} className="h-auto w-full max-w-[150px]" aria-hidden="true">
        <BodySvg
          view={view}
          fillOf={(g) => FILL[loadLevel(load.get(g)?.sets ?? 0, days)]}
          strokeOf={(g) => (selected === g ? 'var(--color-ink)' : undefined)}
          onSelect={onSelect}
        />
      </svg>
      <figcaption className="text-[11px] font-semibold text-faint">{title}</figcaption>
    </figure>
  );
}

const MAPPED: MuscleGroup[] = ['Bryst', 'Rygg', 'Skuldre', 'Biceps', 'Triceps', 'Underarmer', 'Mage', 'Bein', 'Rumpe'];

/**
 * Kroppskart: hvilke muskelgrupper som er trent i perioden. Trykk på en del (eller knappene
 * under) for antall sets og når den sist ble trent.
 */
export function BodyMap({ load, days, cardioSessions }: { load: Map<MuscleGroup, MuscleLoad>; days: number; cardioSessions: number }) {
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const trained = MAPPED.filter((g) => (load.get(g)?.sets ?? 0) > 0);
  const untrained = MAPPED.filter((g) => !trained.includes(g));
  const summary = trained.length
    ? `${t('Trent', 'Trained')}: ${trained.map((g) => MUSCLE_LABEL[g].toLowerCase()).join(', ')}. ${
        untrained.length ? `${t('Ikke trent', 'Not trained')}: ${untrained.map((g) => MUSCLE_LABEL[g].toLowerCase()).join(', ')}.` : ''
      }`
    : t('Ingen muskelgrupper trent i perioden.', 'No muscle groups trained in this period.');
  const sel = selected ? load.get(selected) : undefined;
  const toggle = (g: MuscleGroup) => setSelected((s) => (s === g ? null : g));

  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="img" aria-label={summary}>
        <Figure view="front" load={load} days={days} selected={selected} onSelect={toggle} title={t('Forfra', 'Front')} />
        <Figure view="back" load={load} days={days} selected={selected} onSelect={toggle} title={t('Bakfra', 'Back')} />
      </div>

      {/* Samme valg som knapper, så kartet kan brukes med tastatur og skjermleser. */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {MAPPED.map((g) => {
          const level = loadLevel(load.get(g)?.sets ?? 0, days);
          return (
            <button
              key={g}
              type="button"
              aria-pressed={selected === g}
              onClick={() => toggle(g)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
                selected === g ? 'border-ink text-ink' : level ? 'border-accent/40 text-accent-strong' : 'border-line text-faint'
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: level ? FILL[level] : 'var(--color-line)' }} />
              {MUSCLE_LABEL[g]}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="mt-3 animate-fade rounded-xl bg-raised px-4 py-3 text-sm" role="status">
          <span className="font-semibold">{MUSCLE_LABEL[selected]}</span>
          {' · '}
          {sel && sel.sets > 0 ? (
            <>
              <span className="font-num">{num(sel.sets, 1)}</span> {t('sets', 'sets')} {t(`siste ${days} dager`, `last ${days} days`)}
              {sel.last ? ` · ${t('sist trent', 'last trained')} ${dateLong(sel.last)}` : ''}
            </>
          ) : (
            t(`ikke trent siste ${days} dager`, `not trained in the last ${days} days`)
          )}
        </p>
      )}

      <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-faint" aria-hidden="true">
        {[
          [1, '1–3'],
          [2, '4–8'],
          [3, '9–15'],
          [4, '16+'],
        ].map(([lvl, label]) => (
          <span key={lvl} className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm" style={{ background: FILL[lvl as number] }} />
            {label}
          </span>
        ))}
        <span>{t('sets/uke', 'sets/week')}</span>
      </div>

      {cardioSessions > 0 && (
        <p className="mt-2 text-center text-xs text-muted">
          + {cardioSessions} {cardioSessions === 1 ? t('kondisjonsøkt', 'cardio session') : t('kondisjonsøkter', 'cardio sessions')}
        </p>
      )}
    </div>
  );
}

/** Blander to hex-farger: `p` prosent av `a` inn i `b`. */
function mixHex(a: string, b: string, p: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) * (p / 100) + ch(b, i) * (1 - p / 100)).toString(16).padStart(2, '0')).join('')}`;
}

/** Bredde/høyde-forholdet for StaticBody (brukes av delekortene). */
export const STATIC_BODY_RATIO = (VIEW.h + 4) / (VIEW.w * 2 + 16);

/**
 * Begge figurene i én SVG med faste farger, for delekort (tegnes på canvas via et bilde).
 * `levelOf` gir 0–4 per muskelgruppe.
 */
export function StaticBody({ levelOf, accent }: { levelOf: (g: MuscleGroup) => number; accent: string }) {
  const fill = (g: MuscleGroup) => {
    const level = Math.max(0, Math.min(4, levelOf(g)));
    return level ? mixHex(accent, SKIN.muscle, MIX[level]) : SKIN.muscle;
  };
  const w = VIEW.w * 2 + 16;
  const h = VIEW.h + 4;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`-2 -2 ${w} ${h}`} width={w * 5} height={h * 5}>
      <BodySvg view="front" fillOf={fill} />
      <g transform={`translate(${VIEW.w + 12} 0)`}>
        <BodySvg view="back" fillOf={fill} />
      </g>
    </svg>
  );
}
