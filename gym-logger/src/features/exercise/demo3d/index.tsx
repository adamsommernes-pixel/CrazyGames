import { lazy, Suspense } from 'react';
import type { Exercise } from '../../../db/types';
import { NB_NAMED } from '../../../db/library';
import { t } from '../../../i18n';

// three.js lastes først når en demo vises, så resten av appen ikke blir tyngre.
const ExerciseDemo3D = lazy(() => import('./ExerciseDemo3D'));

/** De 12 store løftene har 3D-demo (samme liste som beholder norsk navn; testene sjekker at de stemmer). */
export const hasDemo = (ex: Pick<Exercise, 'id' | 'custom'>) => !ex.custom && NB_NAMED.has(ex.id.replace(/^ex-/, ''));

export function ExerciseDemo({ exercise }: { exercise: Exercise }) {
  if (!hasDemo(exercise)) return null;
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
