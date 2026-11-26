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
    if (saved !== undefined) setText(saved);
  }, [saved]);
  return (
    <section>
      <SectionTitle>{t('Mine notater', 'My notes')}</SectionTitle>
      <textarea
        id={`exnote-${exerciseId}`}
        aria-label={t('Notater for øvelsen', 'Notes for the exercise')}
        className={`${inputClass} min-h-24 py-3`}
        placeholder={t('F.eks. setehøyde 4, albuer inn, pust ut på vei opp', 'E.g. seat height 4, elbows in, breathe out on the way up')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== saved && void db.kv.put({ key, value: text })}
      />
    </section>
  );
}
