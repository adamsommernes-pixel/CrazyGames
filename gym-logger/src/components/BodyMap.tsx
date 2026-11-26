import { useState, type ReactNode } from 'react';
import type { MuscleGroup } from '../db/types';
import { MUSCLE_LABEL } from '../db/types';
import { loadLevel, type MuscleLoad } from '../lib/stats';
import { t } from '../i18n';
import { dateLong, num } from '../lib/format';

// Stilisert kropp forfra og bakfra. Hver region tilhører én muskelgruppe og fylles med grønt
// etter hvor mye gruppen er trent. Bevisst geometrisk, ikke anatomisk tegning.

type Region = { group: MuscleGroup; shape: ReactNode };

const FILL = [
  'var(--color-raised)',
  'rgb(43 214 107 / 0.32)',
  'rgb(43 214 107 / 0.5)',
  'rgb(43 214 107 / 0.75)',
  'var(--color-green)',
];

/** Speilet par: venstre og høyre side av kroppen. */
const pair = (make: (side: 1 | -1) => ReactNode) => (
  <>
    {make(1)}
    {make(-1)}
  </>
);
const mx = (x: number, side: 1 | -1) => (side === 1 ? x : 120 - x);

const FRONT: Region[] = [
  { group: 'Skuldre', shape: pair((s) => <ellipse key={s} cx={mx(36, s)} cy={52} rx={10} ry={9} />) },
  { group: 'Bryst', shape: pair((s) => <rect key={s} x={s === 1 ? 46 : 61} y={45} width={13} height={21} rx={6} />) },
  { group: 'Biceps', shape: pair((s) => <ellipse key={s} cx={mx(30, s)} cy={75} rx={6.5} ry={13} />) },
  { group: 'Underarmer', shape: pair((s) => <ellipse key={s} cx={mx(25, s)} cy={103} rx={5.5} ry={14} transform={`rotate(${s * 8} ${mx(25, s)} 103)`} />) },
  {
    group: 'Mage',
    shape: (
      <>
        <rect x={49} y={68} width={22} height={40} rx={7} />
        <path d="M51 80h18M51 91h18M60 70v36" stroke="var(--color-bg)" strokeOpacity={0.55} strokeWidth={1} fill="none" />
      </>
    ),
  },
  { group: 'Bein', shape: pair((s) => <rect key={s} x={s === 1 ? 44 : 61} y={123} width={15} height={48} rx={7} />) },
  { group: 'Bein', shape: pair((s) => <rect key={`c${s}`} x={s === 1 ? 46 : 63} y={181} width={11} height={40} rx={5} />) },
];

const BACK: Region[] = [
  { group: 'Rygg', shape: <path d="M60 37 L77 47 L60 61 L43 47 Z" strokeLinejoin="round" /> },
  { group: 'Skuldre', shape: pair((s) => <ellipse key={s} cx={mx(36, s)} cy={52} rx={10} ry={9} />) },
  { group: 'Rygg', shape: pair((s) => <path key={s} d={s === 1 ? 'M46 56 L58 63 L58 88 L49 84 L45 66 Z' : 'M74 56 L62 63 L62 88 L71 84 L75 66 Z'} strokeLinejoin="round" />) },
  { group: 'Rygg', shape: <rect x={50} y={90} width={20} height={18} rx={5} /> },
  { group: 'Triceps', shape: pair((s) => <ellipse key={s} cx={mx(30, s)} cy={75} rx={6.5} ry={13} />) },
  { group: 'Underarmer', shape: pair((s) => <ellipse key={s} cx={mx(25, s)} cy={103} rx={5.5} ry={14} transform={`rotate(${s * 8} ${mx(25, s)} 103)`} />) },
  { group: 'Rumpe', shape: pair((s) => <ellipse key={s} cx={mx(52, s)} cy={118} rx={9} ry={9.5} />) },
  { group: 'Bein', shape: pair((s) => <rect key={s} x={s === 1 ? 44 : 61} y={130} width={15} height={41} rx={7} />) },
  { group: 'Bein', shape: pair((s) => <ellipse key={`c${s}`} cx={mx(51, s)} cy={198} rx={6.5} ry={17} />) },
];

