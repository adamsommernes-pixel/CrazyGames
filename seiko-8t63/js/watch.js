// The Seiko 8T63-00T0 watch model: case, dial, hands, movement layers, gear trains, chronograph
// works and the pulse-level simulation that drives them. Exposes window.WATCH.
(function () {
'use strict';
const WX = window.WX;
const { TAU, clamp, lerp, smooth, ease, deg, wrapPi } = WX;
const { cylGeo, cylY, ringShape, extrude, polyShape, barShape, roundRect, MOD, pr, polar, inter } = WX;
const PLEX = WX.PLEX, MICRO = WX.MICRO;
const DIAL_R = 16.3;
const SUB = { min: [-7.6, 0], sec: [0, -7.6], h24: [7.6, 0] };
const DATE_C = [11.6 * Math.cos(deg(-45)), 11.6 * Math.sin(deg(-45))];

const TEX = WX.TEX;
TEX.dial = WX.canvasTex(2048, 2048, (ctx, N) => {
  const P = WX.painter(ctx, N, DIAL_R);
  ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0, 0, N, N);
  P.mm();
  // pressed waffle pattern
  for (const dir of [1, -1]) {
    for (let k = -2 * DIAL_R; k <= 2 * DIAL_R; k += 0.62) {
      ctx.beginPath(); ctx.moveTo(-DIAL_R, -DIAL_R * dir + k); ctx.lineTo(DIAL_R, DIAL_R * dir + k);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.06; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-DIAL_R, -DIAL_R * dir + k + 0.09); ctx.lineTo(DIAL_R, DIAL_R * dir + k + 0.09);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.07; ctx.stroke();
    }
  }
  const vg = ctx.createRadialGradient(0, 0, 2, 0, 0, DIAL_R);
  vg.addColorStop(0, 'rgba(40,44,50,0.25)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(-DIAL_R, -DIAL_R, 2 * DIAL_R, 2 * DIAL_R);
  // 1/5-second chapter ring: 300 marks
  for (let i = 0; i < 300; i++) {
    const a = Math.PI / 2 - i * TAU / 300, five = i % 25 === 0, sec = i % 5 === 0;
    const r0 = five ? 14.8 : sec ? 15.2 : 15.55;
    ctx.beginPath(); ctx.moveTo(r0 * Math.cos(a), r0 * Math.sin(a)); ctx.lineTo(16.05 * Math.cos(a), 16.05 * Math.sin(a));
    ctx.strokeStyle = five ? 'rgba(240,240,236,0.95)' : sec ? 'rgba(240,240,236,0.82)' : 'rgba(240,240,236,0.5)';
    ctx.lineWidth = five ? 0.2 : sec ? 0.1 : 0.05; ctx.stroke();
  }
  // subdials
  const subdial = (cx, cy, kind) => {
    P.mm();
    ctx.fillStyle = '#16181b'; P.circle(cx, cy, 3.95); ctx.fill();
    for (let r = 0.25; r < 3.9; r += 0.07) {
      P.circle(cx, cy, r); ctx.strokeStyle = (Math.round(r / 0.07) % 2) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.03; ctx.stroke();
    }
    P.circle(cx, cy, 3.95); ctx.strokeStyle = 'rgba(235,235,230,0.6)'; ctx.lineWidth = 0.06; ctx.stroke();
    const n = kind === 'h24' ? 24 : 60;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 - i * TAU / n, major = kind === 'h24' ? i % 6 === 0 : i % 5 === 0;
      if (kind !== 'h24' && !major && i % 1 !== 0) continue;
      const r0 = major ? 3.1 : 3.45;
      ctx.beginPath(); ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)); ctx.lineTo(cx + 3.8 * Math.cos(a), cy + 3.8 * Math.sin(a));
      ctx.strokeStyle = major ? 'rgba(240,240,236,0.9)' : 'rgba(240,240,236,0.55)'; ctx.lineWidth = major ? 0.11 : 0.05; ctx.stroke();
    }
    const nums = kind === 'h24' ? [[24, 0], [6, 6], [12, 12], [18, 18]] : kind === 'min' ? [[60, 0], [10, 10], [20, 20], [30, 30], [40, 40], [50, 50]] : [[60, 0], [20, 20], [40, 40]];
    const div = kind === 'h24' ? 24 : 60;
    for (const [label, v] of nums) {
      const a = Math.PI / 2 - v / div * TAU;
      P.text(String(label), cx + 2.42 * Math.cos(a), cy + 2.42 * Math.sin(a), 0.62, { weight: 500 });
    }
    const tag = kind === 'h24' ? '24H' : kind === 'min' ? 'MIN' : 'SEC';
    P.text(tag, cx, cy - 1.25, 0.42, { family: MICRO, weight: 400, color: 'rgba(233,233,228,0.75)', spacing: 0.05 });
  };
  subdial(SUB.min[0], SUB.min[1], 'min');
  subdial(SUB.sec[0], SUB.sec[1], 'sec');
  subdial(SUB.h24[0], SUB.h24[1], 'h24');
  // printing
  P.text('CHRONOGRAPH', 0, 6.4, 0.66, { family: MICRO, weight: 400, spacing: 0.12 });
  P.text('100M', 0, -12.55, 0.52, { family: MICRO, weight: 400, color: 'rgba(233,233,228,0.8)', spacing: 0.08 });
  // date window frame
  P.mm(); ctx.save(); ctx.translate(DATE_C[0], DATE_C[1]); ctx.rotate(deg(45));
  ctx.strokeStyle = 'rgba(240,240,236,0.85)'; ctx.lineWidth = 0.12; ctx.strokeRect(-1.08, -1.32, 2.16, 2.64); ctx.restore();
  P.px();
});

TEX.date = WX.canvasTex(1024, 1024, (ctx, N) => {
  const R = 13.2, P = WX.painter(ctx, N, R);
  ctx.fillStyle = '#efeee9'; ctx.fillRect(0, 0, N, N);
  for (let n = 1; n <= 31; n++) {
    const a = deg(-45) + (n - 1) * TAU / 31;
    P.text(String(n), 11.6 * Math.cos(a), 11.6 * Math.sin(a), 1.32, { weight: 600, color: '#111214', rot: a });
  }
});

TEX.bezel = WX.canvasTex(2048, 2048, (ctx, N) => {
  const R = 20.0, P = WX.painter(ctx, N, R);
  ctx.fillStyle = '#121315'; ctx.fillRect(0, 0, N, N);
  P.mm();
  for (let i = 0; i < 900; i++) {
    const a = i / 900 * TAU;
    ctx.beginPath(); ctx.moveTo(16.7 * Math.cos(a), 16.7 * Math.sin(a)); ctx.lineTo(20.0 * Math.cos(a), 20.0 * Math.sin(a));
    ctx.strokeStyle = `rgba(255,255,255,${0.015 + 0.02 * ((i * 7919) % 5) / 5})`; ctx.lineWidth = 0.03; ctx.stroke();
  }
  const vals = [500, 400, 300, 250, 200, 180, 160, 150, 140, 130, 120, 110, 100, 90, 85, 80, 75, 70, 65, 60];
  const numbered = new Set([500, 400, 300, 250, 200, 180, 150, 120, 100, 90, 80, 70, 60]);
  for (const v of vals) {
    const t = 3600 / v, a = Math.PI / 2 - t / 60 * TAU;
    ctx.beginPath(); ctx.moveTo(19.4 * Math.cos(a), 19.4 * Math.sin(a)); ctx.lineTo(19.92 * Math.cos(a), 19.92 * Math.sin(a));
    ctx.strokeStyle = 'rgba(236,236,232,0.9)'; ctx.lineWidth = numbered.has(v) ? 0.14 : 0.08; ctx.stroke();
    if (numbered.has(v)) P.text(String(v), 18.2 * Math.cos(a), 18.2 * Math.sin(a), 1.0, { weight: 500, rot: a - Math.PI / 2 });
  }
  const word = 'TACHYMETER';
  for (let i = 0; i < word.length; i++) {
    const a = deg(90 - 9 - i * 3.0);
    P.text(word[i], 18.2 * Math.cos(a), 18.2 * Math.sin(a), 0.78, { family: MICRO, weight: 400, rot: a - Math.PI / 2, color: 'rgba(236,236,232,0.85)' });
  }
  P.mm(); P.circle(0, 0, 16.95); ctx.strokeStyle = 'rgba(236,236,232,0.35)'; ctx.lineWidth = 0.05; ctx.stroke();
});

