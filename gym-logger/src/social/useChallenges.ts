import { useCallback, useEffect, useState } from 'react';
import { social } from './index';
import { errorText } from './store';
import { rememberPerson, useGraph } from './graph';
import type { Challenge, ChallengeMember, Person } from './types';

/** Utfordringene dine (og deltakernes navn), med oppdatering etter hver handling. */
export function useChallenges() {
  const g = useGraph();
  const [data, setData] = useState<{ challenges: Challenge[]; members: ChallengeMember[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<Map<string, Person>>(new Map());

  const load = useCallback(async () => {
    const b = social();
    if (!b) return;
    try {
      const d = await b.challenges();
      const ids = [...new Set(d.members.map((m) => m.user_id))];
      const found = await b.people(ids);
      for (const p of found) rememberPerson(p);
      setExtra(new Map(found.map((p) => [p.user_id, p])));
      setData(d);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const person = (id: string): Person | undefined => extra.get(id) ?? g.people.get(id);
  return { data, error, reload: load, person, me: g.me };
}
