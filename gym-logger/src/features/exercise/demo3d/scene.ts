// Tegner mannekengen og utstyret med three.js. Leddposisjonene kommer fra rig.ts hvert bilde;
// her lages bare formene (avsmalnende sylindre, kuler og ellipsoider) og flyttes dit de skal.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MuscleGroup } from '../../../db/types';
import { BODY, FOOT_R, RADII, limbRadius, trunkPoint, type Joints, type LimbName, type V3 } from './rig';
import { sample, type Move } from './moves';

const FRAME_MS = 1000 / 30;
/** Sekunder demoen spiller før den stopper av seg selv. */
export const AUTO_STOP_S = 20;

const SKIN = '#a3a3ab';
const PROP = '#3b3b41';
const METAL = '#c9c9cf';
const PLATE = '#2b2b30';

export interface SceneOptions {
  accent: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
}

const Y = new THREE.Vector3(0, 1, 0);
const v = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

/**
 * Lem med muskelform (LatheGeometry etter limbRadius i rig.ts) fra roten til enden. Geometrien lages
 * med riktig lengde, så den bare flyttes og roteres.
 */
class Limb {
  mesh: THREE.Mesh;
  constructor(length: number, limb: LimbName, mat: THREE.Material, parent: THREE.Object3D) {
    const pts: THREE.Vector2[] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(new THREE.Vector2(Math.max(0.0005, limbRadius(limb, t)), -length / 2 + t * length));
    }
    const geo = new THREE.LatheGeometry(pts, 20);
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, mat);
    parent.add(this.mesh);
  }
  place(a: V3, b: V3) {
    const va = v(a);
    const dir = v(b).sub(va);
    const l = dir.length();
    this.mesh.position.copy(va.addScaledVector(dir, 0.5));
    if (l > 1e-6) this.mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
  }
}

/** Overkroppen som én glatt form: bekken, midje, brystkasse, skuldre og nakke (flatere forfra-bakfra). */
function torsoShape(mat: THREE.Material, parent: THREE.Object3D) {
  // [høyde langs ryggen, bredde (radius)]
  const profile: [number, number][] = [
    [-0.075, 0.0],
    [-0.06, 0.1],
    [-0.02, 0.15],
    [0.05, 0.155],
    [0.15, 0.13],
    [0.24, 0.135],
    [0.34, 0.16],
    [0.43, 0.17],
    [0.5, 0.15],
    [0.53, 0.09],
    [0.55, 0.05],
    [0.62, 0.045],
  ];
  const pts = profile.map(([y, r]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(1, 1, 0.68);
  parent.add(m);
  return m;
}

function blob(mat: THREE.Material, parent: THREE.Object3D, r: number, s: V3 = [1, 1, 1], at: V3 = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.scale.set(s[0], s[1], s[2]);
  m.position.set(at[0], at[1], at[2]);
  parent.add(m);
  return m;
}

function cyl(mat: THREE.Material, parent: THREE.Object3D, r: number, length: number, axis: 'x' | 'y' | 'z', at: V3) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 16), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(at[0], at[1], at[2]);
  parent.add(m);
  return m;
}

function box(mat: THREE.Material, parent: THREE.Object3D, size: V3, at: V3) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  m.position.set(at[0], at[1], at[2]);
  parent.add(m);
  return m;
}