TEX.caseback = WX.canvasTex(1024, 1024, (ctx, N) => {
  const R = 17.6, P = WX.painter(ctx, N, R);
  ctx.fillStyle = '#b9bec4'; ctx.fillRect(0, 0, N, N);
  P.mm();
  for (let r = 0.2; r < R; r += 0.09) { P.circle(0, 0, r); ctx.strokeStyle = `rgba(${(r * 97) % 2 > 1 ? '255,255,255' : '40,44,50'},0.08)`; ctx.lineWidth = 0.05; ctx.stroke(); }
  P.circle(0, 0, 9.5); ctx.strokeStyle = 'rgba(30,32,36,0.6)'; ctx.lineWidth = 0.12; ctx.stroke();
  P.circle(0, 0, 16.8); ctx.strokeStyle = 'rgba(30,32,36,0.5)'; ctx.lineWidth = 0.1; ctx.stroke();
  // ring text, reading clockwise from the top
  const ring = 'STAINLESS STEEL  ·  WATER RESISTANT 10 BAR  ·  ';
  const step = 360 / (ring.length * 1.15);
  for (let i = 0; i < ring.length; i++) {
    const a = deg(90 - i * step * 1.15 * 0.87);
    P.text(ring[i], 13.2 * Math.cos(a), 13.2 * Math.sin(a), 1.0, { family: MICRO, weight: 400, color: 'rgba(36,38,42,0.85)', rot: a - Math.PI / 2 });
  }
  P.text('8T63-00T0', 0, 0.8, 1.7, { family: MICRO, weight: 400, color: 'rgba(30,32,36,0.9)', spacing: 0.08 });
  P.text('CAL. 8T63', 0, -2.2, 1.0, { family: MICRO, weight: 400, color: 'rgba(30,32,36,0.7)', spacing: 0.1 });
});

TEX.battery = WX.canvasTex(512, 512, (ctx, N) => {
  const R = 4.75, P = WX.painter(ctx, N, R);
  const g = ctx.createRadialGradient(N * 0.42, N * 0.4, 10, N / 2, N / 2, N / 2);
  g.addColorStop(0, '#f2f4f6'); g.addColorStop(1, '#a9b0b7');
  ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  P.text('SR936SW', 0, 0.9, 1.25, { weight: 600, color: '#2c3036' });
  P.text('1.55 V  ·  silver oxide', 0, -0.75, 0.62, { weight: 500, color: '#3a3f46' });
  P.text('+', 0, -2.55, 1.4, { weight: 500, color: '#3a3f46' });
});

// circuit traces are shared with the current-flow animation
const TRACE = {
  main: [[13.2, -4.6], [14.0, 0.4], [12.7, 6.2], [7.6, 11.9], [0, 13.7], [-4.6, 10.6]],
  toA: [[-6.6, 8.0], [-10.4, 7.6], [-13.2, 3.4], [-13.5, -0.6]],
  toB: [[-4.7, 10.3], [-0.4, 12.8], [3.2, 12.9]],
  toX: [[-7.4, 9.4], [-9.6, 6.6]],
};
TEX.circuit = WX.canvasTex(1024, 1024, (ctx, N) => {
  const R = 15.2, P = WX.painter(ctx, N, R);
  const g = ctx.createLinearGradient(0, 0, N, N); g.addColorStop(0, '#a5611f'); g.addColorStop(1, '#7b4314');
  ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  P.mm(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (pts, w) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineWidth = w; ctx.stroke(); };
  ctx.strokeStyle = '#d9a64b';
  line(TRACE.main, 0.42); line(TRACE.toA, 0.32); line(TRACE.toB, 0.32); line(TRACE.toX, 0.26);
  ctx.strokeStyle = 'rgba(217,166,75,0.55)';
  for (let i = 0; i < 7; i++) { const a = deg(30 + i * 22); line([[10.2 * Math.cos(a), 10.2 * Math.sin(a)], [14.3 * Math.cos(a + 0.05), 14.3 * Math.sin(a + 0.05)]], 0.16); }
  line([[-3.2, 12.6], [-1.0, 14.4], [9.6, 11.4], [12.0, 8.2]], 0.18);
  ctx.fillStyle = '#e8c16b';
  for (const p of [...TRACE.main, ...TRACE.toA, ...TRACE.toB]) { P.circle(p[0], p[1], 0.32); ctx.fill(); }
});

// ───────────────────────────── layers & materials ─────────────────────────────
const LAYER_EX = { bracelet: 0, case: 0, crown: 0, caseback: -16, chands: 19.6, bezel: 24, crystal: 30, hands: 19, dial: 14.5, date: 11, chrono: 7.5, motion: 4, plate: 0, drive: -4, circuit: -8, battery: -10.5, flow: 0, fork: 0 };
const LAYER_NAMES = Object.keys(LAYER_EX);
const watch = new THREE.Group(); watch.name = 'watch'; WX.scene.add(watch);
const L = {};
for (const n of LAYER_NAMES) { const g = new THREE.Group(); g.name = n; L[n] = { g, ex: LAYER_EX[n], mats: new Set(), op: -1 }; }
for (const n of LAYER_NAMES) (n === 'flow' || n === 'fork' ? L.circuit.g : watch).add(L[n].g);

const MATS = WX.MATS;
Object.assign(MATS, {
  bezelInsert: () => new THREE.MeshStandardMaterial({ map: TEX.bezel, metalness: 0.35, roughness: 0.4 }),
  caseback: () => new THREE.MeshStandardMaterial({ map: TEX.caseback, metalness: 1, roughness: 0.3 }),
  dial: () => new THREE.MeshStandardMaterial({ map: TEX.dial, metalness: 0.12, roughness: 0.55 }),
  dialEdge: () => new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.6 }),
  lume: () => new THREE.MeshStandardMaterial({ color: 0xe9f1ea, roughness: 0.55, emissive: 0x9fe6c9, emissiveIntensity: 0.14 }),
  dateRing: () => new THREE.MeshStandardMaterial({ map: TEX.date, roughness: 0.6 }),
  pcb: () => new THREE.MeshStandardMaterial({ map: TEX.circuit, metalness: 0.3, roughness: 0.5 }),
  batteryFace: () => new THREE.MeshStandardMaterial({ map: TEX.battery, metalness: 0.9, roughness: 0.22 }),
});
const matCache = {};
function reg(layer, m) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; L[layer].mats.add(m); return m; }
function M(layer, kind) { const k = layer + ':' + kind; return matCache[k] || (matCache[k] = reg(layer, MATS[kind]())); }
function MU(layer, kind) { return reg(layer, MATS[kind]()); }

function setLayerOpacity(name, op) {
  const l = L[name];
  if (Math.abs(l.op - op) < 1e-4) return;
  l.op = op;
  l.g.visible = op > 0.004;
  for (const m of l.mats) {
    const wantT = m.userData.baseTransparent || op < 0.995;
    if (m.transparent !== wantT) { m.transparent = wantT; m.needsUpdate = true; }
    m.opacity = m.userData.baseOpacity * op;
    if (!m.userData.baseTransparent) m.depthWrite = op > 0.6;
  }
}

