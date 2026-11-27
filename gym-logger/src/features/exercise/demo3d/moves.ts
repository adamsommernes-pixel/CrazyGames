// Bevegelsene for de 12 store løftene. Hver bevegelse er noen få nøkkelposisjoner som spilles i
// løkke; alt imellom blandes jevnt og knær/albuer regnes ut på nytt hvert bilde (se rig.ts).
import { BODY, solvePose, trunkPoint, lerpPose, type Joints, type Pose, type V3 } from './rig';

export type Prop = 'barbell' | 'dumbbells' | 'bench' | 'pullupBar' | 'dipBars' | 'pulldown';

export interface Key {
  /** Tid i syklusen, 0–1. */
  t: number;
  pose: Pose;
  /** Tekst som vises fra denne nøkkelen (norsk, engelsk). */
  cue?: [string, string];
  /** Lineær blanding fram til neste nøkkel (brukes av tette, utregnede baner som allerede er myke). */
  linear?: boolean;
}

export interface Move {
  slug: string;
  /** Sekunder for én repetisjon. */
  duration: number;
  hands: 'world' | 'trunk';
  props: Prop[];
  /** Hvor kameraet ser på, og standardvinkelen (side eller front). */
  target: V3;
  view: 'side' | 'front' | 'angle';
  /** Avstand fra kameraet. */
  distance: number;
  /** Posisjonen som vises når animasjon er slått av (redusert bevegelse). */
  still: number;
  keys: Key[];
}

const both = (l: V3): [V3, V3] => [l, [-l[0], l[1], l[2]]];
const FWD_KNEE: V3 = [-0.3, 0, 1];
const STAND_TOP: Pick<Pose, 'pelvis' | 'trunk'> = { pelvis: [0, 0.93, -0.02], trunk: 3 };

// ---- Knebøy og frontbøy ---------------------------------------------------------------------
const SQUAT_FEET = both([-0.17, BODY.ankleHeight, 0]);
const squatTop: Pose = { ...STAND_TOP, trunk: 6, feet: SQUAT_FEET, hands: both([-0.42, 0.47, -0.07]), knee: [-0.4, 0, 1], elbow: [-0.3, -1, -0.6] };
const squatBottom: Pose = { ...squatTop, pelvis: [0, 0.47, -0.22], trunk: 40 };

const frontTop: Pose = { ...STAND_TOP, feet: SQUAT_FEET, hands: both([-0.24, 0.45, 0.13]), knee: [-0.4, 0, 1], elbow: [-0.2, 0.25, 1] };
const frontBottom: Pose = { ...frontTop, pelvis: [0, 0.47, -0.13], trunk: 20 };

// ---- Markløft og rumensk markløft -------------------------------------------------------------
// Bekkenet regnes ut fra stanga: skuldrene plasseres slik at armene henger strake ned til stanga,
// så hendene aldri slipper. `ahead` er hvor langt skuldrene er foran stanga.
const HIP_FEET = both([-0.13, BODY.ankleHeight, -0.03]);
const GRIP = 0.25;
const ARM = (BODY.upperArm + BODY.forearm) * 0.995;
function hinge(barY: number, barZ: number, trunk: number, ahead: number): Pose {
  const dx = GRIP - BODY.shoulderHalf;
  const shoulder: V3 = [0, barY + Math.sqrt(ARM * ARM - dx * dx - ahead * ahead), barZ + ahead];
  const up = trunkPoint([0, 0, 0], trunk, [0, BODY.spine, 0]);
  return { pelvis: [0, shoulder[1] - up[1], shoulder[2] - up[2]], trunk, feet: HIP_FEET, hands: both([-GRIP, barY, barZ]), knee: [-0.15, 0, 1], elbow: [0, 0, -1] };
}
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Tett bane fra `t0` til `t1` med `n` steg; `at(s)` gir posituren for s = 0–1 (mykt i start og slutt). */
function path(t0: number, t1: number, at: (s: number) => Pose, cue?: [string, string], n = 12): Key[] {
  return Array.from({ length: n }, (_, k) => ({ t: t0 + ((t1 - t0) * k) / n, pose: at(ease(k / n)), linear: true, cue: k === 0 ? cue : undefined }));
}

/** Markløft fra gulvet (s = 0) til toppen (s = 1): knærne strekkes først, så hofta. */
const deadlift = (s: number) =>
  hinge(lerpN(0.225, 0.874, s), lerpN(0.09, 0.11, s), s < 0.45 ? lerpN(67, 57, s / 0.45) : lerpN(57, 0, (s - 0.45) / 0.55), lerpN(0.0, -0.1, s));
