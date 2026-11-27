import type { Exercise } from '../../db/types';
import { EQUIPMENT_LABEL, KIND_LABEL, LEVEL_LABEL } from '../../db/types';
import { guideFor } from '../../db/exercises';
import { MuscleTag } from '../../components/MuscleTag';
import { Icon, type IconName } from '../../components/Icon';
import { t } from '../../i18n';
import { ExerciseDemo } from './demo3d';
import { perHand, perHandHint } from '../../lib/perHand';

/** Muskelgrupper, utstyr, nivå og type for en øvelse. */
export function ExerciseMeta({ exercise }: { exercise: Exercise }) {
  const guide = guideFor(exercise.id);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <MuscleTag group={exercise.muscle_group} />
      {guide?.secondary.map((m) => <MuscleTag key={m} group={m} secondary />)}
      <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">{EQUIPMENT_LABEL[exercise.equipment]}</span>
      {guide && <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">{LEVEL_LABEL[guide.level]}</span>}
      {exercise.kind && exercise.kind !== 'weight' && (
        <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">{KIND_LABEL[exercise.kind]}</span>
      )}
    </div>
  );
}

function Block({ icon, title, tone, items, ordered }: { icon: IconName; title: string; tone: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${tone}`}>
        <Icon name={icon} size={16} />
        {title}
      </h3>
      <ol className="flex flex-col gap-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-3">
            {ordered ? (
              <span className="font-num grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-strong">{i + 1}</span>
            ) : (
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden="true" />
            )}
            <span className="leading-relaxed">{t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** «Slik gjør du»: steg for steg, tips og vanlige feil. Egne øvelser har ingen fremgangsmåte. */
export function ExerciseGuide({ exercise, autoStartDemo = false }: { exercise: Exercise; autoStartDemo?: boolean }) {
  const guide = guideFor(exercise.id);
  if (!guide) {
    return (
      <p className="rounded-xl border border-line bg-raised p-4 text-sm text-muted">
        {t('Dette er en egen øvelse, så den har ingen innebygd fremgangsmåte. Skriv dine egne stikkord under «Mine notater».', 'This is a custom exercise, so it has no built-in guide. Write your own notes under “My notes”.')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <ExerciseDemo exercise={exercise} autoStart={autoStartDemo} />
      <PerHandNote exercise={exercise} />
      <Block icon="book" title={t('Slik gjør du', 'How to')} tone="text-accent" items={guide.steps} ordered />
      <Block icon="sparkle" title={t('Tips', 'Tips')} tone="text-sky-300" items={guide.tips} />
      <Block icon="x" title={t('Vanlige feil', 'Common mistakes')} tone="text-warn" items={guide.mistakes} />
    </div>
  );
}

/** «Slik logger du vekten» for manual- og kettlebelløvelser. */
export function PerHandNote({ exercise }: { exercise: Exercise }) {
  const hand = perHand(exercise);
  if (!hand) return null;
  return (
    <div className="flex gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 px-3.5 py-3 text-sm" data-per-hand-note>
      <Icon name="info" size={18} className="mt-0.5 shrink-0 text-accent" />
      <div>
        <div className="font-semibold">{t('Slik logger du vekten', 'How to log the weight')}</div>
        <p className="mt-0.5 text-muted">
          {perHandHint(hand)}{' '}
          {t(
            'Bruker du to manualer på 20 kg, skriver du 20. Rekordene og fremgangen din regnes ut fra dette, så de blir feil hvis du skriver 40.',
            'If you use two 20 kg dumbbells, enter 20. Your records and progress are calculated from this, so entering 40 makes them wrong.',
          )}
        </p>
      </div>
    </div>
  );
}