function add(layer, geo, kind, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, typeof kind === 'string' ? M(layer, kind) : kind);
  m.position.set(x, y, z); (parent || L[layer].g).add(m); return m;
}
function anchor(key, parent, x, y, z) { return WX.anchor(key, L[parent] ? L[parent].g : parent, x, y, z); }

const GEARS = {};
function arbor(id, layer, pos, o, matKind) {
  const g = new THREE.Group(); g.position.set(pos[0], pos[1], 0); L[layer].g.add(g);
  if (o.w) {
    add(layer, WX.gearGeo(o.w, 0.12, o.spokes || 0), matKind, 0, 0, o.wz, g);
    add(layer, cylGeo(Math.max(0.3, pr(o.w) * 0.12), o.wz - 0.1, o.wz + 0.1, 20), matKind, 0, 0, 0, g);
  }
  if (o.p) add(layer, WX.gearGeo(o.p, 0.3, 0), matKind, 0, 0, o.pz, g);
  if (o.a) add(layer, cylGeo(o.ar || 0.1, o.a[0], o.a[1], 12), 'pin', 0, 0, 0, g);
  const gear = { id, g, x: pos[0], y: pos[1], w: o.w || 0, p: o.p || 0, ang: 0 };
  GEARS[id] = gear; return gear;
}
const LINKS = [];
function link(a, ag, b, bg) {
  const z1 = a[ag], z2 = b[bg], beta = Math.atan2(b.y - a.y, b.x - a.x);
  LINKS.push({ a, b, k: -z1 / z2, Phi: beta * (1 + z1 / z2) + Math.PI - 1.3 * TAU / z2 });
}
function runLinks() { for (const l of LINKS) { l.b.ang = l.a.ang * l.k + l.Phi; l.b.g.rotation.z = l.b.ang; } }
// ───────────────────────────── the case ─────────────────────────────
const PUSH_ANG = 34;
const parts = {};
(function buildCase() {
  const V = (r, z) => new THREE.Vector2(r, z);
  const prof = [V(16.0, -4.0), V(18.9, -4.0), V(19.9, -3.6), V(20.45, -2.6), V(20.6, -1.0), V(20.6, 3.4), V(20.45, 4.2), V(20.1, 4.6), V(16.45, 4.6), V(16.45, 2.7), V(16.0, 2.7), V(16.0, -4.0)];
  const caseGeo = new THREE.LatheGeometry(prof, 160); caseGeo.rotateX(Math.PI / 2);
  const cm = M('case', 'steel'); cm.side = THREE.DoubleSide;
  add('case', caseGeo, cm);
  // lugs: side profile in (y, z), extruded along x
  const lugShape = polyShape([[13.5, -2.9], [21.8, -2.6], [24.4, -1.9], [24.9, -0.6], [24.7, 1.2], [23.6, 2.3], [19.5, 3.2], [13.5, 3.5]]);
  const lugGeo = new THREE.ExtrudeGeometry(lugShape, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3, curveSegments: 8 });
  const perm = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  lugGeo.applyMatrix4(perm);
  for (const flip of [0, 1]) {
    const lg = new THREE.Group(); lg.rotation.z = flip * Math.PI; L.case.g.add(lg);
    add('case', lugGeo, 'steel', 10.45, 0, 0, lg);
    add('case', lugGeo, 'steel', -12.15, 0, 0, lg);
  }
  // pushers at 2 and 4 o'clock
  for (const [key, ang] of [['A', PUSH_ANG], ['B', -PUSH_ANG]]) {
    const g = new THREE.Group(); g.rotation.z = deg(ang) - Math.PI / 2; g.position.z = 2.3; L.case.g.add(g);
    add('case', cylY(1.35, 19.9, 21.5), 'steel', 0, 0, 0, g);
    const mov = new THREE.Group(); g.add(mov);
    add('case', cylY(0.95, 21.0, 23.1), 'brushed', 0, 0, 0, mov);
    add('case', cylY(1.42, 22.9, 24.1, 40), 'steel', 0, 0, 0, mov);
    add('case', cylY(0.32, 14.6, 21.0, 12), 'pin', 0, 0, 0, mov);
    parts['pusher' + key] = mov;
    anchor('pusher' + key, mov, 0, 24.1, 0);
  }
  // crown at 3 o'clock
  const cg = new THREE.Group(); cg.rotation.z = -Math.PI / 2; cg.position.z = 0.75; L.crown.g.add(cg);
  add('crown', cylY(1.55, 20.2, 21.4), 'steel', 0, 0, 0, cg);
  const crownMov = new THREE.Group(); cg.add(crownMov);
  const ks = new THREE.Shape(); const nk = 44;
  for (let i = 0; i <= nk * 2; i++) { const a = i / (nk * 2) * TAU, r = i % 2 ? 2.78 : 2.98; i ? ks.lineTo(r * Math.cos(a), r * Math.sin(a)) : ks.moveTo(r * Math.cos(a), r * Math.sin(a)); }
  const kg = new THREE.ExtrudeGeometry(ks, { depth: 3.0, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 2 });
  kg.rotateX(-Math.PI / 2); kg.translate(0, 21.4, 0);
  const knurl = add('crown', kg, 'steel', 0, 0, 0, crownMov);
  add('crown', cylY(2.2, 24.55, 24.75, 40), 'brushed', 0, 0, 0, crownMov);
  parts.crownMov = crownMov; parts.knurl = knurl;
  anchor('crown', crownMov, 0, 24.7, 0);
  anchor('bezel', L.bezel.g, -18.3 * Math.cos(deg(30)), 18.3 * Math.sin(deg(30)), 5.7);
})();

(function buildBracelet() {
  const links = [];
  const pieceGeo = (w, l) => { const g = new THREE.ExtrudeGeometry(roundRect(w, l, 0.6), { depth: 2.3, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3, curveSegments: 6 }); g.translate(0, 0, -1.15); return g; };
  const outer = pieceGeo(5.9, 4.5), center = pieceGeo(6.2, 4.5), endOuter = pieceGeo(5.9, 4.3), endCenter = pieceGeo(6.2, 4.3);
  for (const flip of [0, 1]) {
    const side = new THREE.Group(); side.rotation.z = flip * Math.PI; L.bracelet.g.add(side);
    const R = 21, y0 = 25.0;
    for (let i = 0; i < 8; i++) {
      const lk = new THREE.Group(); side.add(lk);
      if (i === 0) { lk.position.set(0, 22.7, 0.15); }
      else {
        const a = (i - 0.5) * 0.235;
        lk.position.set(0, y0 + R * Math.sin(a), -R + R * Math.cos(a) + 0.15); lk.rotation.x = -a;
      }
      const o = i === 0 ? endOuter : outer, c = i === 0 ? endCenter : center;
      add('bracelet', o, 'brushed', -6.75, 0, 0, lk); add('bracelet', o, 'brushed', 6.75, 0, 0, lk);
      add('bracelet', c, 'steel', 0, 0, 0, lk);
      links.push(lk);
    }
  }
})();

(function buildBezelCrystalBack() {
  const V = (r, z) => new THREE.Vector2(r, z);
  const prof = [V(16.7, 5.6), V(16.7, 4.6), V(20.55, 4.6), V(20.72, 4.9), V(20.62, 5.42), V(20.32, 5.62), V(16.7, 5.6)];
  const bg = new THREE.LatheGeometry(prof, 160); bg.rotateX(Math.PI / 2);
  const bm = M('bezel', 'steel'); bm.side = THREE.DoubleSide;
  add('bezel', bg, bm);
  add('bezel', new THREE.RingGeometry(16.95, 20.0, 160, 1), 'bezelInsert', 0, 0, 5.625);
  add('crystal', cylGeo(16.68, 5.0, 5.9, 120), 'glass');
  add('caseback', cylGeo(18.6, -5.0, -4.0, 120), 'brushed');
  const face = new THREE.CircleGeometry(17.6, 120); face.rotateY(Math.PI);
  add('caseback', face, 'caseback', 0, 0, -5.01);
  anchor('L_crystal', 'crystal', 5, 15.8, 5.9);
  anchor('L_bezel', 'bezel', 6, -19.4, 5.6);
  anchor('L_caseback', 'caseback', 6, -17.6, -4.5);
})();

