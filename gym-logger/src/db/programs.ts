import { t } from '../i18n';
import type { Experience, Goal } from './types';

// Programbiblioteket: splitter for 2–6 økter i uka. [øvelses-id, tilbehør?] — tilbehørsøvelser
// får flere reps og kortere hvile. Alle id-er må finnes i øvelsesbiblioteket (sjekkes i test).

export type Item = [string, boolean];
export interface ProgramDay {
  readonly name: string;
  exercises: Item[];
}
export interface Program {
  id: string;
  readonly name: string;
  readonly description: string;
  /** Antall økter i uka programmet passer for. */
  days: number[];
  level: 'beginner' | 'all' | 'advanced';
  routines: ProgramDay[];
}

const day = (nb: string, en: string, exercises: Item[]): ProgramDay => ({
  get name() {
    return t(nb, en);
  },
  exercises,
});

// Gjenbrukte dager
const FB_A = day('Fullkropp A', 'Full body A', [['ex-kneboy', false], ['ex-benkpress', false], ['ex-stangroing', false], ['ex-sidehev', true], ['ex-planke', true]]);
const FB_B = day('Fullkropp B', 'Full body B', [['ex-markloft', false], ['ex-militaerpress', false], ['ex-nedtrekk', false], ['ex-utfall', true], ['ex-bicepscurl-med-manualer', true]]);
const FB_C = day('Fullkropp C', 'Full body C', [['ex-frontboy', false], ['ex-skrabenk-med-manualer', false], ['ex-pull-ups', false], ['ex-hip-thrust', true], ['ex-triceps-pushdown', true]]);
const UPPER = day('Overkropp', 'Upper body', [['ex-benkpress', false], ['ex-stangroing', false], ['ex-skulderpress-med-manualer', false], ['ex-nedtrekk', false], ['ex-triceps-pushdown', true], ['ex-hammercurl', true]]);
const LOWER = day('Underkropp', 'Lower body', [['ex-kneboy', false], ['ex-rumensk-markloft', false], ['ex-beinpress', false], ['ex-larcurl', true], ['ex-tahev-staende', true]]);
const UPPER_B = day('Overkropp B', 'Upper body B', [['ex-militaerpress', false], ['ex-pull-ups', false], ['ex-skrabenk-med-manualer', false], ['ex-roing-med-manual', false], ['ex-sidehev', true], ['ex-bicepscurl-med-stang', true]]);
const LOWER_B = day('Underkropp B', 'Lower body B', [['ex-markloft', false], ['ex-frontboy', false], ['ex-bulgarsk-splittboy', false], ['ex-beinspark', true], ['ex-tahev-sittende', true]]);
const PUSH = day('Push', 'Push', [['ex-benkpress', false], ['ex-militaerpress', false], ['ex-skrabenk-med-manualer', false], ['ex-sidehev', true], ['ex-triceps-pushdown', true]]);
const PULL = day('Pull', 'Pull', [['ex-markloft', false], ['ex-pull-ups', false], ['ex-sittende-roing', false], ['ex-face-pulls', true], ['ex-bicepscurl-med-stang', true]]);
const LEGS = day('Bein', 'Legs', [['ex-kneboy', false], ['ex-rumensk-markloft', false], ['ex-beinpress', false], ['ex-larcurl', true], ['ex-tahev-staende', true]]);
const PUSH_B = day('Push B', 'Push B', [['ex-skulderpress-med-manualer', false], ['ex-skrabenk', false], ['ex-dips', false], ['ex-kabelflyes', true], ['ex-tau-pushdown', true]]);
const PULL_B = day('Pull B', 'Pull B', [['ex-stangroing', false], ['ex-chin-ups', false], ['ex-nedtrekk', false], ['ex-omvendt-flyes', true], ['ex-hammercurl', true]]);
const LEGS_B = day('Bein B', 'Legs B', [['ex-frontboy', false], ['ex-hip-thrust', false], ['ex-bulgarsk-splittboy', false], ['ex-setelarcurl', true], ['ex-tahev-sittende', true]]);