/** Rumensk markløft fra toppen (s = 0) til bunnen (s = 1). */
const rdl = (s: number) => hinge(lerpN(0.874, 0.41, s), lerpN(0.11, 0.115, s), lerpN(0, 72, s), lerpN(-0.1, 0.02, s));

// ---- Benkpress og skråbenk ---------------------------------------------------------------------
const BENCH_FEET = both([-0.28, BODY.ankleHeight, 0.6]);
const benchTop: Pose = { pelvis: [0, 0.56, 0.2], trunk: -90, feet: BENCH_FEET, hands: both([-0.4, 1.05, -0.25]), knee: [-0.2, 1, 0.3], elbow: [-0.6, -1, 0.25] };
const benchBottom: Pose = { ...benchTop, hands: both([-0.4, 0.71, -0.16]) };

const INC: Pick<Pose, 'pelvis' | 'trunk'> = { pelvis: [0, 0.55, 0.12], trunk: -50 };
const incShoulder = trunkPoint(INC.pelvis, INC.trunk, [0, BODY.spine, 0]);
const incChest = trunkPoint(INC.pelvis, INC.trunk, [0, 0.42, 0.16]);
const incTop: Pose = { ...INC, feet: BENCH_FEET, hands: both([-0.38, incShoulder[1] + 0.52, incShoulder[2] + 0.03]), knee: [-0.2, 1, 0.3], elbow: [-0.6, -1, 0.3] };
const incBottom: Pose = { ...incTop, hands: both([-0.38, incChest[1], incChest[2]]) };

// ---- Militærpress -------------------------------------------------------------------------------
const ohpBottom: Pose = { ...STAND_TOP, trunk: 0, feet: HIP_FEET, hands: both([-0.27, 0.47, 0.13]), knee: FWD_KNEE, elbow: [-0.15, -0.5, 1] };
const ohpMid: Pose = { ...ohpBottom, hands: both([-0.27, 0.72, 0.17]), elbow: [-0.7, -0.4, 0.5] };
const ohpTop: Pose = { ...ohpBottom, trunk: 2, hands: both([-0.27, 1.03, 0]), elbow: [-1, 0, 0] };

// ---- Dips --------------------------------------------------------------------------------------
const DIP_Y = 1.15;
const dipTop: Pose = { pelvis: [0, 1.2, -0.07], trunk: 8, feet: both([-0.07, 0.62, -0.42]), hands: both([-0.27, DIP_Y, 0]), knee: [0, -0.3, 1], elbow: [0, 0, -1] };
const dipBottom: Pose = { ...dipTop, pelvis: [0, 0.97, -0.16], trunk: 25, feet: both([-0.07, 0.4, -0.5]) };

// ---- Stangroing ----------------------------------------------------------------------------------
const rowBottom: Pose = { pelvis: [0, 0.8, -0.22], trunk: 50, feet: both([-0.15, BODY.ankleHeight, 0]), hands: both([-0.25, 0.15, 0.41]), knee: [-0.15, 0, 1], elbow: [-0.25, 0.7, -0.6] };
const rowTop: Pose = { ...rowBottom, hands: both([-0.25, 0.25, 0.18]) };

// ---- Nedtrekk ------------------------------------------------------------------------------------
const PD: Pick<Pose, 'pelvis' | 'trunk'> = { pelvis: [0, 0.56, 0], trunk: -12 };
const pdChest = trunkPoint(PD.pelvis, PD.trunk, [0, 0.45, 0.17]);
const pdTop: Pose = { ...PD, feet: both([-0.17, BODY.ankleHeight, 0.46]), hands: both([-0.48, 1.49, -0.02]), knee: [-0.1, 0.4, 1], elbow: [-0.5, -1, -0.1] };
const pdBottom: Pose = { ...pdTop, hands: both([-0.48, pdChest[1], pdChest[2]]) };

// ---- Pull-ups ------------------------------------------------------------------------------------
const BAR_Y = 2.15;
const puBottom: Pose = { pelvis: [0, 1.17, -0.08], trunk: -6, feet: both([-0.08, 0.34, -0.04]), hands: both([-0.42, BAR_Y, 0]), knee: [0, 0, 1], elbow: [-0.6, -1, 0.3] };
const puTop: Pose = { ...puBottom, pelvis: [0, 1.52, -0.01], trunk: -15, feet: both([-0.08, 0.7, 0.0]) };