// ───────────────────────────── dial, hands, date ─────────────────────────────
(function buildDial() {
  const s = new THREE.Shape(); s.absarc(0, 0, DIAL_R, 0, TAU, false);
  const c = DATE_C, t = [Math.cos(deg(45)), Math.sin(deg(45))], r = [Math.cos(deg(-45)), Math.sin(deg(-45))];
  const hw = 0.9, hh = 1.12;
  const corner = (a, b) => [c[0] + t[0] * a + r[0] * b, c[1] + t[1] * a + r[1] * b];
  const win = new THREE.Path(); [corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)].forEach((p, i) => i ? win.lineTo(p[0], p[1]) : win.moveTo(p[0], p[1])); win.closePath();
  s.holes.push(win);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.45, 0, TAU, true); s.holes.push(hole);
  const g = extrude(s, 2.8, 3.1, 160);
  TEX.dial.repeat.set(1 / (2 * DIAL_R), 1 / (2 * DIAL_R)); TEX.dial.offset.set(0.5, 0.5);
  add('dial', g, [M('dial', 'dial'), M('dial', 'dialEdge')]);
  // applied indices
  const bar = new THREE.BoxGeometry(0.82, 2.3, 0.32), lumeBar = new THREE.BoxGeometry(0.36, 1.8, 0.06);
  for (const h of [12, 1, 2, 4, 5, 7, 8, 10, 11]) {
    const a = deg(90 - 30 * h), rr = 13.55;
    const offs = h === 12 ? [-0.62, 0.62] : [0];
    for (const o of offs) {
      const px = rr * Math.cos(a) - o * Math.sin(a), py = rr * Math.sin(a) + o * Math.cos(a);
      const m = add('dial', bar, 'steel', px, py, 3.26); m.rotation.z = a - Math.PI / 2;
      const lm = add('dial', lumeBar, 'lume', px, py, 3.44); lm.rotation.z = a - Math.PI / 2;
    }
  }
  const ringGeo = new THREE.TorusGeometry(3.98, 0.06, 8, 96);
  for (const k of ['min', 'sec', 'h24']) add('dial', ringGeo, 'steel', SUB[k][0], SUB[k][1], 3.12);
  anchor('subMin', 'dial', SUB.min[0] - 2.6, SUB.min[1] + 2.4, 3.1);
  anchor('subSec', 'dial', SUB.sec[0] - 2.8, SUB.sec[1] - 2.2, 3.1);
  anchor('sub24', 'dial', SUB.h24[0] + 2.6, SUB.h24[1] + 2.4, 3.1);
  anchor('date', 'dial', DATE_C[0] + 0.6, DATE_C[1] - 0.6, 3.1);
  anchor('L_dial', 'dial', 6, -15.0, 3.1);
})();

const HANDS = {};
(function buildHands() {
  const hand = (key, pts, lumePts, z, x = 0, y = 0, hub = 0.9, layer = 'hands') => {
    const g = new THREE.Group(); g.position.set(x, y, 0); L[layer].g.add(g);
    add(layer, extrude(polyShape(pts), z, z + 0.1, 8), 'steel', 0, 0, 0, g);
    if (lumePts) add(layer, extrude(polyShape(lumePts), z + 0.1, z + 0.14, 8), 'lume', 0, 0, 0, g);
    add(layer, cylGeo(hub, z - 0.05, z + 0.14, 28), 'steel', 0, 0, 0, g);
    HANDS[key] = g; return g;
  };
  hand('hour', [[-0.78, 0], [-0.72, 7.4], [0, 9.2], [0.72, 7.4], [0.78, 0], [0.42, -1.5], [-0.42, -1.5]], [[-0.42, 1.8], [-0.4, 7.1], [0, 8.4], [0.4, 7.1], [0.42, 1.8]], 3.42, 0, 0, 1.0);
  hand('minute', [[-0.62, 0], [-0.55, 13.0], [0, 14.9], [0.55, 13.0], [0.62, 0], [0.36, -2.0], [-0.36, -2.0]], [[-0.32, 2.2], [-0.3, 12.6], [0, 13.9], [0.3, 12.6], [0.32, 2.2]], 3.62, 0, 0, 0.8);
  const ch = hand('chrono', [[-0.16, -4.4], [-0.2, 0], [-0.07, 15.6], [0.07, 15.6], [0.2, 0], [0.16, -4.4]], null, 3.86, 0, 0, 0.5, 'chands');
  add('chands', cylGeo(0.62, 3.86, 3.98, 28), 'steel', 0, -3.3, 0, ch);
  add('chands', cylGeo(0.3, 3.86, 4.12, 20), 'steel', 0, 0, 0, ch);
  const sub = [[-0.13, -0.9], [-0.16, 0], [-0.045, 3.45], [0.045, 3.45], [0.16, 0], [0.13, -0.9]];
  hand('subMin', sub, null, 3.3, SUB.min[0], SUB.min[1], 0.34, 'chands');
  hand('subSec', sub, null, 3.3, SUB.sec[0], SUB.sec[1], 0.34);
  hand('sub24', sub, null, 3.3, SUB.h24[0], SUB.h24[1], 0.34);
  anchor('chronoTip', 'chands', 0, 15.3, 3.9);
  anchor('L_hands', 'hands', 4.4, 9.0, 3.7);
})();

(function buildDate() {
  TEX.date.center.set(0.5, 0.5);
  const m = add('date', new THREE.RingGeometry(10.2, 13.2, 160, 1), 'dateRing', 0, 0, 2.62);
  parts.dateRing = m;
  anchor('L_date', 'date', 6, 11.6, 2.62);
  anchor('dateRing', 'date', 9.6, -10.6, 2.62);
})();

// ───────────────────────────── movement ─────────────────────────────
const POS = {};
POS.center = [0, 0];
POS.fourth = [SUB.sec[0], SUB.sec[1]];
POS.third = inter(POS.center, pr(75) + pr(10), POS.fourth, pr(64) + pr(8), p => p[0] < 0);
POS.fifth = polar(POS.fourth, pr(60) + pr(10), 200);
POS.rotorA = polar(POS.fifth, pr(50) + pr(10), 160);
POS.B2 = polar(POS.center, pr(60) + pr(10), 40);
POS.B1 = polar(POS.B2, pr(50) + pr(10), 20);
POS.rotorB = polar(POS.B1, pr(50) + pr(10), 60);
POS.MC = [SUB.min[0], SUB.min[1]];
POS.M1 = inter(POS.center, pr(8) + pr(48), POS.MC, pr(8) + pr(80), p => p[1] < 0);
POS.MW = polar(POS.center, pr(10) + pr(30), -20);
POS.W24 = [SUB.h24[0], SUB.h24[1]];
POS.I24 = inter(POS.center, pr(32) + pr(20), POS.W24, pr(64) + pr(20), p => p[1] > 0);
POS.SW = [POS.MW[0] + Math.sqrt(Math.pow(pr(30) + pr(20), 2) - Math.pow(-0.9 - POS.MW[1], 2)), -0.9];
POS.battery = [8.6, -6.2];
const HAMMER = { px: 10.5, py: 0.4, rest: -0.14, travel: 0.14, cs: { rmin: 0.4, rmax: 1.6 }, mc: { rmin: 0.4, rmax: 1.9 } };
const OPL = { px: 13.68, py: -5.61, travel: -0.152 };
const SWA = { px: 8.5, py: 12.3, travel: -0.1 };