export const PROGRAMS: Program[] = [
  {
    id: 'fb2',
    get name() { return t('Fullkropp A/B', 'Full body A/B'); },
    get description() { return t('To hele økter som veksler. Perfekt for å komme i gang.', 'Two full sessions that alternate. Perfect for getting started.'); },
    days: [2, 3],
    level: 'beginner',
    routines: [FB_A, FB_B],
  },
  {
    id: 'ul2',
    get name() { return t('Overkropp / Underkropp', 'Upper / Lower'); },
    get description() { return t('Én økt for overkroppen og én for beina.', 'One session for the upper body and one for the legs.'); },
    days: [2],
    level: 'all',
    routines: [UPPER, LOWER],
  },
  {
    id: 'fb3',
    get name() { return t('Fullkropp A/B/C', 'Full body A/B/C'); },
    get description() { return t('Tre ulike helkroppsøkter. Mye variasjon på få dager.', 'Three different full body sessions. Lots of variety in few days.'); },
    days: [3],
    level: 'all',
    routines: [FB_A, FB_B, FB_C],
  },
  {
    id: 'ppl3',
    get name() { return t('Push / Pull / Bein', 'Push / Pull / Legs'); },
    get description() { return t('Den klassiske splitten: press, trekk og bein, én gang i uka hver.', 'The classic split: push, pull and legs, once a week each.'); },
    days: [3],
    level: 'all',
    routines: [PUSH, PULL, LEGS],
  },
  {
    id: 'ulf3',
    get name() { return t('Overkropp / Underkropp / Fullkropp', 'Upper / Lower / Full body'); },
    get description() { return t('Hver muskel to ganger i uka på tre dager.', 'Every muscle twice a week on three days.'); },
    days: [3],
    level: 'all',
    routines: [UPPER, LOWER, FB_A],
  },
  {
    id: 'sl5x5',
    get name() { return t('Styrke 5×5', 'Strength 5×5'); },
    get description() { return t('Få, tunge basisløft. For deg som vil bli sterk.', 'Few, heavy compound lifts. For when you want to get strong.'); },
    days: [3],
    level: 'beginner',
    routines: [
      day('Styrke A', 'Strength A', [['ex-kneboy', false], ['ex-benkpress', false], ['ex-stangroing', false]]),
      day('Styrke B', 'Strength B', [['ex-kneboy', false], ['ex-militaerpress', false], ['ex-markloft', false]]),
    ],
  },
  {
    id: 'ul4',
    get name() { return t('Overkropp / Underkropp ×2', 'Upper / Lower ×2'); },
    get description() { return t('Fire økter med to varianter av hver. Den mest brukte 4-dagerssplitten.', 'Four sessions with two variants of each. The most popular 4-day split.'); },
    days: [4],
    level: 'all',
    routines: [UPPER, LOWER, UPPER_B, LOWER_B],
  },
  {
    id: 'pplu4',
    get name() { return t('Push / Pull / Bein / Overkropp', 'Push / Pull / Legs / Upper'); },
    get description() { return t('PPL med en ekstra overkroppsøkt.', 'PPL with an extra upper body session.'); },
    days: [4],
    level: 'all',
    routines: [PUSH, PULL, LEGS, UPPER_B],
  },
  {
    id: 'arnold4',
    get name() { return t('Bryst og rygg / Skuldre og armer / Bein', 'Chest and back / Shoulders and arms / Legs'); },
    get description() { return t('Overkroppen delt i to, med bein to ganger.', 'The upper body split in two, with legs twice.'); },
    days: [4],
    level: 'advanced',
    routines: [
      day('Bryst og rygg', 'Chest and back', [['ex-benkpress', false], ['ex-stangroing', false], ['ex-skrabenk-med-manualer', false], ['ex-pull-ups', false], ['ex-kabelflyes', true]]),
      day('Skuldre og armer', 'Shoulders and arms', [['ex-militaerpress', false], ['ex-sidehev', true], ['ex-bicepscurl-med-stang', true], ['ex-fransk-press', true], ['ex-hammercurl', true]]),
      LEGS,
      LEGS_B,
    ],
  },
  {
    id: 'pplul5',
    get name() { return t('PPL + Overkropp / Underkropp', 'PPL + Upper / Lower'); },
    get description() { return t('Fem dager som treffer hver muskel nesten to ganger i uka.', 'Five days that hit each muscle almost twice a week.'); },
    days: [5],
    level: 'all',
    routines: [PUSH, PULL, LEGS, UPPER_B, LOWER_B],
  },
  {
    id: 'bro5',
    get name() { return t('Bro split', 'Bro split'); },
    get description() { return t('Én muskelgruppe per dag: bryst, rygg, bein, skuldre og armer.', 'One muscle group per day: chest, back, legs, shoulders and arms.'); },
    days: [5],
    level: 'advanced',
    routines: [
      day('Bryst', 'Chest', [['ex-benkpress', false], ['ex-skrabenk-med-manualer', false], ['ex-dips', false], ['ex-kabelflyes', true], ['ex-pec-deck', true]]),
      day('Rygg', 'Back', [['ex-markloft', false], ['ex-pull-ups', false], ['ex-stangroing', false], ['ex-nedtrekk', false], ['ex-face-pulls', true]]),
      LEGS,
      day('Skuldre', 'Shoulders', [['ex-militaerpress', false], ['ex-arnoldpress', false], ['ex-sidehev', true], ['ex-omvendt-flyes', true], ['ex-shrugs', true]]),
      day('Armer', 'Arms', [['ex-bicepscurl-med-stang', true], ['ex-fransk-press', true], ['ex-hammercurl', true], ['ex-tau-pushdown', true], ['ex-preacher-curl', true]]),
    ],
  },
  {
    id: 'ulppl5',
    get name() { return t('Overkropp / Underkropp / Push / Pull / Bein', 'Upper / Lower / Push / Pull / Legs'); },
    get description() { return t('Styrke tidlig i uka, volum mot slutten.', 'Strength early in the week, volume towards the end.'); },
    days: [5],
    level: 'all',
    routines: [UPPER, LOWER, PUSH_B, PULL_B, LEGS_B],
  },
  {
    id: 'ppl6',
    get name() { return t('Push / Pull / Bein ×2', 'Push / Pull / Legs ×2'); },
    get description() { return t('Seks økter, to varianter av hver. For deg som trener mye.', 'Six sessions, two variants of each. For when you train a lot.'); },
    days: [6],
    level: 'advanced',
    routines: [PUSH, PULL, LEGS, PUSH_B, PULL_B, LEGS_B],
  },
  {
    id: 'arnold6',
    get name() { return t('Arnold split', 'Arnold split'); },
    get description() { return t('Bryst og rygg, skuldre og armer, bein. To runder i uka.', 'Chest and back, shoulders and arms, legs. Twice a week.'); },
    days: [6],
    level: 'advanced',
    routines: [
      day('Bryst og rygg', 'Chest and back', [['ex-benkpress', false], ['ex-stangroing', false], ['ex-skrabenk-med-manualer', false], ['ex-pull-ups', false], ['ex-kabelflyes', true]]),
      day('Skuldre og armer', 'Shoulders and arms', [['ex-militaerpress', false], ['ex-sidehev', true], ['ex-bicepscurl-med-stang', true], ['ex-fransk-press', true], ['ex-hammercurl', true]]),
      LEGS,
    ],
  },
  {
    id: 'db3',
    get name() { return t('Bare manualer', 'Dumbbells only'); },
    get description() { return t('Tre helkroppsøkter for hjemmegym eller hotell.', 'Three full body sessions for a home gym or a hotel.'); },
    days: [2, 3, 4],
    level: 'all',
    routines: [
      day('Manualer A', 'Dumbbells A', [['ex-goblet-squat', false], ['ex-benkpress-med-manualer', false], ['ex-roing-med-manual', false], ['ex-sidehev', true], ['ex-bicepscurl-med-manualer', true]]),
      day('Manualer B', 'Dumbbells B', [['ex-rumensk-markloft-manualer', false], ['ex-skulderpress-med-manualer', false], ['ex-bulgarsk-splittboy', false], ['ex-hammercurl', true], ['ex-overhead-manual', true]]),
      day('Manualer C', 'Dumbbells C', [['ex-walking-lunges', false], ['ex-skrabenk-med-manualer', false], ['ex-roing-med-manual', false], ['ex-arnoldpress', true], ['ex-kickbacks', true]]),
    ],
  },
  {
    id: 'bw3',
    get name() { return t('Kroppsvekt', 'Bodyweight'); },
    get description() { return t('Ingen utstyr utenom en stang til pull-ups.', 'No equipment except a bar for pull-ups.'); },
    days: [2, 3, 4],
    level: 'beginner',
    routines: [
      day('Kroppsvekt A', 'Bodyweight A', [['ex-push-ups', false], ['ex-pull-ups', false], ['ex-pistol-squat', false], ['ex-planke', true], ['ex-dead-bug', true]]),
      day('Kroppsvekt B', 'Bodyweight B', [['ex-dips', false], ['ex-invertert-roing', false], ['ex-walking-lunges', false], ['ex-hengende-beinhev', true], ['ex-side-planke', true]]),
    ],
  },
];

