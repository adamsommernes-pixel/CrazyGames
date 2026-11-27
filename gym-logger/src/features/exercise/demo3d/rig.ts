// Ren matematikk for 3D-mannekengen, uten three.js, så den kan testes. En positur beskriver
// bekkenet, overkroppens helning og hvor føtter og hender skal være. Knær og albuer regnes ut
// med invers kinematikk (to-ledds IK), så føttene står stille på gulvet og hendene holder stanga.
// Koordinater i meter: y opp, +z er retningen figuren ser, x er sidelengs. Gulvet er y = 0.

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 1, 0];
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Kroppsmål (meter). Lengdene er faste, så IK holder lemmene like lange hele tiden. */
export const BODY = {
  hipHalf: 0.09,
  thigh: 0.44,
  shin: 0.43,
  spine: 0.5,
  shoulderHalf: 0.19,
  upperArm: 0.29,
  forearm: 0.27,
  ankleHeight: 0.08,
  neck: 0.56,
  head: 0.7,
};

/** Tykkelse (radius) i hver ende av lemmene: [ved roten, ved enden]. Brukes av tegningen og testene. */
export const RADII = {
  thigh: [0.078, 0.056],
  shin: [0.054, 0.038],
  upperArm: [0.05, 0.04],
  forearm: [0.04, 0.03],
  bar: 0.014,
} as const;

/** Overkroppens akser for en helning: `up` langs ryggraden, `fwd` ut av brystet, `right` sidelengs. */
export function trunkAxes(pitchDeg: number) {
  const p = rad(pitchDeg);
  const up: V3 = [0, Math.cos(p), Math.sin(p)];
  const fwd: V3 = [0, -Math.sin(p), Math.cos(p)];
  const right: V3 = [1, 0, 0];
  return { up, fwd, right };
}

/** Et punkt gitt i overkroppens koordinater (x sidelengs, u langs ryggen, f fram) fra bekkenet. */
export function trunkPoint(pelvis: V3, pitchDeg: number, [x, u, f]: V3): V3 {
  const a = trunkAxes(pitchDeg);
  return add(add(add(pelvis, scale(a.right, x)), scale(a.up, u)), scale(a.fwd, f));
}

export interface Pose {
  /** Midt mellom hofteleddene. */
  pelvis: V3;
  /** Overkroppens helning i grader: 0 = oppreist, + = lener fram, −90 = ligger på ryggen. */
  trunk: number;
  /** Ankler (venstre, høyre) i verdenskoordinater. */
  feet: [V3, V3];
  /** Fotens vinkel: 0 = flat, + = hælen løftet (tåa i gulvet). Én per fot. */
  footPitch?: [number, number];
  /** Håndledd (venstre, høyre). Verdenskoordinater, eller overkroppens koordinater når bevegelsen sier `hands: 'trunk'`. */
  hands: [V3, V3];
  /** Hvor knærne og albuene peker (venstre side; høyre speiles). Knærne kan også gis per bein. */
  knee: V3 | [V3, V3];
  elbow: V3;
}

/** Radius på fotkapselen; toppen av foten ligger da på gulvet når tå og hæl er i denne høyden. */
export const FOOT_R = 0.035;

/** Venstre side har negativ x. Høyre er speilet. */
export const SIDES = [-1, 1] as const;
/** Speiler en polvektor gitt for venstre side over til høyre (bytter fortegn på x). */
export const poleFor = (v: V3, side: number): V3 => (side === -1 ? v : [-v[0], v[1], v[2]]);

/**
 * To-ledds IK: fra roten `a` mot målet `target` med lengdene `l1` og `l2`. `pole` sier hvilken vei
 * midtleddet (kne/albue) skal peke. Gir midtleddet og endepunktet (målet, flyttet inn om det er utenfor rekkevidde).
 */