(function buildPlate() {
  const s = new THREE.Shape(); s.absarc(0, 0, 15.4, 0, TAU, false);
  const bh = new THREE.Path(); bh.absarc(POS.battery[0], POS.battery[1], 4.9, 0, TAU, true); s.holes.push(bh);
  add('plate', extrude(s, -0.6, 0.6, 120), 'plate');
  const screw = cylGeo(0.75, 0.6, 0.85, 24), slot = new THREE.BoxGeometry(1.3, 0.22, 0.2);
  for (const [x, y] of [[-12.2, 7.6], [4.0, -13.6], [-2.5, 14.3], [13.6, 4.8]]) {
    add('plate', screw, 'pin', x, y, 0); add('plate', slot, 'dark', x, y, 0.85);
    add('plate', cylGeo(0.75, -0.85, -0.6, 24), 'pin', x, y, 0);
  }
  anchor('L_plate', 'plate', 6, -14.2, 0.6);
})();

const COILS = {};
function buildMotor(key, rotorPos, coilCenter, coilAngle, midPt, pinionZ, armTop) {
  const dir = [Math.cos(deg(coilAngle)), Math.sin(deg(coilAngle))];
  const half = 3.0;
  const e1 = [coilCenter[0] + dir[0] * half, coilCenter[1] + dir[1] * half];
  const e2 = [coilCenter[0] - dir[0] * half, coilCenter[1] - dir[1] * half];
  const e1c = [e1[0] + dir[0] * 0.55, e1[1] + dir[1] * 0.55], e2c = [e2[0] - dir[0] * 0.55, e2[1] - dir[1] * 0.55];
  // coil
  const cg = new THREE.Group(); cg.position.set(coilCenter[0], coilCenter[1], -1.9); cg.rotation.z = deg(coilAngle) - Math.PI / 2; L.drive.g.add(cg);
  const coilMat = MU('drive', 'coil');
  add('drive', cylY(0.85, -half, half, 40), coilMat, 0, 0, 0, cg);
  add('drive', cylY(0.35, -half - 0.6, half + 0.6, 16), 'stator', 0, 0, 0, cg);
  for (const y of [-half - 0.05, half + 0.05]) add('drive', cylY(0.95, y - 0.12, y + 0.12, 40), 'dark', 0, 0, 0, cg);
  // stator: ring around the rotor plus two arms back to the coil core
  const statMat = MU('drive', 'stator');
  const toward = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [p[0] + dx / l * d, p[1] + dy / l * d]; };
  add('drive', extrude(ringShape(0.82, 1.45), -1.74, -1.44, 40), statMat, rotorPos[0], rotorPos[1], 0);
  add('drive', extrude(barShape([e1c, toward(rotorPos, e1c, 1.25)], 1.1), -1.74, -1.44), statMat);
  const opp = [rotorPos[0] + armTop[0] * 1.25, rotorPos[1] + armTop[1] * 1.25];
  add('drive', extrude(barShape([e2c, midPt, opp], 1.1), -1.74, -1.44), statMat);
  for (const p of [e1c, e2c]) add('drive', cylGeo(0.5, -2.2, -1.44, 16), statMat, p[0], p[1], 0);
  // rotor: two-pole magnet on an arbor with a 10-leaf pinion
  const rotor = arbor('rotor' + key, 'drive', rotorPos, { p: 10, pz: pinionZ, a: [-2.3, Math.max(-1.2, pinionZ + 0.25)] }, key === 'A' ? 'brass' : 'nickel');
  const half1 = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 24, 1, false, 0, Math.PI); half1.rotateX(Math.PI / 2);
  const half2 = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 24, 1, false, Math.PI, Math.PI); half2.rotateX(Math.PI / 2);
  add('drive', half1, 'magN', 0, 0, -1.59, rotor.g); add('drive', half2, 'magS', 0, 0, -1.59, rotor.g);
  COILS[key] = { coilMat, statMat };
  anchor('coil' + key, 'drive', coilCenter[0], coilCenter[1], -1.05);
  anchor('rotor' + key, 'drive', rotorPos[0], rotorPos[1], -1.3);
}

(function buildDrive() {
  // timekeeping train (brass)
  const rA = POS.rotorA;
  buildMotor('A', rA, polar([0, 0], 12.6, 197), 287, [-9.7, -3.4], -2.0, [0.2, 0.98]);
  const fifth = arbor('fifth', 'drive', POS.fifth, { w: 50, wz: -2.0, p: 10, pz: -1.65, a: [-2.3, -1.3], spokes: 4 }, 'brass');
  const fourth = arbor('fourth', 'drive', POS.fourth, { w: 60, wz: -1.65, p: 8, pz: -1.35, a: [-2.3, 3.32], spokes: 5 }, 'brass');
  add('drive', cylGeo(0.42, 0.62, 0.95, 20), 'brass', 0, 0, 0, fourth.g);
  const third = arbor('third', 'drive', POS.third, { w: 64, wz: -1.35, p: 10, pz: -1.0, a: [-2.3, -0.7], spokes: 5 }, 'brass');
  const center = arbor('center', 'drive', POS.center, { w: 75, wz: -1.0, a: [-2.3, 0.7], ar: 0.2, spokes: 5 }, 'brass');
  link(GEARS.rotorA, 'p', fifth, 'w'); link(fifth, 'p', fourth, 'w'); link(fourth, 'p', third, 'w'); link(third, 'p', center, 'w');
  // stopwatch motor (its pinion reaches up through the plate)
  buildMotor('B', POS.rotorB, polar([0, 0], 12.7, 60), -30, [5.0, 8.4], 1.5, [-1, 0]);
  anchor('fifth', 'drive', POS.fifth[0] - 2.6, POS.fifth[1] + 0.4, -2.1);
  anchor('fourth', 'drive', POS.fourth[0] + 2.2, POS.fourth[1] - 2.0, -1.7);
  anchor('third', 'drive', POS.third[0] - 2.2, POS.third[1] + 1.4, -1.4);
  anchor('center', 'drive', 2.6, 2.4, -1.0);
  anchor('L_drive', 'drive', 6.35, 11.9, -1.05);
})();

