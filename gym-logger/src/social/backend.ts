import type {
  Activity,
  Board,
  BoardScope,
  Challenge,
  ChallengeMember,
  Emoji,
  Follow,
  FollowStatus,
  LeaderboardRow,
  NewChallenge,
  Person,
  Reaction,
  SocialNotification,
  SocialProfile,
  SocialProfileInput,
  Standing,
} from './types';

/**
 * Alt appen gjør i Sosialt, bak ett grensesnitt (som innloggingen i src/auth):
 * - supabase.ts: den ekte, mot tabellene og funksjonene i 012_social.sql
 * - fake.ts: samme regler, lagret på enheten (til tester og utvikling uten Supabase)
 * Sikkerheten ligger i databasen; appen bare spør.
 */
export interface SocialBackend {
  kind: 'supabase' | 'fake';
  /** Innlogget bruker, eller null. */
  userId(): Promise<string | null>;

  // Profil
  myProfile(): Promise<SocialProfile | null>;
  /** Lager eller oppdaterer din sosiale profil. */
  saveProfile(input: SocialProfileInput): Promise<SocialProfile>;
  handleAvailable(handle: string): Promise<boolean>;
  /** Kontotypen. På Supabase styres den av profiles.social (synk); den falske setter den direkte. */
  setActive(active: boolean): Promise<void>;
  /** Profilene du kan se (følger, åpne, ledertavle). */
  profiles(ids: string[]): Promise<SocialProfile[]>;

  // Personer
  findByHandle(handle: string): Promise<Person | null>;
  discover(query?: string): Promise<Person[]>;
  people(ids: string[]): Promise<Person[]>;

  // Følging
  follows(): Promise<Follow[]>;
  follow(userId: string): Promise<FollowStatus>;
  unfollow(userId: string): Promise<void>;
  acceptFollower(userId: string): Promise<void>;
  removeFollower(userId: string): Promise<void>;
  followersNotFollowedBack(): Promise<Person[]>;
  removeFollowers(ids: string[]): Promise<number>;

  // Blokkering og rapportering
  blocked(): Promise<string[]>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  report(target: string, reason: string, activityId?: string): Promise<void>;

  // Aktivitet
  publish(activity: Omit<Activity, 'user_id' | 'created_at' | 'updated_at'>): Promise<void>;
  unpublish(id: string): Promise<void>;
  /** Økter du kan se (også dine egne), nyeste først. `before`: started_at for neste side. */
  feed(opts?: { before?: string; limit?: number; userId?: string }): Promise<Activity[]>;
  reactions(keys: { owner: string; id: string }[]): Promise<Reaction[]>;
  /** null fjerner reaksjonen din. */
  react(owner: string, activityId: string, emoji: Emoji | null): Promise<void>;

  // Varsler
  notifications(): Promise<SocialNotification[]>;
  markRead(ids?: string[]): Promise<void>;

  // Ledertavler
  leaderboard(board: Board, scope?: BoardScope, exercise?: string, since?: string): Promise<LeaderboardRow[]>;

  // Utfordringer
  challenges(): Promise<{ challenges: Challenge[]; members: ChallengeMember[] }>;
  createChallenge(c: NewChallenge): Promise<string>;
  respondChallenge(id: string, accept: boolean): Promise<void>;
  leaveChallenge(id: string): Promise<void>;
  standings(id: string): Promise<Standing[]>;
}