function mixColor(a: string, b: string, t: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

export class DemoScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private controls: OrbitControls;
  private raf = 0;
  private last = 0;
  private phase = 0;
  private cue: string | undefined;
  private visible = true;
  playing = true;
  speed = 1;
  onCue?: (cue: [string, string] | undefined) => void;

  private limbs: Record<string, Limb[]> = {};
  private joints: Record<string, THREE.Mesh[]> = {};
  private torso = new THREE.Group();
  private shadow?: THREE.Mesh;
  private feet: THREE.Mesh[] = [];
  private bar?: THREE.Group;
  private dumbbells: THREE.Group[] = [];
  private cable?: THREE.Line;
  private pulley = new THREE.Vector3(0, 2.28, -0.03);

  constructor(
    canvas: HTMLCanvasElement,
    private move: Move,
    opts: SceneOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
    // Ytelse: maks 1,5× skarphet og ingen sanntidsskygger (en myk skygge-flekk under figuren i stedet).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.lights();
    this.floor();

    const mats = this.materials(opts);
    this.body(mats);
    this.props(mats);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.52;
    this.controls.addEventListener('change', () => this.requestRender());
    this.setView(move.view);

    this.update(0);
  }

  private lights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x303036, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.2, 4.5, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-3, 2.5, -2.5);
    this.scene.add(rim);
  }

  private floor() {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshBasicMaterial({ color: '#202023' }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    // Myk skygge-flekk som følger figuren (billig erstatning for sanntidsskygger).
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.002;
    this.shadow.scale.set(0.8, 0.55, 1);
    this.scene.add(this.shadow);
  }

  private materials(opts: SceneOptions) {
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6, metalness: 0.02 });
    const primary = new THREE.MeshStandardMaterial({ color: opts.accent, roughness: 0.5, emissive: opts.accent, emissiveIntensity: 0.12 });
    const secondary = new THREE.MeshStandardMaterial({ color: mixColor(opts.accent, SKIN, 0.5), roughness: 0.55 });
    const muscle = (...groups: MuscleGroup[]) =>
      groups.includes(opts.primary) ? primary : groups.some((g) => opts.secondary.includes(g)) ? secondary : skin;
    return {
      skin,
      muscle,
      prop: new THREE.MeshStandardMaterial({ color: PROP, roughness: 0.7 }),
      metal: new THREE.MeshStandardMaterial({ color: METAL, roughness: 0.3, metalness: 0.8 }),
      plate: new THREE.MeshStandardMaterial({ color: PLATE, roughness: 0.6 }),
      pad: new THREE.MeshStandardMaterial({ color: '#2c2c31', roughness: 0.85 }),
    };
  }

  private body(m: ReturnType<DemoScene['materials']>) {
    const s = this.scene;
    const legs = m.muscle('Bein');
    const arms = m.muscle('Biceps', 'Triceps');
    this.limbs.thigh = [0, 1].map(() => new Limb(BODY.thigh, 'thigh', legs, s));
    this.limbs.shin = [0, 1].map(() => new Limb(BODY.shin, 'shin', legs, s));
    this.limbs.upperArm = [0, 1].map(() => new Limb(BODY.upperArm, 'upperArm', arms, s));
    this.limbs.forearm = [0, 1].map(() => new Limb(BODY.forearm, 'forearm', m.muscle('Underarmer'), s));
    this.joints.knee = [0, 1].map(() => blob(m.skin, s, RADII.thigh[1] * 0.95));
    this.joints.ankle = [0, 1].map(() => blob(m.skin, s, RADII.shin[1]));
    this.joints.elbow = [0, 1].map(() => blob(m.skin, s, RADII.upperArm[1] * 0.95));
    this.joints.hand = [0, 1].map(() => blob(m.skin, s, 0.04, [1, 1.15, 0.8]));
    this.joints.delt = [0, 1].map(() => blob(m.muscle('Skuldre'), s, 0.052, [1, 1.1, 1.1]));
    this.feet = [0, 1].map(() => {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(FOOT_R, 0.17, 4, 10), m.skin);
      s.add(f);
      return f;
    });

    // Overkroppen: barnas koordinater er (sidelengs, langs ryggen, fram).
    const t = this.torso;
    s.add(t);
    torsoShape(m.skin, t);
    // Musklene ligger som tynne, flate former nedsenket i overkroppen, så de ser ut som muskler og ikke klosser.
    for (const x of [-1, 1]) {
      blob(m.muscle('Rumpe'), t, 1, [0.075, 0.085, 0.06], [x * 0.062, 0.0, -0.058]);
      blob(m.muscle('Bryst'), t, 1, [0.078, 0.055, 0.03], [x * 0.064, 0.4, 0.084]);
      blob(m.muscle('Rygg'), t, 1, [0.06, 0.15, 0.03], [x * 0.09, 0.32, -0.075]);
      blob(m.muscle('Mage'), t, 1, [0.035, 0.12, 0.022], [x * 0.032, 0.18, 0.083]);
    }
    blob(m.muscle('Rygg'), t, 1, [0.12, 0.05, 0.04], [0, 0.49, -0.05]);
    blob(m.muscle('Rygg'), t, 1, [0.05, 0.12, 0.025], [0, 0.16, -0.085]);
    cyl(m.skin, t, 0.045, 0.12, 'y', [0, 0.56, 0]);
    blob(m.skin, t, 1, [0.09, 0.11, 0.1], [0, BODY.head, 0.01]);
  }

  private props(m: ReturnType<DemoScene['materials']>) {
    const s = this.scene;
    const props = this.move.props;
    if (props.includes('barbell')) {
      const g = new THREE.Group();
      cyl(m.metal, g, RADII.bar, 2.0, 'x', [0, 0, 0]);
      for (const side of [-1, 1]) {
        cyl(m.metal, g, 0.025, 0.36, 'x', [side * 0.86, 0, 0]);
        cyl(m.plate, g, 0.225, 0.045, 'x', [side * 0.74, 0, 0]);
        cyl(m.plate, g, 0.2, 0.035, 'x', [side * 0.785, 0, 0]);
      }
      this.bar = g;
      s.add(g);
    }
    if (props.includes('dumbbells')) {
      this.dumbbells = [0, 1].map(() => {
        const g = new THREE.Group();
        cyl(m.metal, g, 0.014, 0.2, 'z', [0, 0, 0]);
        for (const z of [-0.085, 0.085]) cyl(m.plate, g, 0.065, 0.05, 'z', [0, 0, z]);
        s.add(g);
        return g;
      });
    }
    const p0 = this.move.keys[0].pose;
    if (props.includes('bench')) {
      // Ryggputa følger overkroppens vinkel; skråbenken får sete under bekkenet.
      const pad = new THREE.Group();
      pad.position.set(...p0.pelvis);
      pad.rotation.x = (p0.trunk * Math.PI) / 180;
      const incline = p0.trunk > -80;
      box(m.pad, pad, [0.3, incline ? 0.78 : 1.12, 0.07], [0, incline ? 0.38 : 0.3, -0.165]);
      s.add(pad);
      const lowEnd = trunkPoint(p0.pelvis, p0.trunk, [0, incline ? 0 : -0.25, -0.2]);
      const highEnd = trunkPoint(p0.pelvis, p0.trunk, [0, incline ? 0.6 : 0.85, -0.2]);
      if (incline) {
        box(m.pad, s, [0.3, 0.07, 0.36], [0, p0.pelvis[1] - 0.115, p0.pelvis[2] + 0.1]);
        box(m.prop, s, [0.06, p0.pelvis[1] - 0.15, 0.06], [0, (p0.pelvis[1] - 0.15) / 2, p0.pelvis[2] + 0.05]);
        box(m.prop, s, [0.06, highEnd[1], 0.06], [0, highEnd[1] / 2, highEnd[2]]);
      } else {
        for (const e of [lowEnd, highEnd]) box(m.prop, s, [0.06, e[1], 0.06], [0, e[1] / 2, e[2]]);
      }
      box(m.prop, s, [0.08, 0.03, Math.abs(highEnd[2] - lowEnd[2]) + 0.4], [0, 0.015, (highEnd[2] + lowEnd[2]) / 2]);
      // Stativ med stanga i: to stolper bak hodet.
      const rackZ = trunkPoint(p0.pelvis, p0.trunk, [0, 0.62, 0])[2] - 0.08;
      for (const x of [-0.55, 0.55]) box(m.prop, s, [0.05, 1.15, 0.05], [x, 0.575, rackZ]);
    }
    if (props.includes('pullupBar')) {
      const y = p0.hands[0][1];
      cyl(m.metal, s, 0.016, 1.5, 'x', [0, y, 0]);
      for (const x of [-0.72, 0.72]) box(m.prop, s, [0.06, y + 0.05, 0.06], [x, (y + 0.05) / 2, 0]);
    }
    if (props.includes('dipBars')) {
      const y = p0.hands[0][1] - 0.02;
      for (const x of [-0.27, 0.27]) {
        cyl(m.metal, s, 0.02, 0.6, 'z', [x, y, 0]);
        for (const z of [-0.26, 0.26]) box(m.prop, s, [0.045, y, 0.045], [x * 1.15, y / 2, z]);
      }
    }
    if (props.includes('pulldown')) {
      box(m.pad, s, [0.4, 0.06, 0.36], [0, 0.42, 0.02]);
      box(m.prop, s, [0.06, 0.39, 0.06], [0, 0.195, 0.02]);
      cyl(m.pad, s, 0.05, 0.42, 'x', [0, 0.74, 0.34]);
      box(m.prop, s, [0.04, 0.3, 0.04], [0, 0.6, 0.3]);
      box(m.prop, s, [0.14, 2.35, 0.14], [0, 1.175, -0.6]);
      box(m.prop, s, [0.1, 0.08, 0.62], [0, 2.32, -0.3]);
      blob(m.metal, s, 0.045, [1, 1, 1], [this.pulley.x, this.pulley.y, this.pulley.z]);
      const g = new THREE.Group();
      cyl(m.metal, g, RADII.bar, 1.15, 'x', [0, 0, 0]);
      for (const side of [-1, 1]) {
        const end = cyl(m.metal, g, RADII.bar, 0.2, 'x', [side * 0.64, -0.035, 0]);
        end.rotation.z = Math.PI / 2 - side * 0.35;
      }
      this.bar = g;
      s.add(g);
      const geo = new THREE.BufferGeometry().setFromPoints([this.pulley, this.pulley.clone()]);
      this.cable = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#8a8a90' }));
      s.add(this.cable);
    }
  }

  private apply(j: Joints) {
    for (const i of [0, 1]) {
      this.limbs.thigh[i].place(j.hips[i], j.knees[i]);
      this.limbs.shin[i].place(j.knees[i], j.ankles[i]);
      this.limbs.upperArm[i].place(j.shoulders[i], j.elbows[i]);
      this.limbs.forearm[i].place(j.elbows[i], j.wrists[i]);
      this.joints.knee[i].position.set(...j.knees[i]);
      this.joints.ankle[i].position.set(...j.ankles[i]);
      this.joints.elbow[i].position.set(...j.elbows[i]);
      this.joints.hand[i].position.set(...j.wrists[i]);
      this.joints.delt[i].position.set(...j.shoulders[i]);
      const heel = v(j.heels[i]);
      const toe = v(j.toes[i]);
      const dir = toe.clone().sub(heel);
      this.feet[i].position.copy(heel.addScaledVector(dir, 0.5));
      this.feet[i].quaternion.setFromUnitVectors(Y, dir.normalize());
    }
    this.torso.position.set(...j.pelvis);
    if (this.shadow) {
      // Liggende eller hengende figur: flekken under midten av kroppen.
      const mid = v(j.ankles[0]).add(v(j.ankles[1])).multiplyScalar(0.25).add(v(j.pelvis).multiplyScalar(0.5));
      this.shadow.position.x = mid.x;
      this.shadow.position.z = mid.z;
    }
    this.torso.rotation.x = (j.trunk * Math.PI) / 180;
    const mid = v(j.wrists[0]).add(v(j.wrists[1])).multiplyScalar(0.5);
    if (this.bar) this.bar.position.copy(mid);
    this.dumbbells.forEach((d, i) => d.position.set(...j.wrists[i]));
    if (this.cable) {
      this.cable.geometry.setFromPoints([this.pulley, mid]);
    }
  }

  /** Viser posituren ved `phase` og sier fra om ny tekst. */
  private update(phase: number) {
    const { joints, cue } = sample(this.move, phase);
    this.apply(joints);
    const key = cue?.[0];
    if (key !== this.cue) {
      this.cue = key;
      this.onCue?.(cue);
    }
  }

  setView(view: Move['view']) {
    const dir = view === 'side' ? new THREE.Vector3(1, 0.16, 0.14) : view === 'front' ? new THREE.Vector3(0.18, 0.2, 1) : new THREE.Vector3(0.8, 0.32, 0.62);
    // Litt lavere sikte, så figuren står høyere i bildet og teksten nederst ikke dekker føttene.
    const target = v(this.move.target).add(new THREE.Vector3(0, -0.12, 0));
    this.controls.target.copy(target);
    this.camera.position.copy(target.clone().addScaledVector(dir.normalize(), this.move.distance));
    this.controls.update();
    this.requestRender();
  }

  setPhase(phase: number) {
    this.phase = phase;
    this.update(phase);
    this.requestRender();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.requestRender();
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private needsRender = true;
  requestRender() {
    this.needsRender = true;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  start() {
    this.last = performance.now();
    this.requestRender();
  }

  /** Sekunder animasjonen har gått siden siste start. Stopper av seg selv etter AUTO_STOP for å spare batteri. */
  private playedFor = 0;
  private lastFrame = 0;
  onAutoPause?: () => void;

  private tick = (now: number) => {
    this.raf = 0;
    if (!this.visible) return;
    const animating = this.playing;
    // Maks 30 bilder i sekundet: godt nok for en rolig demo og halvparten av arbeidet.
    if (animating && now - this.lastFrame < FRAME_MS - 2) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.lastFrame = now;
    if (animating) {
      this.phase = (this.phase + (dt * this.speed) / this.move.duration) % 1;
      this.playedFor += dt;
      this.update(this.phase);
    }
    const damping = this.controls.update();
    if (animating || this.needsRender || damping) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
    if (animating && this.playedFor >= AUTO_STOP_S) {
      this.playing = false;
      this.onAutoPause?.();
      return;
    }
    if (animating || damping) this.raf = requestAnimationFrame(this.tick);
  };

  /** Fortsetter animasjonen (etter pause). */
  play() {
    this.playing = true;
    this.playedFor = 0;
    this.last = performance.now();
    this.requestRender();
  }

  pause() {
    this.playing = false;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        const mat = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
      }
    });
    this.renderer.dispose();
  }
}

/** Om nettleseren kan tegne WebGL. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
