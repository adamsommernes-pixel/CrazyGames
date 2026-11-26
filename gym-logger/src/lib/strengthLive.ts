import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import type { Sex, WorkoutSet } from '../db/types';
import { useUser } from '../auth/AuthProvider';
import { fallbackBodyweight, levelEventFor, strengthProfile, type LevelEvent, type StrengthProfile } from './strength';

export interface StrengthContext {
  bw: number;
  /** False når kroppsvekten er en standardverdi (ingen logget eller i profilen). */
  bwKnown: boolean;
  sex: Sex | null;
}

async function context(userId: string): Promise<StrengthContext> {
  const profile = await db.profiles.get(userId);
  const sex = profile && !profile.deleted ? (profile.sex ?? null) : null;
  const latest = (await db.bodyweights.toArray())
    .filter((b) => !b.deleted)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const known = latest?.weight_kg || profile?.bodyweight_kg || 0;
  return { bw: known || fallbackBodyweight(sex), bwKnown: known > 0, sex };
}

const workSets = async () => (await db.sets.toArray()).filter((s) => !s.deleted && s.completed_at);

export function useStrength(): (StrengthContext & { profile: StrengthProfile }) | undefined {
  const user = useUser();
  return useLiveQuery(async () => {
    const ctx = await context(user.id);
    return { ...ctx, profile: strengthProfile(await workSets(), ctx.bw, ctx.sex) };
  }, [user.id]);
}

/** Ser om et nettopp fullført set ga ny beste 1RM på en rangert øvelse. */
export async function levelEventForSet(userId: string, setId: string): Promise<LevelEvent | null> {
  const set = (await db.sets.get(setId)) as WorkoutSet | undefined;
  if (!set || set.deleted || !set.completed_at) return null;
  const ctx = await context(userId);
  return levelEventFor(set, await workSets(), ctx.bw, ctx.sex);
}