// ---- Utfall (manualer) -----------------------------------------------------------------------------
const lungeArms = { hands: both([-0.24, -0.04, 0]), elbow: [0, 0, -1] as V3 };
const lungeStand: Pose = { pelvis: [0, 0.93, 0], trunk: 3, feet: [[-0.11, BODY.ankleHeight, 0], [0.11, BODY.ankleHeight, 0]], knee: FWD_KNEE, ...lungeArms };
const lungeStep: Pose = { ...lungeStand, pelvis: [0, 0.9, 0.12], feet: [[-0.12, 0.22, 0.37], [0.11, BODY.ankleHeight, 0]], footPitch: [0, 10] };
const lungePlant: Pose = { ...lungeStand, pelvis: [0, 0.82, 0.36], feet: [[-0.12, BODY.ankleHeight, 0.76], [0.11, 0.1, -0.02]], footPitch: [0, 25] };
const lungeBottom: Pose = { ...lungePlant, pelvis: [0, 0.52, 0.3], trunk: 6, feet: [[-0.12, BODY.ankleHeight, 0.76], [0.11, 0.15, -0.04]], footPitch: [0, 50], knee: [[-0.2, 0, 1], [0.1, -0.6, 1]] };

const loop = (a: Pose, b: Pose, times: [number, number, number, number], cues: [[string, string], [string, string]]): Key[] => [
  { t: 0, pose: a, cue: cues[0] },
  { t: times[0], pose: b },
  { t: times[1], pose: b, cue: cues[1] },
  { t: times[2], pose: a },
  { t: times[3], pose: a },
  { t: 1, pose: a },
];

