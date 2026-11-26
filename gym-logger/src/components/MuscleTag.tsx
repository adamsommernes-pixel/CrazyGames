import { MUSCLE_LABEL, type MuscleGroup } from '../db/types';
import { MUSCLE_COLOR } from '../lib/muscles';

export function MuscleDot({ group, size = 8 }: { group: MuscleGroup; size?: number }) {
  return <span aria-hidden="true" className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: MUSCLE_COLOR[group] }} />;
}

/** Lite merke med muskelgruppens farge. `secondary` gir en dempet variant. */
export function MuscleTag({ group, secondary }: { group: MuscleGroup; secondary?: boolean }) {
  const c = MUSCLE_COLOR[group];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        borderColor: secondary ? 'var(--color-line)' : `${c}55`,
        background: secondary ? 'transparent' : `${c}1a`,
        color: secondary ? 'var(--color-muted)' : c,
      }}
    >
      <MuscleDot group={group} size={6} />
      {MUSCLE_LABEL[group]}
    </span>
  );
}
