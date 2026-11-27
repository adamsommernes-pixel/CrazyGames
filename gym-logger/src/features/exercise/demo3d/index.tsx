import { lazy, Suspense, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { exerciseName } from '../../../lib/exerciseName';
import type { Exercise } from '../../../db/types';
import { NB_NAMED } from '../../../db/library';
import { t } from '../../../i18n';

// three.js lastes først når en demo vises, så resten av appen ikke blir tyngre.
const ExerciseDemo3D = lazy(() => import('./ExerciseDemo3D'));

/** Lite «3D»-merke for øvelser med demo (velgeren, fanen og knappen i økta). */
export function Demo3DBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border border-accent/40 bg-accent-soft px-1.5 text-[10px] leading-4 font-bold text-accent-strong ${className}`} aria-hidden="true">
      3D
    </span>
  );
}

/** De 12 store løftene har 3D-demo (samme liste som beholder norsk navn; testene sjekker at de stemmer). */
export const hasDemo = (ex: Pick<Exercise, 'id' | 'custom'>) => !ex.custom && NB_NAMED.has(ex.id.replace(/^ex-/, ''));

/**
 * 3D-demo for de store løftene. Viser først et stillbilde med ▶; three.js lastes og starter først
 * når brukeren trykker, så siden er like rask som før for dem som bare vil lese.
 */
export function ExerciseDemo({ exercise, autoStart = false }: { exercise: Exercise; autoStart?: boolean }) {
  const [started, setStarted] = useState(autoStart);
  if (!hasDemo(exercise)) return null;
  const slug = exercise.id.replace(/^ex-/, '');
  const name = exerciseName(exercise);
  if (!started) {
    return (
      <button
        type="button"
        onClick={() => setStarted(true)}
        className="relative block aspect-square w-full overflow-hidden rounded-xl border border-line bg-raised"
        aria-label={t(`Vis 3D-demo av ${name}`, `Show 3D demo of ${name}`)}
        data-demo-poster={slug}
      >
        <img src={`${import.meta.env.BASE_URL}demos/${slug}.jpg`} alt="" className="h-full w-full object-contain" loading="lazy" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-bg/80 px-4 py-2.5 text-sm font-semibold">
            <Icon name="play" size={18} filled />
            {t('Se 3D-demo', 'Watch 3D demo')}
          </span>
        </span>
      </button>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="grid aspect-square w-full place-items-center rounded-xl border border-line bg-raised text-sm text-faint">
          {t('Laster 3D …', 'Loading 3D …')}
        </div>
      }
    >
      <ExerciseDemo3D exercise={exercise} />
    </Suspense>
  );
}
