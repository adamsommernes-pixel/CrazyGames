import { useState } from 'react';
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../../db/types';
import { deleteExercise, restore, updateExercise } from '../../db/repo';
import { Button, Sheet } from '../../components/ui';
import { undoToast } from '../../components/toast';
import { ExerciseFields } from '../workout/ExercisePicker';

/** Rediger eller slett en egen øvelse. Sletting skjuler den; historikken beholdes. */
export function EditExerciseSheet({ exercise, onClose, onDeleted }: { exercise: Exercise; onClose: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [group, setGroup] = useState<MuscleGroup>(exercise.muscle_group);
  const [equipment, setEquipment] = useState<Equipment>(exercise.equipment);
  const [kind, setKind] = useState<ExerciseKind>(exercise.kind ?? 'weight');
  return (
    <Sheet open onClose={onClose} title="Rediger øvelse" tall>
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
          <p className="rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">Tidligere sets beholder tallene sine, men vises med den nye typen.</p>
        )}
        <button type="submit" className="min-h-12 rounded-2xl bg-green font-semibold text-black">
          Lagre endringer
        </button>
        <Button
          variant="danger"
          icon="trash"
          full
          onClick={async () => {
            const removed = await deleteExercise(exercise.id);
            onClose();
            onDeleted();
            undoToast(`${exercise.name} er slettet`, () => restore(removed));
          }}
        >
          Slett øvelse
        </Button>
        <p className="text-center text-xs text-faint">Sletting skjuler øvelsen fra listene. Øktene der du har brukt den beholdes.</p>
      </form>
    </Sheet>
  );
}
