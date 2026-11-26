import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import type { Sex, WorkoutSet } from '../db/types';
import { useUser } from '../auth/AuthProvider';
import { exerciseName } from './exerciseName';
import { num, toDisplay } from './format';
import { getSetting } from './settings';
import { t } from '../i18n';
import { fallbackBodyweight, isImplausible, levelEventFor, strengthProfile, type LevelEvent, type StrengthProfile } from './strength';

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
export async function levelEventForSet(userId: string, setId: string): Promise<{ event: LevelEvent; bw: number } | null> {
  const set = (await db.sets.get(setId)) as WorkoutSet | undefined;
  if (!set || set.deleted || !set.completed_at) return null;
  const ctx = await context(userId);
  const event = levelEventFor(set, await workSets(), ctx.bw, ctx.sex);
  return event ? { event, bw: ctx.bw } : null;
}

/** Viser rekordkortet eller «Nivå opp» hvis settet ga ny beste 1RM på et rangert løft. */
export async function celebrateSet(
  userId: string,
  setId: string,
  show: (ev: LevelEvent, label: string, bw: number) => void,
  warn?: (message: string) => void,
) {
  const set = (await db.sets.get(setId)) as WorkoutSet | undefined;
  if (set && warn) {
    const ctx = await context(userId);
    if (isImplausible(set, ctx.bw, ctx.sex)) {
      const unit = await getSetting('unit');
      const shown = `${num(toDisplay(set.weight, unit), 1)} ${unit}`;
      warn(
        t(
          `Stemmer ${shown}? Settet teller ikke i styrkenivået før du retter det.`,
          `Is ${shown} right? The set does not count towards your strength level until you fix it.`,
        ),
      );
      return;
    }
  }
  const res = await levelEventForSet(userId, setId);
  if (!res) return;
  const ex = await db.exercises.get(res.event.exerciseId);
  show(res.event, exerciseName(ex), res.bw);
}
