import { useAutosave } from '../../lib/autosave';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { SectionTitle, inputClass } from '../../components/ui';
import { t } from '../../i18n';

/** Egne faste notater for en øvelse (innstillinger på maskinen, teknikk-huskeregler). */
export function ExerciseNotes({ exerciseId }: { exerciseId: string }) {
  const key = `exnote:${exerciseId}`;
  const saved = useLiveQuery(async () => ((await db.kv.get(key))?.value as string | undefined) ?? '', [key]);
  const [text, setText] = useState('');
  useEffect(() => {
    // Ikke overskriv det du holder på å skrive når autolagringen kommer tilbake.
    if (saved !== undefined && document.activeElement?.id !== `exnote-${exerciseId}`) setText(saved);
  }, [saved, exerciseId]);
  const autosave = useAutosave(600);
  return (
    <section>
      <SectionTitle>{t('Mine notater', 'My notes')}</SectionTitle>
      <textarea
        id={`exnote-${exerciseId}`}
        aria-label={t('Notater for øvelsen', 'Notes for the exercise')}
        className={`${inputClass} min-h-24 py-3`}
        placeholder={t('F.eks. setehøyde 4, albuer inn, pust ut på vei opp', 'E.g. seat height 4, elbows in, breathe out on the way up')}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          autosave.schedule(() => void db.kv.put({ key, value: v }));
        }}
        onBlur={autosave.flush}
      />
    </section>
  );
}
