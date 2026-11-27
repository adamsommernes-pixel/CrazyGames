import { useState } from 'react';
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../../db/types';
import { deleteExercise, restore, updateExercise } from '../../db/repo';
import { Button, Sheet } from '../../components/ui';
import { undoToast } from '../../components/toast';
import { ExerciseFields } from '../workout/ExercisePicker';
import { t } from '../../i18n';

/** Rediger eller slett en egen øvelse. Sletting skjuler den; historikken beholdes. */
export function EditExerciseSheet({ exercise, onClose, onDeleted }: { exercise: Exercise; onClose: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [group, setGroup] = useState<MuscleGroup>(exercise.muscle_group);
  const [equipment, setEquipment] = useState<Equipment>(exercise.equipment);
  const [kind, setKind] = useState<ExerciseKind>(exercise.kind ?? 'weight');
  return (
    <Sheet open onClose={onClose} title={t('Rediger øvelse', 'Edit exercise')} tall>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await updateExercise(exercise.id, { name, muscle_group: group, equipment, kind });
          onClose();
        }}
      >
        <ExerciseFields name={name} setName={setName} group={group} setGroup={setGroup} equipment={equipment} setEquipment={setEquipment} kind={kind} setKind={setKind} />
        {kind !== (exercise.kind ?? 'weight') && (
          <p className="rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">{t('Tidligere sets beholder tallene sine, men vises med den nye typen.', 'Earlier sets keep their numbers but are shown with the new type.')}</p>
        )}
        <button type="submit" className="min-h-12 rounded-2xl bg-accent font-semibold text-on-accent">
          {t('Lagre endringer', 'Save changes')}
        </button>
        <Button
          variant="danger"
          icon="trash"
          full
          onClick={async () => {
            const removed = await deleteExercise(exercise.id);
            onClose();
            onDeleted();
            undoToast(t(`${exercise.name} er slettet`, `${exercise.name} deleted`), () => restore(removed));
          }}
        >
          {t('Slett øvelse', 'Delete exercise')}
        </Button>
        <p className="text-center text-xs text-faint">{t('Sletting skjuler øvelsen fra listene. Øktene der du har brukt den beholdes.', 'Deleting hides the exercise from the lists. Workouts where you used it are kept.')}</p>
      </form>
    </Sheet>
  );
}