(function buildChrono() {
  const B1 = arbor('B1', 'chrono', POS.B1, { w: 50, wz: 1.5, p: 10, pz: 1.8, a: [0.65, 2.0], spokes: 4 }, 'nickel');
  const B2 = arbor('B2', 'chrono', POS.B2, { w: 50, wz: 1.8, p: 10, pz: 2.1, a: [0.65, 2.3], spokes: 4 }, 'nickel');
  const CS = arbor('CS', 'chrono', POS.center, { w: 60, wz: 2.1, p: 8, pz: 1.5, spokes: 5 }, 'nickel');
  const M1 = arbor('M1', 'chrono', POS.M1, { w: 48, wz: 1.5, p: 8, pz: 1.8, a: [0.65, 2.0], spokes: 4 }, 'nickel');
  const MC = arbor('MC', 'chrono', POS.MC, { w: 80, wz: 1.8, a: [0.65, 3.32], spokes: 5 }, 'nickel');
  link(GEARS.rotorB, 'p', B1, 'w'); link(B1, 'p', B2, 'w'); link(B2, 'p', CS, 'w'); link(CS, 'p', M1, 'w'); link(M1, 'p', MC, 'w');
  add('chrono', cylGeo(0.09, 1.3, 3.95, 10), 'pin');
  // heart cams (notch toward +y when the hand is at zero)
  const heart = (rmin, rmax) => {
    const s = new THREE.Shape(), n = 96;
    for (let i = 0; i <= n; i++) {
      const phi = -Math.PI + TAU * i / n, r = rmin + (rmax - rmin) * Math.abs(phi) / Math.PI;
      const x = -r * Math.sin(phi), y = r * Math.cos(phi);
      i ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    const h = new THREE.Path(); h.absarc(0, 0, 0.14, 0, TAU, true); s.holes.push(h);
    return extrude(s, 2.23, 2.47, 8);
  };
  parts.heartCS = add('chrono', heart(HAMMER.cs.rmin, HAMMER.cs.rmax), 'blued', 0, 0, 0);
  parts.heartMC = add('chrono', heart(HAMMER.mc.rmin, HAMMER.mc.rmax), 'blued', POS.MC[0], POS.MC[1], 0);
  // hammer: local x runs from the pivot toward the hearts; striking faces sit on y = 0
  const hg = new THREE.Group(); hg.position.set(HAMMER.px, HAMMER.py, 0); L.chrono.g.add(hg);
  add('chrono', extrude(barShape([[0.5, 0.62], [-19.1, 0.62]], 0.8), 2.2, 2.5), 'blued', 0, 0, 0, hg);
  for (const x of [-10.5, -18.1]) add('chrono', extrude(polyShape([[x - 0.6, 0], [x + 0.6, 0], [x + 0.6, 0.3], [x - 0.6, 0.3]]), 2.2, 2.5), 'blued', 0, 0, 0, hg);
  // third point of Seiko's one-piece, three-pointed hammer (what it acts on is not documented, so it strikes nothing here)
  add('chrono', extrude(polyShape([[-14.9, 0.15], [-13.9, 0.15], [-14.1, 0.45], [-14.7, 0.45]]), 2.2, 2.5), 'blued', 0, 0, 0, hg);
  add('chrono', extrude(barShape([[0, 0.3], [0.73, -2.9]], 0.75), 2.2, 2.5), 'blued', 0, 0, 0, hg);
  add('chrono', cylGeo(0.95, 2.15, 2.55, 28), 'blued', 0, 0, 0, hg);
  add('chrono', cylGeo(0.42, 2.55, 2.7, 20), 'gold', 0, 0, 0, hg);
  parts.hammer = hg;
  // hammer operating lever (driven by pusher B)
  const og = new THREE.Group(); og.position.set(OPL.px, OPL.py, 0); L.chrono.g.add(og);
  const Lp = [12.0 - OPL.px, -8.1 - OPL.py], Up = [10.2 - OPL.px, -2.75 - OPL.py];
  add('chrono', extrude(barShape([Lp, [0, 0], Up], 0.7), 2.22, 2.48), 'steel', 0, 0, 0, og);
  add('chrono', cylGeo(0.8, 2.17, 2.53, 24), 'steel', 0, 0, 0, og);
  add('chrono', cylGeo(0.36, 2.53, 2.66, 16), 'gold', 0, 0, 0, og);
  parts.opLever = og;
  // switch lever A (spring contact for start/stop) and the two contact pads
  const sg = new THREE.Group(); sg.position.set(SWA.px, SWA.py, 0); L.chrono.g.add(sg);
  add('chrono', extrude(barShape([[0, 0], [3.4, -3.9]], 0.42), 2.26, 2.42), 'steel', 0, 0, 0, sg);
  add('chrono', cylGeo(0.55, 2.2, 2.5, 20), 'steel', 0, 0, 0, sg);
  parts.switchA = sg;
  parts.padA = MU('chrono', 'gold'); add('chrono', new THREE.BoxGeometry(0.8, 0.8, 0.3), parts.padA, 11.35, 7.85, 2.34);
  parts.padB = MU('chrono', 'gold'); add('chrono', new THREE.BoxGeometry(0.8, 0.8, 0.3), parts.padB, 11.15, -7.3, 2.34);
  anchor('switchA', 'chrono', 10.6, 10.2, 2.4);
  anchor('B1', 'chrono', POS.B1[0] + 1.8, POS.B1[1] - 1.8, 1.55);
  anchor('B2', 'chrono', POS.B2[0] + 0.6, POS.B2[1] + 2.2, 1.85);
  anchor('CS', 'chrono', -2.2, -2.6, 2.15);
  anchor('MC', 'chrono', POS.MC[0] - 3.4, POS.MC[1] - 2.6, 1.85);
  anchor('heartCS', 'chrono', 0.7, -1.0, 2.47);
  anchor('heartMC', 'chrono', POS.MC[0] - 0.4, POS.MC[1] - 1.5, 2.47);
  anchor('hammer', 'chrono', 6.2, 1.25, 2.5);
  anchor('opLever', 'chrono', 12.9, -6.6, 2.5);
  anchor('L_chrono', 'chrono', 6, -8.0, 2.3);
})();

(function buildMotion() {
  const cannon = arbor('cannon', 'motion', POS.center, { p: 10, pz: 0.9 }, 'brass');
  add('motion', cylGeo(0.2, 0.7, 3.66, 16), 'brass', 0, 0, 0, cannon.g);
  const MW = arbor('MW', 'motion', POS.MW, { w: 30, wz: 0.9, p: 8, pz: 1.35, a: [0.65, 1.55], spokes: 3 }, 'brass');
  const HW = arbor('HW', 'motion', POS.center, { w: 32, wz: 1.35, spokes: 4 }, 'brass');
  add('motion', cylGeo(0.3, 1.3, 3.46, 20), 'brass', 0, 0, 0, HW.g);
  const I24 = arbor('I24', 'motion', POS.I24, { w: 20, wz: 1.35, a: [0.65, 1.5] }, 'brass');
  const W24 = arbor('W24', 'motion', POS.W24, { w: 64, wz: 1.35, a: [0.65, 3.32], spokes: 5 }, 'brass');
  const SW = arbor('SW', 'motion', POS.SW, { w: 20, wz: 0.9, a: [0.65, 1.1] }, 'brass');
  link(cannon, 'p', MW, 'w'); link(MW, 'p', HW, 'w'); link(HW, 'w', I24, 'w'); link(I24, 'w', W24, 'w'); link(MW, 'w', SW, 'w');
  // stem + clutch (moves with the crown)
  const stem = new THREE.Group(); stem.rotation.z = -Math.PI / 2; stem.position.z = 0.75; L.motion.g.add(stem);
  add('motion', cylY(0.32, 6.3, 21.4, 16), 'pin', 0, 0, 0, stem);
  const clutchShape = new THREE.Shape(); const nk = 12;
  for (let i = 0; i <= nk * 2; i++) { const a = i / (nk * 2) * TAU, r = i % 2 ? 0.42 : 0.52; i ? clutchShape.lineTo(r * Math.cos(a), r * Math.sin(a)) : clutchShape.moveTo(r * Math.cos(a), r * Math.sin(a)); }
  const clg = new THREE.ExtrudeGeometry(clutchShape, { depth: 0.9, bevelEnabled: false }); clg.rotateX(-Math.PI / 2);
  const clutch = add('motion', clg, 'nickel', 0, 6.9, 0, stem);
  parts.stem = stem; parts.clutch = clutch;
  // train wheel setting lever: touches the seconds-wheel arbor when the crown is at the 2nd click
  const tg = new THREE.Group(); tg.position.set(4.6, -9.6, 0); L.motion.g.add(tg);
  parts.trainLeverMat = MU('motion', 'steel');
  add('motion', extrude(barShape([[0, 0], [-4.12, 2.0]], 0.4), 0.62, 0.86), parts.trainLeverMat, 0, 0, 0, tg);
  add('motion', cylGeo(0.5, 0.6, 0.9, 16), 'pin', 0, 0, 0, tg);
  parts.trainLever = tg;
  anchor('cannon', 'motion', -0.6, 1.0, 1.1);
  anchor('minuteWheel', 'motion', POS.MW[0] + 0.6, POS.MW[1] - 1.5, 1.0);
  anchor('hourWheel', 'motion', -1.4, -1.2, 1.4);
  anchor('wheel24', 'motion', POS.W24[0] + 2.2, POS.W24[1] + 2.6, 1.4);
  anchor('stem', 'motion', 15.5, 0, 0.75);
  anchor('clutch', 'motion', 7.4, 0.3, 1.0);
  anchor('settingWheel', 'motion', POS.SW[0], POS.SW[1] - 1.0, 0.95);
  anchor('trainLever', 'motion', 2.6, -8.8, 0.8);
  anchor('L_motion', 'motion', POS.W24[0] + 1.0, POS.W24[1] + 3.6, 1.4);
})();

(function buildCircuitBattery() {
  const s = new THREE.Shape(); const a0 = deg(-12), a1 = deg(212);
  s.absarc(0, 0, 15.0, a0, a1, false); s.absarc(0, 0, 8.8, a1, a0, true); s.closePath();
  TEX.circuit.repeat.set(1 / 30.4, 1 / 30.4); TEX.circuit.offset.set(0.5, 0.5);
  add('circuit', extrude(s, -2.9, -2.7, 96), [M('circuit', 'pcb'), M('circuit', 'gold')]);
  parts.chipMat = MU('circuit', 'chip');
  add('circuit', extrude(roundRect(2.6, 2.6, 0.2), -3.25, -2.9, 8), parts.chipMat, -6, 9, 0);
  // quartz crystal unit, lying along the rim
  const xa = Math.atan2(4, -11.5) + Math.PI / 2;
  const xg = new THREE.Group(); xg.position.set(-11.5, 4, -3.42); xg.rotation.z = xa - Math.PI / 2; L.circuit.g.add(xg);
  add('circuit', cylY(0.5, -2.5, 2.5, 28), 'steel', 0, 0, 0, xg);
  add('circuit', cylY(0.56, 2.2, 2.55, 28), 'brushed', 0, 0, 0, xg);
  add('circuit', cylY(0.05, -3.6, -2.4, 6), 'gold', 0.18, 0, 0, xg);
  add('circuit', cylY(0.05, -3.6, -2.4, 6), 'gold', -0.18, 0, 0, xg);
  // battery strap
  add('circuit', extrude(barShape([[13.4, -3.6], [11.6, -6.2], [8.6, -6.2]], 1.2), -3.75, -3.62), 'gold');
  anchor('ic', 'circuit', -6, 9, -3.25);
  anchor('xtal', 'circuit', -11.5, 4, -3.9);
  anchor('circuit', 'circuit', 11.2, 8.4, -2.9);
  anchor('L_circuit', 'circuit', 9.0, -11.6, -2.9);
  // battery: can faces the case back
  add('battery', cylGeo(4.75, -3.6, -0.05, 64), 'battery', POS.battery[0], POS.battery[1], 0);
  add('battery', cylGeo(4.0, -0.05, 0.08, 64), 'brushed', POS.battery[0], POS.battery[1], 0);
  const face = new THREE.CircleGeometry(4.7, 64); face.rotateY(Math.PI);
  add('battery', face, 'batteryFace', POS.battery[0], POS.battery[1], -3.61);
  anchor('battery', 'battery', POS.battery[0] + 3.4, POS.battery[1] - 3.4, -3.6);
  anchor('L_battery', 'battery', POS.battery[0], POS.battery[1] + 4.75, -1.8);
})();

// current flow + magnified tuning fork
const FLOW = [];
(function buildFx() {
  const curve = pts => new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], -3.05)));
  const paths = [
    { c: curve([[11.6, -6.2], ...TRACE.main]), n: 16 },
    { c: curve([[-6.0, 9.0], ...TRACE.toA]), n: 9 },
    { c: curve([[-6.0, 9.0], ...TRACE.toB]), n: 8 },
  ];
  const dot = new THREE.SphereGeometry(0.13, 10, 6), halo = new THREE.SphereGeometry(0.34, 10, 6);
  const gm = M('flow', 'glow');
  const hm = reg('flow', new THREE.MeshBasicMaterial({ color: 0x78c3ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  for (const p of paths) for (let i = 0; i < p.n; i++) {
    const m = new THREE.Mesh(dot, gm); m.add(new THREE.Mesh(halo, hm)); L.flow.g.add(m);
    FLOW.push({ m, c: p.c, off: i / p.n, len: p.c.getLength() });
  }
  // magnified fork inset (billboarded toward the camera)
  const f = new THREE.Group(); f.position.set(-19.5, 9.5, -8.5); f.scale.setScalar(0.82); L.fork.g.add(f);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.08, 8, 96), M('fork', 'steel')); f.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.35, 64), reg('fork', new THREE.MeshBasicMaterial({ color: 0x0b0f14, transparent: true, opacity: 0.72, depthWrite: false })));
  disc.position.z = -0.3; f.add(disc);
  const qm = M('fork', 'quartz');
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.55), qm); base.position.y = -2.9; f.add(base);
  const prongs = [];
  for (const sx of [-0.72, 0.72]) {
    const pg = new THREE.Group(); pg.position.set(sx, -2.15, 0); f.add(pg);
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.72, 6.0, 0.55), qm); prong.position.y = 3.0; pg.add(prong);
    const el = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.6, 0.06), M('fork', 'gold')); el.position.set(0, 2.9, 0.31); pg.add(el);
    prongs.push(pg);
  }
  parts.fork = f; parts.prongs = prongs;
  const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-11.5, 4, -3.42), new THREE.Vector3(-19.5, 9.5, -8.5)]);
  const line = new THREE.Line(lg, M('fork', 'leader')); line.computeLineDistances(); L.fork.g.add(line);
  anchor('fork', f, 4.0, 4.0, 0);
})();