/** Hode, nakke, hender, hofte, knær og føtter: deler uten egen muskelgruppe. */
function Base({ back }: { back?: boolean }) {
  return (
    <g fill="var(--color-surface)" stroke="var(--color-line)" strokeWidth={1}>
      <circle cx={60} cy={20} r={13} />
      <rect x={55} y={31} width={10} height={8} rx={3} />
      {!back && <path d="M47 108 H73 L71 122 H49 Z" strokeLinejoin="round" />}
      {pair((s) => <circle key={`h${s}`} cx={mx(22, s)} cy={121} r={5} />)}
      {pair((s) => <circle key={`k${s}`} cx={mx(52, s)} cy={176} r={4} />)}
      {pair((s) => <ellipse key={`f${s}`} cx={mx(51, s)} cy={226} rx={7} ry={4} />)}
    </g>
  );
}

function Figure({
  regions,
  back,
  load,
  days,
  selected,
  onSelect,
  title,
}: {
  regions: Region[];
  back?: boolean;
  load: Map<MuscleGroup, MuscleLoad>;
  days: number;
  selected: MuscleGroup | null;
  onSelect: (g: MuscleGroup) => void;
  title: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 120 234" className="h-auto w-full max-w-[150px]" aria-hidden="true">
        <Base back={back} />
        {regions.map((r, i) => {
          const level = loadLevel(load.get(r.group)?.sets ?? 0, days);
          const isSel = selected === r.group;
          return (
            <g
              key={i}
              fill={FILL[level]}
              stroke={isSel ? 'var(--color-ink)' : level ? 'rgb(43 214 107 / 0.55)' : 'var(--color-line)'}
              strokeWidth={isSel ? 2 : 1}
              style={{
                cursor: 'pointer',
                filter: level === 4 ? 'drop-shadow(0 0 4px rgb(43 214 107 / 0.6))' : undefined,
                transition: 'fill 400ms ease',
              }}
              onClick={() => onSelect(r.group)}
            >
              {r.shape}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[11px] font-semibold tracking-wide text-faint uppercase">{title}</figcaption>
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
        <Figure regions={FRONT} load={load} days={days} selected={selected} onSelect={toggle} title={t('Forfra', 'Front')} />
        <Figure regions={BACK} back load={load} days={days} selected={selected} onSelect={toggle} title={t('Bakfra', 'Back')} />
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
                selected === g ? 'border-ink text-ink' : level ? 'border-green/40 text-green-light' : 'border-line text-faint'
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: level ? FILL[level] : 'var(--color-line)' }} />
              {MUSCLE_LABEL[g]}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className="mt-3 animate-fade rounded-2xl bg-raised px-4 py-3 text-sm" role="status">
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

const STATIC = {
  raised: '#1b211e',
  surface: '#121614',
  line: '#2a322e',
  green: '#2bd66b',
};
const STATIC_FILL = [STATIC.raised, 'rgb(43 214 107 / 0.32)', 'rgb(43 214 107 / 0.5)', 'rgb(43 214 107 / 0.75)', STATIC.green];

/**
 * Begge figurene i én SVG med faste farger, for delekort (tegnes på canvas via et bilde).
 * `levelOf` gir 0–4 per muskelgruppe.
 */
export function StaticBody({ levelOf }: { levelOf: (g: MuscleGroup) => number }) {
  const figure = (regions: Region[], back: boolean, x: number) => (
    <g transform={`translate(${x} 0)`}>
      <g fill={STATIC.surface} stroke={STATIC.line} strokeWidth={1}>
        <circle cx={60} cy={20} r={13} />
        <rect x={55} y={31} width={10} height={8} rx={3} />
        {!back && <path d="M47 108 H73 L71 122 H49 Z" strokeLinejoin="round" />}
        {pair((s) => <circle key={`h${s}`} cx={mx(22, s)} cy={121} r={5} />)}
        {pair((s) => <circle key={`k${s}`} cx={mx(52, s)} cy={176} r={4} />)}
        {pair((s) => <ellipse key={`f${s}`} cx={mx(51, s)} cy={226} rx={7} ry={4} />)}
      </g>
      {regions.map((r, i) => {
        const level = Math.max(0, Math.min(4, levelOf(r.group)));
        return (
          <g key={i} fill={STATIC_FILL[level]} stroke={level ? 'rgb(43 214 107 / 0.7)' : STATIC.line} strokeWidth={1}>
            {r.shape}
          </g>
        );
      })}
    </g>
  );
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 234" width={1000} height={936}>
      {figure(FRONT, false, 0)}
      {figure(BACK, true, 130)}
    </svg>
  );
}
