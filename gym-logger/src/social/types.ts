// Typer for Sosialt. Feltnavnene følger tabellene i supabase/migrations/012_social.sql.

/** 1 Privat · 2 Ledertavler · 3 Åpen. */
export type Visibility = 1 | 2 | 3;

export interface SocialProfile {
  user_id: string;
  handle: string;
  display_name: string;
  color: string;
  visibility: Visibility;
  is_16_plus: boolean;
  /** false = treningskonto: skjult for andre. Styres av kontotypen, ikke direkte. */
  active: boolean;
  tier_index: number | null;
  score: number | null;
  lift_scores: Record<string, number>;
  created_at: string;
  updated_at: string;
}

/** Det appen selv kan endre på profilen. */
export type SocialProfileInput = Pick<SocialProfile, 'handle' | 'display_name' | 'color' | 'visibility' | 'is_16_plus'> &
  Partial<Pick<SocialProfile, 'tier_index' | 'score' | 'lift_scores'>>;

/** Minste info om en annen bruker (fra people / find_by_handle / discover). */
export interface Person {
  user_id: string;
  handle: string;
  display_name: string;
  color: string;
  visibility?: Visibility;
  tier_index?: number | null;
  /** Bare fra Oppdag: om du allerede følger (eller har spurt). */
  following?: boolean;
}

export type FollowStatus = 'pending' | 'accepted';
export interface Follow {
  follower: string;
  followee: string;
  status: FollowStatus;
  created_at: string;
  accepted_at: string | null;
}

/** Ett set slik det vises i feeden. Vekt i kg; reps er sekunder (tid) eller minutter (kondisjon). */
export interface ActivitySet {
  weight: number;
  reps: number;
  distance_km?: number | null;
  set_type: 'normal' | 'warmup' | 'drop' | 'failure';
  pr?: boolean;
}

export interface ActivityExercise {
  exercise_id: string;
  /** Navnet slik eieren så det (egne øvelser har ikke oversettelse). */
  name: string;
  kind: 'weight' | 'bodyweight' | 'time' | 'cardio';
  muscle_group: string;
  sets: ActivitySet[];
}

/** Innholdet i en publisert økt (activities.data). Aldri kroppsvekt. */
export interface ActivityData {
  version: 1;
  duration_s: number;
  sets: number;
  reps: number;
  volume_kg: number;
  exercises: ActivityExercise[];
  records: { exercise_id: string; name: string; kinds: string[] }[];
  /** Arbeidssett per muskelgruppe (sekundære teller halvt). */
  muscles: Record<string, number>;
  /** Beste beregnede 1RM per løft som teller i styrkenivået (til løftutfordringer). */
  lifts: Record<string, number>;
  /** Styrkenivået etter økta. */
  tier: { index: number; score: number } | null;
  notes?: string;
}

export interface Activity {
  user_id: string;
  id: string;
  name: string;
  started_at: string;
  ended_at: string;
  data: ActivityData;
  created_at: string;
  updated_at: string;
}

export const EMOJIS = ['💪', '🔥', '👏', '🏆'] as const;
export type Emoji = (typeof EMOJIS)[number];
export interface Reaction {
  activity_owner: string;
  activity_id: string;
  user_id: string;
  emoji: Emoji;
  created_at: string;
}

export type NotificationKind = 'follow_request' | 'follow_accepted' | 'new_follower' | 'reaction' | 'challenge_invite' | 'challenge_joined';
export interface SocialNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  actor: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export type Board = 'level' | 'lift' | 'workouts';
export type BoardScope = 'all' | 'following';
export interface LeaderboardRow {
  rank: number;
  user_id: string;
  handle: string;
  display_name: string;
  color: string;
  tier_index: number | null;
  value: number;
}

export type ChallengeKind = 'workouts' | 'volume' | 'weekly' | 'lift';
export interface Challenge {
  id: string;
  creator: string;
  kind: ChallengeKind;
  exercise_id: string | null;
  target: number | null;
  title: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}
export type MemberStatus = 'invited' | 'joined' | 'declined';
export interface ChallengeMember {
  challenge_id: string;
  user_id: string;
  status: MemberStatus;
  invited_at: string;
  joined_at: string | null;
}
export interface Standing {
  rank: number;
  user_id: string;
  value: number;
}

export interface NewChallenge {
  kind: ChallengeKind;
  title: string;
  starts_at: string;
  ends_at: string;
  invitees: string[];
  exercise_id?: string | null;
  target?: number | null;
}

/** Feil med en melding som kan vises direkte. */
export class SocialError extends Error {}