export const programById = (id: string) => PROGRAMS.find((p) => p.id === id);

/** Den anbefalte splitten for antall dager, erfaring og mål. */
export function recommendedProgramId(days: number, experience: Experience, goal: Goal): string {
  const d = Math.min(6, Math.max(2, days));
  if (d === 2) return experience === 'beginner' ? 'fb2' : 'ul2';
  if (d === 3) {
    if (goal === 'strength') return 'sl5x5';
    return experience === 'beginner' ? 'fb2' : 'ulf3';
  }
  if (d === 4) return 'ul4';
  if (d === 5) return 'pplul5';
  return 'ppl6';
}

/** Programmene som passer antall dager, med det anbefalte først. */
export function programsForDays(days: number, experience: Experience, goal: Goal): { program: Program; recommended: boolean }[] {
  const d = Math.min(6, Math.max(2, days));
  const rec = recommendedProgramId(d, experience, goal);
  return PROGRAMS.filter((p) => p.days.includes(d) || p.id === rec)
    .map((program) => ({ program, recommended: program.id === rec }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));
}

/** Sets, reps og hvile etter mål. */
export function schemeFor(goal: Goal) {
  switch (goal) {
    case 'strength':
      return { sets: 5, reps: 5, rest: 180 };
    case 'endurance':
      return { sets: 3, reps: 15, rest: 60 };
    case 'hypertrophy':
      return { sets: 3, reps: 10, rest: 120 };
    default:
      return { sets: 3, reps: 10, rest: 90 };
  }
}