export const MOVES: Move[] = [
  {
    slug: 'kneboy',
    duration: 3.6,
    hands: 'trunk',
    props: ['barbell'],
    target: [0, 0.85, 0],
    view: 'angle',
    distance: 4.1,
    still: 0.5,
    keys: loop(squatTop, squatBottom, [0.42, 0.5, 0.85, 0.95], [
      ['Ned: hofta bak og knærne ut', 'Down: hips back, knees out'],
      ['Opp: press gjennom hele foten', 'Up: drive through the whole foot'],
    ]),
  },
  {
    slug: 'frontboy',
    duration: 3.6,
    hands: 'trunk',
    props: ['barbell'],
    target: [0, 0.85, 0],
    view: 'angle',
    distance: 4.1,
    still: 0.5,
    keys: loop(frontTop, frontBottom, [0.42, 0.5, 0.85, 0.95], [
      ['Ned: albuene høyt, rett overkropp', 'Down: elbows high, chest up'],
      ['Opp: press opp, albuene høyt', 'Up: drive up, elbows high'],
    ]),
  },
  {
    slug: 'utfall',
    duration: 4.4,
    hands: 'trunk',
    props: ['dumbbells'],
    target: [0, 0.8, 0.3],
    view: 'side',
    distance: 4.3,
    still: 0.5,
    keys: [
      { t: 0, pose: lungeStand, cue: ['Ta et langt skritt fram', 'Take a long step forward'] },
      { t: 0.14, pose: lungeStep },
      { t: 0.28, pose: lungePlant, cue: ['Senk bakre kne mot gulvet', 'Lower the back knee to the floor'] },
      { t: 0.46, pose: lungeBottom },
      { t: 0.52, pose: lungeBottom, cue: ['Press deg tilbake til start', 'Push back to the start'] },
      { t: 0.7, pose: lungePlant },
      { t: 0.84, pose: lungeStep },
      { t: 0.95, pose: lungeStand },
      { t: 1, pose: lungeStand },
    ],
  },
  {
    slug: 'markloft',
    duration: 4.4,
    hands: 'world',
    props: ['barbell'],
    target: [0, 0.75, 0],
    view: 'angle',
    distance: 4.3,
    still: 0,
    keys: [
      ...path(0, 0.36, deadlift, ['Rett rygg, press gulvet vekk', 'Flat back, push the floor away']),
      { t: 0.36, pose: deadlift(1), cue: ['Stå helt oppreist, ikke len bakover', 'Stand tall, don’t lean back'] },
      ...path(0.48, 0.88, (s) => deadlift(1 - s), ['Senk stanga tett langs beina', 'Lower the bar close to the legs']),
      { t: 0.88, pose: deadlift(0) },
      { t: 1, pose: deadlift(0) },
    ],
  },
  {
    slug: 'rumensk-markloft',
    duration: 4,
    hands: 'world',
    props: ['barbell'],
    target: [0, 0.85, 0],
    view: 'angle',
    distance: 4.3,
    still: 0.48,
    keys: [
      ...path(0, 0.42, rdl, ['Hofta bak, stanga langs lårene', 'Hips back, bar along the thighs']),
      { t: 0.42, pose: rdl(1) },
      ...path(0.5, 0.88, (s) => rdl(1 - s), ['Hofta fram og reis deg', 'Drive the hips forward and stand up']),
      { t: 0.88, pose: rdl(0) },
      { t: 1, pose: rdl(0) },
    ],
  },
  {
    slug: 'benkpress',
    duration: 3.4,
    hands: 'world',
    props: ['bench', 'barbell'],
    target: [0, 0.6, 0],
    view: 'angle',
    distance: 4.4,
    still: 0.46,
    keys: loop(benchTop, benchBottom, [0.42, 0.5, 0.84, 0.94], [
      ['Senk stanga til nedre del av brystet', 'Lower the bar to the lower chest'],
      ['Press opp over skuldrene', 'Press up over the shoulders'],
    ]),
  },
  {
    slug: 'skrabenk',
    duration: 3.4,
    hands: 'world',
    props: ['bench', 'barbell'],
    target: [0, 0.8, 0],
    view: 'angle',
    distance: 4.4,
    still: 0.46,
    keys: loop(incTop, incBottom, [0.42, 0.5, 0.84, 0.94], [
      ['Senk stanga til øvre del av brystet', 'Lower the bar to the upper chest'],
      ['Press rett opp', 'Press straight up'],
    ]),
  },
  {
    slug: 'militaerpress',
    duration: 3.6,
    hands: 'trunk',
    props: ['barbell'],
    target: [0, 1.1, 0],
    view: 'angle',
    distance: 4.4,
    still: 0.4,
    keys: [
      { t: 0, pose: ohpBottom, cue: ['Press rett opp, hodet litt bak', 'Press straight up, head back a little'] },
      { t: 0.18, pose: ohpMid },
      { t: 0.38, pose: ohpTop },
      { t: 0.5, pose: ohpTop, cue: ['Senk kontrollert til skuldrene', 'Lower under control to the shoulders'] },
      { t: 0.72, pose: ohpMid },
      { t: 0.92, pose: ohpBottom },
      { t: 1, pose: ohpBottom },
    ],
  },
  {
    slug: 'dips',
    duration: 3.4,
    hands: 'world',
    props: ['dipBars'],
    target: [0, 1.05, 0],
    view: 'side',
    distance: 4.2,
    still: 0.48,
    keys: loop(dipTop, dipBottom, [0.42, 0.5, 0.85, 0.95], [
      ['Len deg litt fram og senk deg', 'Lean forward a little and lower'],
      ['Press opp til strake armer', 'Press up to straight arms'],
    ]),
  },
  {
    slug: 'stangroing',
    duration: 3,
    hands: 'trunk',
    props: ['barbell'],
    target: [0, 0.75, 0],
    view: 'angle',
    distance: 4.2,
    still: 0.42,
    keys: loop(rowBottom, rowTop, [0.36, 0.46, 0.86, 0.95], [
      ['Trekk stanga mot navlen', 'Pull the bar to your belly button'],
      ['Senk kontrollert', 'Lower under control'],
    ]),
  },
  {
    slug: 'nedtrekk',
    duration: 3.2,
    hands: 'world',
    props: ['pulldown'],
    target: [0, 1.0, 0],
    view: 'angle',
    distance: 4.2,
    still: 0.42,
    keys: loop(pdTop, pdBottom, [0.38, 0.48, 0.86, 0.95], [
      ['Trekk stanga ned til øvre bryst', 'Pull the bar down to the upper chest'],
      ['Slipp opp til strake armer', 'Let it up to straight arms'],
    ]),
  },
  {
    slug: 'pull-ups',
    duration: 3.4,
    hands: 'world',
    props: ['pullupBar'],
    target: [0, 1.4, 0],
    view: 'angle',
    distance: 4.8,
    still: 0.42,
    keys: loop(puBottom, puTop, [0.4, 0.5, 0.88, 0.96], [
      ['Trekk haken over stanga', 'Pull your chin over the bar'],
      ['Senk deg helt ned', 'Lower all the way down'],
    ]),
  },
];

const BY_SLUG = new Map(MOVES.map((m) => [m.slug, m]));
export const moveFor = (exerciseId: string): Move | undefined => BY_SLUG.get(exerciseId.replace(/^ex-/, ''));

/** Positur og tekst ved tid `phase` (0–1) i syklusen. */
export function sample(move: Move, phase: number): { joints: Joints; cue: [string, string] | undefined; pose: Pose } {
  const p = ((phase % 1) + 1) % 1;
  const keys = move.keys;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= p) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.t - a.t;
  const raw = span > 0 ? Math.min(1, Math.max(0, (p - a.t) / span)) : 0;
  const local = a.linear ? raw : ease(raw);
  const pose = lerpPose(a.pose, b.pose, local);
  let cue: [string, string] | undefined;
  for (const k of keys) if (k.t <= p && k.cue) cue = k.cue;
  return { joints: solvePose(pose, move.hands), cue, pose };
}