// ───────────────────────────── simulation ─────────────────────────────
const BASE_TIME = 10 * 3600 + 8 * 60 + 37;
const S = {};
function resetSim() {
  Object.assign(S, {
    t: 0, accA: 0, stepsA: 0, lastA: -9, setOffset: 0,
    accB: 0, motorB: 0, chrono: 0, lastB: -9, running: false,
    pA: null, pB: null, hammer: 0, reset: null, cs: 0, mc: 0,
    crownPos: 0, crownAnim: 0, crownTurn: 0, crownAcc: 0, dateCount: 13, dateAnim: 13,
    pulses: [], toastMsg: null,
  });
}
resetSim();
function stepEase(a) { if (a <= 0) return 0; if (a > 0.14) return 1; return 1 - Math.exp(-a / 0.011) * Math.cos(a * 95); }
function disp(count, last) { return count <= 0 ? 0 : count - 1 + stepEase(S.t - last); }
function pulse(motor, t) { S.pulses.push({ motor, t, pol: motor === 'A' ? S.stepsA % 2 : S.motorB % 2 }); if (S.pulses.length > 600) S.pulses.splice(0, S.pulses.length - 600); }
function pusherValue(P) {
  if (!P) return 0;
  const a = S.t - P.t0, tin = 0.06, tout = 0.08;
  if (a < 0) return 0;
  if (a < tin) return ease(a / tin);
  if (a < tin + P.hold) return 1;
  if (a < tin + P.hold + tout) return 1 - ease((a - tin - P.hold) / tout);
  return 0;
}
function pressA(hold = 0.12) { if (S.pA && S.t - S.pA.t0 < 0.3) return; S.pA = { t0: S.t, hold, fired: false }; }
function pressB(hold = 0.14) { if (S.pB && S.t - S.pB.t0 < 0.3) return; S.pB = { t0: S.t, hold, fired: false, blocked: S.running }; if (S.running) S.toastMsg = 'Stop the stopwatch with A before resetting'; }
function hammerY(theta, x) { return HAMMER.py - (HAMMER.px - x) * Math.tan(theta); }
function heartLimit(y, h) { return Math.PI * clamp((y - h.rmin) / (h.rmax - h.rmin), 0, 1); }