export function solveTwoBone(a: V3, target: V3, l1: number, l2: number, pole: V3): { mid: V3; end: V3; reach: number } {
  const d = sub(target, a);
  const full = len(d);
  const dist = Math.min(Math.max(full, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const dir = norm(d);
  const end = add(a, scale(dir, dist));
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let pp = sub(pole, scale(dir, dot(pole, dir)));
  if (len(pp) < 1e-6) pp = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  pp = norm(pp);
  const mid = add(add(a, scale(dir, l1 * cosA)), scale(pp, l1 * sinA));
  return { mid, end, reach: full };
}

export interface Joints {
  pelvis: V3;
  trunk: number;
  hips: [V3, V3];
  knees: [V3, V3];
  ankles: [V3, V3];
  toes: [V3, V3];
  heels: [V3, V3];
  shoulders: [V3, V3];
  elbows: [V3, V3];
  wrists: [V3, V3];
  neck: V3;
  head: V3;
  /** Hvor langt målet var fra roten, delt på lemmets lengde (over 1 = utenfor rekkevidde). */
  stretch: { legs: [number, number]; arms: [number, number] };
}

/** Fotens retning: litt utover, og pekende ned når hælen er løftet eller beinet henger. */
function footFrame(ankle: V3, knee: V3, side: number, pitchDeg: number): { toe: V3; heel: V3 } {
  const planted = ankle[1] < BODY.ankleHeight + 0.06;
  let dir: V3;
  if (planted) {
    const yaw = rad(12) * side;
    const p = rad(pitchDeg);
    dir = norm([Math.sin(yaw) * Math.cos(p), -Math.sin(p), Math.cos(yaw) * Math.cos(p)]);
  } else {
    // Hengende fot: vinkelrett på leggen og litt strakt.
    const shin = norm(sub(ankle, knee));
    const side3: V3 = [1, 0, 0];
    const f = norm([shin[1] * side3[2] - shin[2] * side3[1], shin[2] * side3[0] - shin[0] * side3[2], shin[0] * side3[1] - shin[1] * side3[0]]);
    dir = norm(add(scale(f[2] < 0 ? scale(f, -1) : f, 0.75), scale(shin, 0.55)));
  }
  if (!planted) return { toe: add(ankle, scale(dir, 0.16)), heel: add(ankle, scale(dir, -0.045)) };
  // Fot i gulvet: kapselen (radius ca. 3,5 cm) skal ligge på gulvet, også når hælen er løftet.
  const drop = BODY.ankleHeight - FOOT_R;
  const toe = add(ankle, scale(dir, 0.16));
  const heel = add(ankle, scale(dir, -0.045));
  return { toe: [toe[0], Math.max(FOOT_R, toe[1] - drop * Math.cos(rad(pitchDeg))), toe[2]], heel: [heel[0], Math.max(FOOT_R, heel[1] - drop), heel[2]] };
}

/** Regner ut alle ledd for en positur. `handsFrame` = 'trunk' betyr at hendene er gitt i overkroppens koordinater. */
export function solvePose(pose: Pose, handsFrame: 'world' | 'trunk' = 'world'): Joints {
  const { pelvis, trunk } = pose;
  const ax = trunkAxes(trunk);
  const hips = SIDES.map((s) => add(pelvis, [s * BODY.hipHalf, 0, 0])) as [V3, V3];
  const shoulderMid = trunkPoint(pelvis, trunk, [0, BODY.spine, 0]);
  const shoulders = SIDES.map((s) => add(shoulderMid, scale(ax.right, s * BODY.shoulderHalf))) as [V3, V3];
  const kneePoles = kneePair(pose.knee);
  const legs = SIDES.map((s, i) => solveTwoBone(hips[i], pose.feet[i], BODY.thigh, BODY.shin, poleFor(kneePoles[i], s)));
  const handTargets = pose.hands.map((h) => (handsFrame === 'trunk' ? trunkPoint(pelvis, trunk, h) : h));
  const arms = SIDES.map((s, i) => solveTwoBone(shoulders[i], handTargets[i], BODY.upperArm, BODY.forearm, poleFor(pose.elbow, s)));
  const knees = legs.map((l) => l.mid) as [V3, V3];
  const ankles = legs.map((l) => l.end) as [V3, V3];
  const feet = SIDES.map((s, i) => footFrame(ankles[i], knees[i], s, pose.footPitch?.[i] ?? 0));
  return {
    pelvis,
    trunk,
    hips,
    knees,
    ankles,
    toes: feet.map((f) => f.toe) as [V3, V3],
    heels: feet.map((f) => f.heel) as [V3, V3],
    shoulders,
    elbows: arms.map((a) => a.mid) as [V3, V3],
    wrists: arms.map((a) => a.end) as [V3, V3],
    neck: trunkPoint(pelvis, trunk, [0, BODY.neck, 0]),
    head: trunkPoint(pelvis, trunk, [0, BODY.head, 0.01]),
    stretch: {
      legs: legs.map((l) => l.reach / (BODY.thigh + BODY.shin)) as [number, number],
      arms: arms.map((a) => a.reach / (BODY.upperArm + BODY.forearm)) as [number, number],
    },
  };
}

/** Vinkel i grader i leddet `b` mellom `a` og `c` (180 = strakt). */
export function jointAngle(a: V3, b: V3, c: V3): number {
  const u = norm(sub(a, b));
  const v = norm(sub(c, b));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
}

/** Knepolene som par (venstre, høyre), begge uttrykt som venstre side. */
const kneePair = (k: V3 | [V3, V3]): [V3, V3] => (Array.isArray(k[0]) ? (k as [V3, V3]) : [k as V3, k as V3]);

const lerpPair = (a: [V3, V3], b: [V3, V3], t: number): [V3, V3] => [lerpV(a[0], b[0], t), lerpV(a[1], b[1], t)];

/** Blander to posisjoner. */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    pelvis: lerpV(a.pelvis, b.pelvis, t),
    trunk: lerp(a.trunk, b.trunk, t),
    feet: lerpPair(a.feet, b.feet, t),
    footPitch: [lerp(a.footPitch?.[0] ?? 0, b.footPitch?.[0] ?? 0, t), lerp(a.footPitch?.[1] ?? 0, b.footPitch?.[1] ?? 0, t)],
    hands: lerpPair(a.hands, b.hands, t),
    knee: lerpPair(kneePair(a.knee), kneePair(b.knee), t),
    elbow: lerpV(a.elbow, b.elbow, t),
  };
}