function simStep(dt, c) {
  S.t += dt;
  const rate = c.rate || 1;
  // pusher A: the switch closes near the bottom of the stroke
  const pa = pusherValue(S.pA);
  if (S.pA && !S.pA.fired && pa > 0.85) {
    S.pA.fired = true;
    if (S.hammer < 0.02) {
      if (S.running) { S.running = false; }
      else if (S.chrono < 18000) { S.running = true; S.accB = 0; }
    }
  }
  // pusher B: drives the hammer through the operating lever (blocked while running)
  const pbRaw = pusherValue(S.pB);
  const pb = S.pB && S.pB.blocked ? Math.min(pbRaw, 0.16) : pbRaw;
  S.pbEff = pb;
  S.hammer = smooth((pb - 0.28) / 0.55);
  if (S.hammer > 0 && !(S.pB && S.pB.blocked)) {
    if (!S.reset && S.chrono > 0) S.reset = { cs0: -TAU * S.chrono / 300, mc0: -TAU * S.chrono / 18000 };
    if (S.reset) {
      const th = HAMMER.rest + HAMMER.travel * S.hammer;
      const yC = hammerY(th, 0), yM = hammerY(th, POS.MC[0]);
      const apply = (a0, lim) => { const w = wrapPi(a0); const wn = Math.sign(w) * Math.min(Math.abs(w), lim); return a0 - w + wn; };
      S.reset.csNow = apply(S.reset.cs0, heartLimit(yC, HAMMER.cs));
      S.reset.mcNow = apply(S.reset.mc0, heartLimit(yM, HAMMER.mc));
      S.reset.cs0 = S.reset.csNow; S.reset.mc0 = S.reset.mcNow;
      if (S.hammer > 0.995) { S.chrono = 0; S.accB = 0; S.reset = null; }
    }
    if (S.pB && !S.pB.fired && S.hammer > 0.9) { S.pB.fired = true; }
  }
  // crown
  S.crownAnim += (S.crownPos - S.crownAnim) * (1 - Math.exp(-dt / 0.07));
  const spin = (c.spin || 0) * dt;
  if (spin) {
    S.crownTurn += spin;
    if (S.crownPos === 1) { S.crownAcc += Math.abs(spin); while (S.crownAcc >= Math.PI) { S.crownAcc -= Math.PI; S.dateCount++; } }
    if (S.crownPos === 2) S.setOffset += spin / TAU * 360;
  }
  S.dateAnim += (S.dateCount - S.dateAnim) * (1 - Math.exp(-dt / 0.09));
  // motor A: one pulse per second unless the crown holds the circuit at the 2nd click
  if (S.crownPos === 2) { S.accA = 0; }
  else {
    S.accA += dt * rate;
    while (S.accA >= 1) { S.accA -= 1; S.stepsA++; S.lastA = S.t - S.accA / rate; pulse('A', S.lastA); }
  }
  // motor B: five pulses per second while running, auto-stop at 60 minutes
  if (S.running) {
    S.accB += dt * rate * 5;
    while (S.accB >= 1) {
      S.accB -= 1; S.motorB++; S.chrono++; S.lastB = S.t - S.accB / (rate * 5); pulse('B', S.lastB);
      if (S.chrono >= 18000) { S.running = false; S.accB = 0; break; }
    }
  }
}
function lastPulseAge(motor) { for (let i = S.pulses.length - 1; i >= 0; i--) if (S.pulses[i].motor === motor) return S.t - S.pulses[i].t; return 99; }

// ───────────────────────────── per-frame scene state ─────────────────────────────
function applyState(now) {
  const sA = disp(S.stepsA, S.lastA), sB = disp(S.motorB, S.lastB);
  const timeSec = BASE_TIME + sA + S.setOffset;
  HANDS.subSec.rotation.z = -TAU * (sA + 37) / 60;
  HANDS.minute.rotation.z = -TAU * (timeSec % 3600) / 3600;
  HANDS.hour.rotation.z = -TAU * (timeSec % 43200) / 43200;
  HANDS.sub24.rotation.z = -TAU * (timeSec % 86400) / 86400;
  // stopwatch hands follow the hearts during a reset
  let cs, mc;
  if (S.reset && S.reset.csNow !== undefined) { cs = S.reset.csNow; mc = S.reset.mcNow; }
  else { const c = S.chrono <= 0 ? 0 : S.chrono - 1 + stepEase(S.t - S.lastB); cs = -TAU * c / 300; mc = -TAU * c / 18000; }
  HANDS.chrono.rotation.z = cs; HANDS.subMin.rotation.z = mc;
  parts.heartCS.rotation.z = cs; parts.heartMC.rotation.z = mc;
  // gear trains
  GEARS.rotorA.ang = -Math.PI * sA; GEARS.rotorA.g.rotation.z = GEARS.rotorA.ang;
  GEARS.rotorB.ang = Math.PI * sB; GEARS.rotorB.g.rotation.z = GEARS.rotorB.ang;
  GEARS.cannon.ang = HANDS.minute.rotation.z; GEARS.cannon.g.rotation.z = GEARS.cannon.ang;
  runLinks();
  // coils glow with each pulse
  for (const k of ['A', 'B']) {
    const age = lastPulseAge(k), I = Math.exp(-Math.max(0, age) / 0.07);
    COILS[k].coilMat.emissive.setRGB(0.05 * I, 0.18 * I, 0.42 * I);
    COILS[k].statMat.emissive.setRGB(0.04 * I, 0.12 * I, 0.24 * I);
  }
  const ic = Math.exp(-Math.min(lastPulseAge('A'), lastPulseAge('B')) / 0.08);
  parts.chipMat.emissive.setRGB(0.02 * ic, 0.06 * ic, 0.12 * ic);
  // pushers, levers, hammer
  const pa = pusherValue(S.pA), pb = S.pbEff || 0;
  parts.pusherA.position.y = -0.6 * pa; parts.pusherB.position.y = -0.6 * pb;
  parts.switchA.rotation.z = SWA.travel * pa;
  parts.padA.emissive.setRGB(pa > 0.85 ? 0.5 : 0, pa > 0.85 ? 0.75 : 0, pa > 0.85 ? 1.0 : 0);
  parts.padB.emissive.setRGB(pb > 0.85 ? 0.5 : 0, pb > 0.85 ? 0.75 : 0, pb > 0.85 ? 1.0 : 0);
  parts.opLever.rotation.z = OPL.travel * clamp(pb / 0.85);
  parts.hammer.rotation.z = HAMMER.rest + HAMMER.travel * S.hammer;
  // crown, stem, clutch, date
  const ca = S.crownAnim;
  parts.crownMov.position.y = 0.9 * ca; parts.knurl.rotation.y = S.crownTurn;
  parts.stem.position.x = 0.9 * ca; parts.stem.rotation.y = 0;
  parts.clutch.position.y = 6.9 - 0.9 * ca - 0.45 * clamp(ca - 1); parts.clutch.rotation.y = S.crownTurn;
  const engaged = clamp(ca - 1);
  parts.trainLever.rotation.z = -0.16 * (1 - engaged);
  parts.trainLeverMat.emissive.setRGB(0.45 * engaged, 0.28 * engaged, 0.12 * engaged);
  parts.dateRing.rotation.z = -S.dateAnim * TAU / 31;
  // flow + fork
  for (const f of FLOW) { const u = (f.off + S.t * 6 / f.len) % 1; f.m.position.copy(f.c.getPointAt(u)); }
  parts.fork.quaternion.copy(WX.camera.quaternion);
  const amp = 0.05;
  parts.prongs[0].rotation.z = amp * Math.sin(TAU * 2.2 * S.t);
  parts.prongs[1].rotation.z = -amp * Math.sin(TAU * 2.2 * S.t);
}

window.WATCH = {
  root: watch, L, LAYER_NAMES, setLayerOpacity, S, resetSim, simStep, applyState, pressA, pressB, lastPulseAge,
  parts, HANDS, GEARS, POS, HAMMER, OPL, SWA, SUB, DATE_C, COILS, FLOW, TRACE, BASE_TIME, disp, stepEase, pusherValue,
};
})();
