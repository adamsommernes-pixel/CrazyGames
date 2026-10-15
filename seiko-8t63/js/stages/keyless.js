// Close-up stage "keyless": the crown's three positions, the keyless (setting) works and the cannon pinion's
// friction fit. An illustrative model of typical quartz keyless works, drawn about three times real size.
// Part names follow Seiko's 8T63A parts list; shapes, sizes and tooth counts are invented for clarity.
//
// Modes (p.mode): 'positions' | 'date' | 'time' | 'friction'
//   positions: crown 0 → 1 → 2 → 0 (p.at = [0.15, 0.45, 0.85] fractions of dur) or a fixed p.pos (0, 1, 2)
//   date:      crown at the 1st click, turning (p.spin rad/s, default 3); the date ring steps one date per half-turn
//   time:      crown at the 2nd click, turning (p.spin); hands turn, seconds train held, reset contact closed
//   friction:  cutaway of the cannon pinion on the centre arbor; running then setting (p.split = 0.45 of dur)
//   p.labels = false hides the stage's own part labels (use it when the shot supplies director labels).
WX.registerStage('keyless', function (ctx) {
  'use strict';
  const { THREE, WX, group, overlay } = ctx;
  const { TAU, clamp, lerp, smooth, deg } = WX;

  // ───────────── layout (stage mm, illustrative) ─────────────
  const MOD = 0.5;                     // wheel module (scaled up)
  const ZW = 2.0;                      // wheel plane (centre of 0.8 mm thick wheels)
  const ZS = 3.5;                      // stem axis height
  const STEP = 1.4;                    // stem travel per click
  const LZ0 = 4.9, LZ1 = 5.4;          // setting lever plane
  const YZ0 = 3.3, YZ1 = 3.7;          // yoke plane (level with the stem axis)
  const TZ0 = 1.8, TZ1 = 3.3;          // train wheel setting lever plane (level with the fourth wheel)
  const GX0 = 9.0;                     // stem groove x at position 0
  const R_PIN = 7.25;                  // setting lever pivot → pin
  const CL = { x0: 4.0, out: 1.1, len: 3.6, r: 2.0, rg: 1.45, h: 0.5, n: 6 };
  const L_F = 7.5;                     // yoke pivot → finger tip
  const PL = [GX0 + STEP, 7.6];        // setting lever pivot
  const PY = [CL.x0, 9.0];             // yoke pivot
  const PQ = [-3.0, 16.3];             // train wheel setting lever pivot
  const S = [-3.5, 0];                 // setting wheel (z16) under the stem tip
  const M = WX.polar(S, 11.5, 200);    // minute wheel (z30, pinion z8)
  const C = WX.polar(M, 10, 160);      // centre: cannon pinion (z10), hour wheel (z32)
  const I = [10.5, 0];                 // corrector intermediate wheel (z12) under the stem
  const D = WX.inter(C, 33.3, I, 6.0, q => q[1] < 0);   // date corrector wheel (z12 + 4 fingers)
  const F = [-10.0, 9.2];              // fourth (seconds) wheel (z20)
  const RING = { tip: 35.6, root: 37.0, out: 40.6, num: 38.8, a0: deg(-46), a1: deg(-4), win: deg(-21) };
  const STEPA = TAU / 31;

  // ───────────── helpers ─────────────
  const cylX = (r, x0, x1, seg = 32) => { const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); return g; };
  const add = (geo, m, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); (parent || group).add(o); return o; };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); (parent || group).add(g); return g; };
  const circ = (r, x = 0, y = 0) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, TAU, false); return s; };
  const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const addv = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const len = a => Math.hypot(a[0], a[1]);
  const norm = a => mul(a, 1 / (len(a) || 1));
  // polyline band with mitred joins and round end caps
  function band(pts, w) {
    const n = pts.length, h = w / 2, L = [], R = [];
    const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
    for (let i = 0; i < n; i++) {
      let nx, ny, k = 1;
      if (i === 0) [nx, ny] = nrm(pts[0], pts[1]);
      else if (i === n - 1) [nx, ny] = nrm(pts[n - 2], pts[n - 1]);
      else {
        const a = nrm(pts[i - 1], pts[i]), b = nrm(pts[i], pts[i + 1]);
        nx = a[0] + b[0]; ny = a[1] + b[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        k = 1 / Math.max(0.35, nx * a[0] + ny * a[1]);
      }
      L.push([pts[i][0] + nx * h * k, pts[i][1] + ny * h * k]);
      R.push([pts[i][0] - nx * h * k, pts[i][1] - ny * h * k]);
    }
    const s = new THREE.Shape();
    s.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) s.lineTo(L[i][0], L[i][1]);
    const ne = nrm(pts[n - 2], pts[n - 1]), aL = Math.atan2(ne[1], ne[0]);
    s.absarc(pts[n - 1][0], pts[n - 1][1], h, aL, aL - Math.PI, true);
    for (let i = n - 1; i >= 0; i--) s.lineTo(R[i][0], R[i][1]);
    const ns = nrm(pts[0], pts[1]), aR = Math.atan2(-ns[1], -ns[0]);
    s.absarc(pts[0][0], pts[0][1], h, aR, aR - Math.PI, true);
    return s;
  }
  const plateGeo = (shape, z0, z1, bev = 0.05) => WX.extrude(shape, z0, z1, 24, bev);
  function merge(geos) {
    let n = 0;
    const parts = geos.map(g => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return out;
  }
  // side ("face") teeth on the end of a sliding pinion: n trapezoid teeth between radii r1 and r2, height h along +Z
  function faceTeeth(n, r1, r2, h) {
    const prof = [];
    for (let i = 0; i < n; i++) for (const [f, z] of [[0, 0], [0.24, h], [0.5, h], [0.74, 0]]) prof.push([(i + f) / n * TAU, z]);
    const pos = [];
    const P = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];
    const quad = (a, b, c, d) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
    for (let k = 0; k < prof.length; k++) {
      const [a0, z0] = prof[k], [a1raw, z1] = prof[(k + 1) % prof.length];
      const a1 = k === prof.length - 1 ? a1raw + TAU : a1raw;
      quad(P(r1, a0, z0), P(r2, a0, z0), P(r2, a1, z1), P(r1, a1, z1));
      if (z0 > 0 || z1 > 0) {
        quad(P(r2, a0, 0), P(r2, a1, 0), P(r2, a1, z1), P(r2, a0, z0));
        quad(P(r1, a1, 0), P(r1, a0, 0), P(r1, a0, z0), P(r1, a1, z1));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  const gear = (z, thick, spokes = 0) => WX.gearGeo(z, thick, spokes, MOD);
  const tipR = z => MOD * z / 2 + MOD * 0.9;

  // ───────────── materials ─────────────
  const hl = m => { m.emissive = new THREE.Color(WX.COL.copper); m.emissiveIntensity = 0; return m; };
  const MAT = {
    brass: WX.mat('brass'), steel: WX.mat('steel'), pin: WX.mat('pin'), plate: WX.mat('plate'), gold: WX.mat('gold'),
    dark: WX.mat('dark'), nickel: WX.mat('nickel'),
    settingLever: hl(WX.mat('brushed')), yoke: hl(WX.mat('nickel')), jumper: hl(WX.mat('steel')), trainLever: hl(WX.mat('brushed')),
    clutch: hl(WX.mat('steel', { side: THREE.DoubleSide })), stem: WX.mat('steel'),
    pcb: new THREE.MeshStandardMaterial({ color: 0x8a521f, metalness: 0.35, roughness: 0.48 }),
    ring: new THREE.MeshStandardMaterial({ color: 0xe8e6df, metalness: 0.05, roughness: 0.62 }),
    hand: new THREE.MeshStandardMaterial({ color: 0xf1f1ec, metalness: 0.55, roughness: 0.3 }),
    mark: new THREE.MeshBasicMaterial({ color: WX.COL.copper, toneMapped: false }),
    cut: new THREE.MeshStandardMaterial({ color: 0xd9b46a, metalness: 0.55, roughness: 0.5, side: THREE.DoubleSide }),
    glow: WX.mat('glow'), glowWarm: WX.mat('glowWarm'), glowNeck: WX.mat('glowWarm'),
  };
  MAT.glowNeck.opacity = 0.5;

  const main = grp(group);           // keyless works
  const fr = grp(group);             // friction cutaway (own mode)

  // ───────────── plate ─────────────
  add(plateGeo(circ(42, C[0], C[1]), -0.8, 0, 0.2), MAT.plate, main);

  // ───────────── stem and crown ─────────────
  const stemG = grp(main, 0, 0, ZS);
  const stemR = grp(stemG);
  add(cylX(0.45, -2.6, -1.85, 20), MAT.stem, stemR);
  add(new THREE.BoxGeometry(7.9, 1.25, 1.25).translate(2.05, 0, 0), MAT.stem, stemR);
  add(cylX(0.85, 6.0, GX0 - 0.45), MAT.stem, stemR);
  add(cylX(0.45, GX0 - 0.45, GX0 + 0.45, 20), MAT.stem, stemR);
  add(cylX(0.85, GX0 + 0.45, 22.2), MAT.stem, stemR);
  add(cylX(1.55, 21.0, 23.3, 36), MAT.steel, stemR);
  const kg = WX.gearGeo(40, 3.3, 0, 0.16).clone(); kg.rotateY(Math.PI / 2); kg.translate(25.0, 0, 0);
  add(kg, MAT.steel, stemR);
  add(cylX(2.9, 26.6, 27.2, 40), MAT.steel, stemR);
  add(new THREE.BoxGeometry(3.4, 0.5, 0.2).translate(25.0, 0, 3.35), MAT.mark, stemR);   // marker so the turning reads
  add(new THREE.BoxGeometry(3.4, 0.5, 0.2).translate(25.0, 0, -3.35), MAT.mark, stemR);

  // ───────────── clutch wheel (sliding pinion) ─────────────
  const clG = grp(main, CL.x0, 0, ZS);
  const clR = grp(clG);
  {
    const h2 = CL.len / 2;
    const ft = faceTeeth(CL.n, 0.75, CL.r, CL.h);
    const inner = ft.clone().rotateY(-Math.PI / 2).translate(-h2, 0, 0);
    const outer = ft.clone().rotateY(Math.PI / 2).translate(h2, 0, 0);
    add(merge([cylX(CL.r, -h2, -0.42, 36), cylX(CL.r, 0.42, h2, 36), cylX(CL.rg, -0.42, 0.42, 36), inner, outer]), MAT.clutch, clR);
  }

  // ───────────── motion works ─────────────
  const wheel = (z, thick, spokes, x, y, zc, m = MAT.brass, parent = main) => { const g = grp(parent, x, y, zc); add(gear(z, thick, spokes), m, g); return g; };
  const gS = wheel(16, 0.8, 4, S[0], S[1], ZW);
  add(WX.cylGeo(0.5, -0.4, 0.6, 16), MAT.pin, gS);
  const gM = wheel(30, 0.8, 5, M[0], M[1], ZW);
  add(gear(8, 1.4, 0), MAT.brass, gM, 0, 0, 1.1);
  add(WX.cylGeo(0.5, -0.4, 2.0, 16), MAT.pin, gM);
  const gC = grp(main, C[0], C[1], 0);           // cannon pinion + minute hand
  add(gear(10, 0.8, 0), MAT.brass, gC, 0, 0, ZW);
  add(WX.cylGeo(1.25, ZW + 0.4, 6.75, 28), MAT.brass, gC);
  const minuteHand = add(plateGeo(WX.polyShape([[-0.5, -1.8], [0.5, -1.8], [0.3, 10.5], [0, 11.2], [-0.3, 10.5]]), 6.75, 6.9, 0.02), MAT.hand, gC);
  add(WX.cylGeo(1.0, 6.75, 7.0, 24), MAT.hand, gC);
  const gH = grp(main, C[0], C[1], 0);           // hour wheel + hour hand
  add(gear(32, 0.6, 5), MAT.brass, gH, 0, 0, 3.4);
  add(WX.cylGeo(1.8, 3.7, 6.25, 28), MAT.brass, gH);
  add(plateGeo(WX.polyShape([[-0.75, -1.4], [0.75, -1.4], [0.55, 6.2], [0, 7.0], [-0.55, 6.2]]), 6.25, 6.4, 0.02), MAT.hand, gH);
  const gA = grp(main, C[0], C[1], 0);           // centre arbor (part of the gear train) with its marker
  add(WX.cylGeo(0.6, 0, 7.35, 20), MAT.pin, gA);
  add(new THREE.BoxGeometry(0.34, 2.6, 0.12).translate(0, 1.1, 7.42), MAT.mark, gA);
  add(WX.cylGeo(0.62, 7.35, 7.4, 20), MAT.mark, gA);

  // ───────────── fourth (seconds) wheel ─────────────
  const gF = wheel(20, 0.8, 5, F[0], F[1], ZW);
  add(WX.cylGeo(0.45, -0.6, 1.0, 16), MAT.pin, gF);
  const secHand = grp(main, F[0], F[1], 0);
  add(plateGeo(WX.polyShape([[-0.22, -1.4], [0.22, -1.4], [0.12, 4.6], [0, 4.9], [-0.12, 4.6]]), 2.55, 2.68, 0.02), MAT.hand, secHand);
  add(WX.cylGeo(0.55, 2.4, 2.75, 20), MAT.hand, secHand);

  // ───────────── date corrector and date ring segment ─────────────
  const gI = wheel(12, 0.8, 0, I[0], I[1], ZW);
  add(WX.cylGeo(0.45, -1.4, 0.6, 16), MAT.pin, gI);
  const gD = grp(main, D[0], D[1], 0);
  add(gear(12, 0.8, 0), MAT.brass, gD, 0, 0, ZW);
  add(WX.cylGeo(0.55, 0.4, 2.6, 16), MAT.pin, gD);
  const fingers = grp(gD);
  {
    const sh = [circ(1.3)];
    for (let k = 0; k < 4; k++) sh.push(band([[0, 0], WX.polar([0, 0], 3.25, k * 90)], 0.75));
    for (const s of sh) add(plateGeo(s, 0.55, 1.05, 0.03), MAT.brass, fingers);
  }
  const ringBand = new THREE.Shape();
  ringBand.absarc(C[0], C[1], RING.out, RING.a0, RING.a1, false);
  ringBand.absarc(C[0], C[1], RING.root, RING.a1, RING.a0, true);
  add(plateGeo(ringBand, 0.5, 1.0, 0.03), MAT.ring, main);
  const ringRot = grp(main, C[0], C[1], 0);
  const toothGeo = plateGeo(WX.polyShape([[RING.root + 0.2, -1.55], [RING.tip + 0.25, -0.18], [RING.tip, 0], [RING.tip + 0.25, 0.18], [RING.root + 0.2, 1.55]]), 0.5, 1.0, 0.02);
  const teeth = [], nums = [];
  for (let k = 0; k < 31; k++) {
    const t = new THREE.Group(); ringRot.add(t); add(toothGeo, MAT.ring, t); teeth.push(t);
    const tp = WX.textPlane(String(k + 1), { size: 3.4, color: '#16181b', weight: 600 });
    tp.position.z = 1.06; ringRot.add(tp); nums.push(tp);
  }
  // fixed "date window" frame
  {
    const fw = new THREE.Shape(); const a = RING.win, cx = C[0] + RING.num * Math.cos(a), cy = C[1] + RING.num * Math.sin(a);
    const W = 3.9, H = 3.1, o = 0.28;
    const corner = (x, y) => addv([cx, cy], rot([x, y], a));
    [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]].forEach((p, i) => { const q = corner(...p); i ? fw.lineTo(q[0], q[1]) : fw.moveTo(q[0], q[1]); });
    const hole = new THREE.Path();
    [[-W / 2 + o, -H / 2 + o], [-W / 2 + o, H / 2 - o], [W / 2 - o, H / 2 - o], [W / 2 - o, -H / 2 + o]].forEach((p, i) => { const q = corner(...p); i ? hole.lineTo(q[0], q[1]) : hole.moveTo(q[0], q[1]); });
    fw.holes.push(hole);
    add(new THREE.ShapeGeometry(fw), MAT.mark, main, 0, 0, 1.12);
  }

  // ───────────── kinematics of the crown positions ─────────────
  const thL = s => Math.asin(clamp((GX0 + STEP * s - PL[0]) / R_PIN, -1, 1));         // setting lever angle (0 at the 1st click)
  const shift = s => (s <= 1 ? CL.out * smooth(s) : CL.out - 2 * CL.out * smooth(s - 1)); // clutch: mid → out → in
  const thY = s => Math.asin(shift(clamp(s, 0, 2)) / L_F);                              // yoke angle
  const YS = [3.0, 0.8];                                                                 // yoke stud (in the lever's slot)
  const YT = [-1.8, 4.2];                                                                // yoke tail (pushes the train lever)
  const studW = s => addv(PY, rot(YS, thY(s)));
  const tailW = s => addv(PY, rot(YT, thY(s)));

  // ───────────── setting lever (pivot PL; drawn at the 1st-click pose) ─────────────
  const slG = grp(main, PL[0], PL[1], 0);
  const J_LOC = WX.polar([0, 0], 7.0, 16);
  {
    const parts = [circ(1.75), band([[0, 0], [0, -R_PIN]], 1.4), band([[0, 0], J_LOC], 1.35)];
    // cam slot: the path of the yoke stud seen from the lever, so the slot steers the yoke exactly
    const path = [];
    for (let k = 0; k <= 40; k++) { const s = 2 * k / 40; path.push(rot(sub(studW(s), PL), -thL(s))); }
    const e0 = norm(sub(path[0], path[1])), e1 = norm(sub(path[40], path[39]));
    const ext = [addv(path[0], mul(e0, 0.5)), ...path, addv(path[40], mul(e1, 0.5))];
    const lobe = band(ext, 2 * 0.48 + 1.6);
    const slot = band(path, 0.96);
    lobe.holes.push(new THREE.Path(slot.getPoints(6)));
    parts.push(lobe);
    const mid = path[20], dir = norm(mid);
    parts.push(band([[0, 0], sub(mid, mul(dir, 0.48 + 0.4))], 1.3));
    for (const s of parts) add(plateGeo(s, LZ0, LZ1), MAT.settingLever, slG);
    add(WX.cylGeo(0.32, ZS + 0.3, LZ0 + 0.1, 16), MAT.pin, slG, 0, -R_PIN, 0);    // pin in the stem groove
    add(WX.cylGeo(0.42, LZ1 - 0.1, 6.15, 18), MAT.pin, slG, J_LOC[0], J_LOC[1], 0); // jumper stud
  }
  const screw = (x, y, z, r = 0.95) => { const g = grp(main, x, y, z); add(WX.cylGeo(r, 0, 0.32, 24), MAT.steel, g); add(new THREE.BoxGeometry(r * 1.7, 0.2, 0.1).translate(0, 0, 0.33), MAT.dark, g); return g; };
  screw(PL[0], PL[1], LZ1);

  // ───────────── yoke (pivot PY, finger in the clutch groove) ─────────────
  const yG = grp(main, PY[0], PY[1], 0);
  {
    const parts = [circ(1.3), band([[0, 0], [0, -(L_F - 1.15)]], 1.3), band([[0, 0], YS], 1.15), band([[0, 0], YT], 1.1), band([[0, -(L_F - 1.4)], [0, -L_F]], 0.66)];
    for (const s of parts) add(plateGeo(s, YZ0, YZ1), MAT.yoke, yG);
    add(WX.cylGeo(0.4, YZ1 - 0.1, LZ1 + 0.25, 16), MAT.pin, yG, YS[0], YS[1], 0);   // stud riding in the setting lever's slot
    add(WX.cylGeo(0.45, TZ0 + 0.1, YZ1, 16), MAT.pin, yG, YT[0], YT[1], 0);          // tail stud
  }
  screw(PY[0], PY[1], YZ1, 0.8);
  // yoke spring (illustrative): a thin leaf pressing on the yoke's finger arm
  const ySpring = grp(main, -0.6, 3.2, 0);
  add(plateGeo(band([[0, 0], [1.6, 0.9], [3.05, 2.9]], 0.32), YZ0, YZ1, 0.02), MAT.steel, ySpring);
  add(WX.cylGeo(0.45, 0, YZ1 + 0.1, 16), MAT.pin, ySpring);

  // ───────────── jumper (setting lever spring with three notches) ─────────────
  const R_ST = len(J_LOC), R_STUD = 0.42, ND = 0.4, NW = 0.75;
  const phiK = [0, 1, 2].map(k => Math.atan2(J_LOC[1], J_LOC[0]) + thL(k));
  const notchV = phi => { let a = 1e9; for (const p of phiK) a = Math.min(a, Math.abs(phi - p) * R_ST); return Math.max(0, 1 - (a / NW) * (a / NW)); };
  const AJ = addv(PL, WX.polar([0, 0], 13.2, 38));
  const jG = grp(main, AJ[0], AJ[1], 0);
  let jumperGain = 1;
  {
    const inner = [], outer = [];
    for (let phi = phiK[0] - deg(9); phi <= phiK[2] + deg(9.01); phi += deg(0.5)) {
      const re = R_ST + R_STUD - ND + ND * notchV(phi);
      inner.push(sub(addv(PL, [re * Math.cos(phi), re * Math.sin(phi)]), AJ));
      outer.push(sub(addv(PL, [(R_ST + 1.75) * Math.cos(phi), (R_ST + 1.75) * Math.sin(phi)]), AJ));
    }
    const blade = WX.polyShape(inner.concat(outer.reverse()));
    const midO = sub(addv(PL, WX.polar([0, 0], R_ST + 1.4, 26)), AJ);
    for (const s of [blade, band([[0, 0], mul(midO, 0.55), midO], 1.0), circ(1.2)]) add(plateGeo(s, LZ1 + 0.12, LZ1 + 0.55), MAT.jumper, jG);
    // which way (and how far) the notched edge moves away from the stud per radian of jumper rotation
    const pc = addv(PL, WX.polar([0, 0], R_ST + R_STUD, 18));
    const r0 = len(sub(pc, PL)), r1 = len(sub(addv(AJ, rot(sub(pc, AJ), 0.01)), PL));
    jumperGain = (r1 - r0) / 0.01;
  }
  screw(AJ[0], AJ[1], LZ1 + 0.55, 0.85);

  // ───────────── train wheel setting lever (pivot PQ) + reset contact ─────────────
  const tailN = tailW(1.5), push = norm(sub(tailW(2), tailN));
  const RA = addv(tailN, mul(push, 0.45 + 0.5));
  const thT = s => {               // smallest rotation that keeps the receiving arm clear of the yoke's tail stud
    if (s <= 1.5) return 0;
    const yt = tailW(s); let lo = 0, hi = 0.35;
    if (len(sub(addv(PQ, rot(sub(RA, PQ), 0)), yt)) >= 0.95) return 0;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (len(sub(addv(PQ, rot(sub(RA, PQ), m)), yt)) >= 0.95) hi = m; else lo = m; }
    return hi;
  };
  const TH_T2 = thT(2);
  const BF = WX.polar(F, tipR(20), 101);       // where the lever touches the fourth wheel
  const N2 = [-16.8, 14.6];                    // where the contact finger meets the gold pad (at the 2nd click)
  const tG = grp(main, PQ[0], PQ[1], 0);
  {
    const Bl = rot(sub(BF, PQ), -TH_T2), Nl = rot(sub(N2, PQ), -TH_T2), Rl = sub(RA, PQ);
    const up = rot([0, 1], -TH_T2);
    const over = addv(Bl, mul(up, 1.05));
    const parts = [circ(1.25), band([[0, 0], Rl], 1.0), band([[0, 0], over, addv(Nl, mul(up, 0.9))], 0.95),
      band([addv(Bl, mul(up, 0.9)), addv(Bl, mul(up, 0.3))], 0.6)];
    for (const s of parts) add(plateGeo(s, TZ0, TZ1), MAT.trainLever, tG);
    add(plateGeo(band([addv(Nl, mul(up, 0.9)), addv(Nl, mul(up, 0.22))], 0.44), TZ0, TZ1 - 0.5, 0.02), MAT.trainLever, tG);   // contact finger
  }
  screw(PQ[0], PQ[1], TZ1, 0.8);
  // circuit fragment with the reset pad
  add(plateGeo(WX.roundRect(6.4, 3.4, 0.5), 0.9, 1.3), MAT.pcb, main, N2[0] - 0.6, N2[1] - 2.0, 0);
  add(new THREE.BoxGeometry(2.0, 1.0, 1.25).translate(N2[0], N2[1] - 0.5, 1.3 + 0.625), MAT.gold, main);
  add(new THREE.BoxGeometry(3.6, 0.32, 0.06).translate(N2[0] - 2.4, N2[1] - 1.9, 1.33), MAT.gold, main);
  add(new THREE.BoxGeometry(0.32, 1.6, 0.06).translate(N2[0] - 0.6, N2[1] - 1.3, 1.33), MAT.gold, main);
  const glowPad = add(new THREE.SphereGeometry(0.7, 20, 12), MAT.glow, main, N2[0], N2[1], 2.4);
  const glowBrake = add(new THREE.SphereGeometry(0.6, 20, 12), MAT.glowWarm, main, BF[0], BF[1], ZW + 0.2);

  // ───────────── friction cutaway (separate assembly, axis +Y) ─────────────
  const FR = { rA: 1.0, yTop: 8.4 };
  const frArbor = grp(fr);
  add(WX.cylY(FR.rA, -8.5, FR.yTop, 32), MAT.pin, frArbor);
  add(new THREE.BoxGeometry(0.34, 15.5, 0.34).translate(0, 0, 0).translate(0, -0.6, FR.rA - 0.08), MAT.mark, frArbor);   // stripe
  add(plateGeo(band([[0, 0], [0, 3.2]], 0.55), 0, 0.22, 0.02).rotateX(-Math.PI / 2).translate(0, FR.yTop + 0.02, 0), MAT.mark, frArbor);
  add(WX.cylY(FR.rA + 0.02, FR.yTop - 0.02, FR.yTop + 0.05, 32), MAT.mark, frArbor);
  {
    const cw = gear(40, 0.9, 5).clone(); cw.rotateX(-Math.PI / 2); cw.translate(0, -7.0, 0);
    add(cw, MAT.brass, frArbor);
  }
  const frCannon = grp(fr);
  {
    const pg = gear(10, 2.0, 0).clone(); pg.rotateX(-Math.PI / 2); pg.translate(0, -0.6, 0);
    add(pg, MAT.brass, frCannon);
    add(plateGeo(WX.polyShape([[-0.45, -1.6], [0.45, -1.6], [0.3, 9.0], [0, 9.6], [-0.3, 9.0]]), 0, 0.2, 0.02).rotateX(-Math.PI / 2).translate(0, 7.62, 0), MAT.hand, frCannon);
  }
  // cannon pinion body as a section: a 260° shell with flat cut faces, kept facing the camera; markers carry the rotation
  const PROF = [[1.85, -1.6], [1.85, 2.6], [1.5, 3.1], [1.5, 4.5], [1.85, 5.0], [1.85, 7.6], [1.06, 7.6], [1.06, 4.75], [FR.rA, 4.4], [FR.rA, 3.2], [1.06, 2.85], [1.06, -1.6]];
  const CUT0 = deg(70), CUTL = deg(260);
  {
    const segs = [];
    for (let i = 0; i < PROF.length; i++) {
      const a = PROF[i], b = PROF[(i + 1) % PROF.length];
      segs.push(new THREE.LatheGeometry([new THREE.Vector2(a[0], a[1]), new THREE.Vector2(b[0], b[1])], 56, CUT0, CUTL));
    }
    add(merge(segs), new THREE.MeshStandardMaterial({ color: 0xf2cf86, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }), fr);
    const sec = WX.polyShape(PROF);
    for (const phi of [CUT0, CUT0 + CUTL]) { const g = new THREE.ShapeGeometry(sec); g.rotateY(phi - Math.PI / 2); add(g, MAT.cut, fr); }
  }
  const neckGlow = add(new THREE.CylinderGeometry(FR.rA + 0.05, FR.rA + 0.05, 1.2, 40, 1, true, CUT0, CUTL).translate(0, 3.8, 0), MAT.glowNeck, fr);
  const frMW = grp(fr);
  {
    const mw = gear(30, 0.9, 5).clone(); mw.rotateX(-Math.PI / 2); add(mw, MAT.brass, frMW);
    add(WX.cylY(0.5, -2.5, 1.0, 16), MAT.pin, frMW);
  }
  const FR_MW = [Math.cos(deg(200)) * 10, Math.sin(deg(200)) * 10];   // minute wheel position in the XZ plane (x, z)
  frMW.position.set(FR_MW[0], -0.6, -FR_MW[1]);

  // ───────────── anchors ─────────────
  const A = {};
  const anc = (key, parent, x, y, z) => (A[key] = ctx.anchor(key, parent, x, y, z));
  anc('crown', stemG, 25.0, 3.3, 0);
  anc('stem', stemG, 15.5, 0.9, 0);
  anc('settingLever', slG, 0.3, 3.2, LZ1);
  anc('jumper', jG, ...sub(addv(PL, WX.polar([0, 0], R_ST + 1.2, 30)), AJ), LZ1 + 0.55);
  anc('yoke', yG, 0, -3.2, YZ1);
  anc('clutch', clG, 0, CL.r, 0);
  anc('settingWheel', gS, -1.8, -2.6, 0.4);
  anc('minuteWheel', main, M[0] - 1.5, M[1] - 5.0, ZW + 0.4);
  anc('cannon', main, C[0], C[1], 6.8);
  anc('hourWheel', main, C[0] - 5.4, C[1] - 4.6, 3.7);
  anc('corrector', main, D[0] + 1.3, D[1] - 1.2, 1.1);
  anc('trainLever', tG, ...rot(sub(BF, PQ), -TH_T2).map((v, i) => v + [0.0, 1.6][i]), TZ1);
  anc('contact', main, N2[0], N2[1] - 0.5, 2.6);
  anc('arbor', main, C[0], C[1], 7.4);
  const AP = {   // anchor positions per assembly (friction mode moves 'arbor' and 'cannon' to the cutaway)
    arbor: { main: [main, C[0], C[1], 7.4], fr: [fr, 0, -4.5, 0] },
    cannon: { main: [main, C[0], C[1], 6.8], fr: [fr, 1.9, 6.2, 0] },
  };
  const extra = { neck: new THREE.Object3D(), hand: new THREE.Object3D(), centreWheel: new THREE.Object3D(), dateWin: new THREE.Object3D(), fourth: new THREE.Object3D(), pin: new THREE.Object3D(), notch: new THREE.Object3D() };
  extra.neck.position.set(0.0, 3.8, 0); fr.add(extra.neck);
  extra.hand.position.set(0, 7.8, 0); frCannon.add(extra.hand);
  extra.centreWheel.position.set(-8.5, -7.0, 2.0); fr.add(extra.centreWheel);
  extra.dateWin.position.set(C[0] + (RING.out + 0.4) * Math.cos(RING.win), C[1] + (RING.out + 0.4) * Math.sin(RING.win), 1.1); main.add(extra.dateWin);
  extra.fourth.position.set(F[0] - 3.6, F[1] - 3.0, ZW + 0.4); main.add(extra.fourth);
  extra.pin.position.set(0, -R_PIN, LZ1); slG.add(extra.pin);
  extra.notch.position.set(0, 0, 0); main.add(extra.notch);
  const placeAnchor = (key, where) => { const [par, x, y, z] = AP[key][where]; const o = A[key]; if (o.parent !== par) par.add(o); o.position.set(x, y, z); };

  // ───────────── 2D overlay ─────────────
  overlay.innerHTML = `
  <div class="kl-cards" style="position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0">
    <div class="ov-card kl-pos" style="left:360px;top:20px;min-width:300px">
      <div class="ov-k">Crown position</div>
      <div class="kl-steps" style="display:flex;gap:18px;margin-top:8px;font-family:'IBM Plex Mono',monospace"></div>
      <div class="kl-status ov-muted" style="margin-top:8px;font-size:12.5px;line-height:1.5;min-height:38px"></div>
    </div>
    <div class="ov-card kl-date" style="left:360px;top:20px;width:290px">
      <div class="ov-k">1st click · date setting</div>
      <div class="ov-eq" style="margin-top:4px">½ crown turn → <span class="ov-accent">+1 date</span></div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-top:2px"><span class="ov-muted" style="font-size:12.5px">date shown</span><span class="ov-big kl-dnum ov-accent">14</span></div>
      <div class="ov-muted" style="font-size:11.5px;margin-top:2px">small seconds keep running</div>
    </div>
    <div class="ov-card kl-time" style="left:360px;top:20px;width:330px">
      <div class="ov-k">2nd click · time setting</div>
      <div class="ov-eq" style="font-size:13.5px;line-height:1.55;margin-top:4px">crown → clutch → setting wheel<br>→ minute wheel → cannon pinion<br><span class="ov-muted">→ hour wheel → hour hand</span></div>
      <div class="kl-t2" style="margin-top:8px;font-size:12.5px;line-height:1.5">
        <div class="kl-t2a"><span class="ov-accent">■</span> lever holds the seconds wheel</div>
        <div class="kl-t2b"><span class="ov-pulse">■</span> reset contact closed: chip sends no pulses</div>
        <div class="kl-t2c ov-muted">push the crown in: next step exactly 1 s later</div>
      </div>
    </div>
    <div class="ov-card kl-fric" style="left:360px;top:20px;width:340px">
      <div class="ov-k">Cannon pinion · friction fit</div>
      <div class="kl-fsteps" style="display:flex;gap:16px;margin-top:8px;font-size:13px"></div>
      <div class="ov-eq kl-fnote" style="font-size:13.5px;margin-top:8px;line-height:1.45">friction fit: driven when running,<br>slips when setting</div>
    </div>
  </div>
  <svg class="kl-lines" width="100%" height="100%" style="left:0;top:0;width:100%;height:100%"></svg>
  <div class="kl-labs" style="position:absolute;inset:0"></div>`;
  const $ = s => overlay.querySelector(s);
  const ui = { cards: $('.kl-cards'), pos: $('.kl-pos'), steps: $('.kl-steps'), status: $('.kl-status'), date: $('.kl-date'), dnum: $('.kl-dnum'),
    time: $('.kl-time'), t2a: $('.kl-t2a'), t2b: $('.kl-t2b'), t2c: $('.kl-t2c'), fric: $('.kl-fric'), fsteps: $('.kl-fsteps'), fnote: $('.kl-fnote'), lines: $('.kl-lines'), labs: $('.kl-labs') };
  ui.steps.innerHTML = [['0', 'pushed in'], ['1', 'date'], ['2', 'time']].map(([n, t], i) =>
    `<div class="kl-step" data-i="${i}" style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:70px;transition:none">
       <div class="kl-dot" style="width:26px;height:26px;border-radius:50%;border:1.5px solid #5d6670;display:flex;align-items:center;justify-content:center;font-size:14px">${n}</div>
       <div class="kl-cap" style="font-size:11px;letter-spacing:0.04em">${t}</div></div>`).join('<div style="align-self:flex-start;margin-top:5px;color:#5d6670">·</div>');
  const stepEls = [...ui.steps.querySelectorAll('.kl-step')];
  ui.fsteps.innerHTML = '<div class="kl-f1"><span style="font-family:IBM Plex Mono,monospace">1</span> running: arbor drives it</div><div class="kl-f2"><span style="font-family:IBM Plex Mono,monospace">2</span> setting: arbor held, it slips</div>';
  const f1 = $('.kl-f1'), f2 = $('.kl-f2');
  const labEls = {};
  const labEl = k => {
    if (labEls[k]) return labEls[k];
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;font:500 12.5px "IBM Plex Sans",sans-serif;color:#ecebe6;padding:2px 7px;background:rgba(11,14,19,0.72);border:1px solid rgba(205,218,232,0.16);border-radius:4px;opacity:0';
    ui.labs.appendChild(d);
    return (labEls[k] = { el: d, text: '' });
  };

  // per-mode label sets: [anchor key, text, dx, dy] (dx/dy = text offset in px at 720p)
  const LABELS = {
    positions: [['crown', 'Crown', 30, -46], ['settingLever', 'Setting lever', 44, -40], ['pin', 'Pin in stem groove', 56, 30], ['jumper', 'Jumper: 3 notches', 50, -30],
      ['yoke', 'Yoke', -70, -20], ['clutch', 'Clutch wheel', -40, 66], ['corrector', 'Date corrector', 40, 46], ['settingWheel', 'Setting wheel', -40, 64]],
    date: [['clutch', 'Clutch wheel', -96, -50], ['corrector', 'Corrector wheel', 30, 52], ['dateWin', 'Date ring', 44, 10], ['crown', 'Crown: 1st click', 24, -50], ['fourth', 'Seconds: running', -70, -40]],
    time: [['clutch', 'Clutch wheel', 20, -64], ['settingWheel', 'Setting wheel', 10, 70], ['minuteWheel', 'Minute wheel', -40, 52], ['hourWheel', 'Hour wheel', -60, 40],
      ['arbor', 'Centre arbor: still', -150, -50], ['cannon', 'Cannon pinion + minute hand: turning', -60, -86],
      ['trainLever', 'Train wheel setting lever', 30, -44], ['contact', 'Reset contact', -60, -50], ['fourth', 'Seconds wheel: held', -60, 60]],
    friction: [['arbor', 'Centre arbor', -150, 30], ['cannon', 'Cannon pinion', 60, -40], ['neck', 'Pinched neck grips the arbor', 80, 30], ['hand', 'Minute hand', 60, -40], ['centreWheel', 'Centre wheel (gear train)', -60, 50]],
  };
  const keyObj = k => A[k] || extra[k];

  // ───────────── shot timing helpers ─────────────
  function crownSchedule(u, p, dur) {
    if (p.pos !== undefined) return { s: clamp(+p.pos, 0, 2), tStop: Infinity, tOpen: Infinity };
    const at = p.at || [0.15, 0.45, 0.85];
    const tr = Math.min(0.7, 0.07 * dur + 0.1), tr3 = Math.min(0.8, 0.08 * dur + 0.1);
    const t1 = at[0] * dur, t2 = at[1] * dur, t3 = at[2] * dur;
    const s = smooth((u - t1) / tr) + smooth((u - t2) / tr) - 2 * smooth((u - t3) / tr3);
    return { s, t1, t2, t3, tr, tr3, tStop: t2 + 0.85 * tr, tOpen: t3 + 0.3 * tr3 };
  }
  // seconds-hand tick value: a 1-step jump at the start of each second
  const tickV = x => Math.floor(x) - 1 + smooth((x - Math.floor(x)) / 0.12);
  const PHI0 = 0.35;

  // ───────────── pose ─────────────
  let last = { mode: 'positions', s: 0 };
  function pose(u, p, dur) {
    const mode = p.mode || 'positions';
    const isFr = mode === 'friction';
    main.visible = !isFr; fr.visible = isFr;
    placeAnchor('arbor', isFr ? 'fr' : 'main'); placeAnchor('cannon', isFr ? 'fr' : 'main');
    const spin = p.spin !== undefined ? +p.spin : 3;
    let s = 1, crownA = 0, secV = 0, hl = { lever: 0, yoke: 0, clutch: 0, jumper: 0, train: 0 };
    let sched = null;
    if (mode === 'positions') {
      sched = crownSchedule(u, p, dur); s = sched.s;
      if (u < sched.tStop) secV = tickV(u + PHI0);
      else { const v0 = tickV(sched.tStop + PHI0); secV = u < sched.tOpen ? v0 : v0 + Math.max(0, tickV(u - sched.tOpen)); }
      if (p.pos !== undefined) secV = p.pos >= 2 ? 0 : tickV(u + PHI0);
      const moving = sched.t1 !== undefined ? Math.max(WX.win(u, sched.t1 - 0.2, sched.t1 + sched.tr + 0.9, 0.25, 0.6), WX.win(u, sched.t2 - 0.2, sched.t2 + sched.tr + 0.9, 0.25, 0.6), WX.win(u, sched.t3 - 0.2, sched.t3 + sched.tr3 + 0.9, 0.25, 0.6)) : 0;
      hl = { lever: moving, yoke: moving, clutch: moving, jumper: moving, train: 0 };
    } else if (mode === 'date') {
      s = 1; crownA = -spin * u; secV = tickV(u + PHI0);
      hl.clutch = 0.35;
    } else if (mode === 'time') {
      s = 2; crownA = -spin * u; secV = 0;
      hl.clutch = 0.35;
    }
    s = clamp(s, 0, 2);
    // stem, clutch, levers
    stemG.position.x = STEP * s;
    stemR.rotation.x = crownA;
    clG.position.x = CL.x0 + shift(s);
    clR.rotation.x = crownA;
    slG.rotation.z = thL(s);
    yG.rotation.z = thY(s);
    ySpring.rotation.z = -0.35 * thY(s);
    const tT = thT(s); tG.rotation.z = tT;
    const stopK = TH_T2 > 0 ? clamp(tT / TH_T2) : 0;
    // jumper lift: the notched edge rides over the stud between detents
    const phiS = Math.atan2(J_LOC[1], J_LOC[0]) + thL(s);
    jG.rotation.z = (ND * (1 - notchV(phiS))) / jumperGain;
    // wheels
    const aDate = mode === 'date' ? crownA : 0, aTime = mode === 'time' ? crownA : 0;
    const aS = aTime * 6 / 16;
    gS.rotation.z = aS;
    const aM = -aS * 16 / 30 + WX.meshPhase(S[0], S[1], 16, M[0], M[1], 30);
    gM.rotation.z = aM;
    const aC = -aM * 30 / 10 + WX.meshPhase(M[0], M[1], 30, C[0], C[1], 10);
    gC.rotation.z = aC + deg(-128);
    gH.rotation.z = -aM * 8 / 32 + WX.meshPhase(M[0], M[1], 8, C[0], C[1], 32) + deg(-205);
    const aI = -aDate * 6 / 12;
    gI.rotation.z = aI;
    const phD = WX.meshPhase(I[0], I[1], 12, D[0], D[1], 12);
    const aD = -aI + phD;
    gD.rotation.z = aD;
    // date: one date per crown half-turn, pushed by a corrector finger
    const half = Math.max(0, -aDate) / Math.PI, k = Math.floor(half), f = half - k;
    const ringA = -STEPA * (k + smooth((f - 0.28) / 0.44));
    const alphaC = Math.atan2(D[1] - C[1], D[0] - C[0]);
    // the finger star turns with the corrector wheel; its phase puts a finger on the ring at mid-step
    fingers.rotation.z = alphaC + Math.PI / 4 - half * Math.PI / 2 - aD;
    const date0 = p.date0 || 14;
    for (let n = 0; n < 31; n++) {
      const aN = RING.win + (n + 1 - date0) * STEPA;                     // ring-local angle of number n+1
      let w = WX.wrapPi(aN + ringA);
      const vis = w > RING.a0 + 0.04 && w < RING.a1 - 0.03;
      nums[n].visible = vis;
      nums[n].position.set(RING.num * Math.cos(aN), RING.num * Math.sin(aN), 1.06);
      nums[n].rotation.z = aN;
      const aT = aN + STEPA / 2;
      teeth[n].rotation.z = aT;
      const wt = WX.wrapPi(aT + ringA);
      teeth[n].visible = wt > RING.a0 + 0.02 && wt < RING.a1 - 0.02;
    }
    ringRot.rotation.z = ringA;
    const shownDate = ((date0 - 1 + Math.round(-ringA / STEPA)) % 31) + 1;
    // fourth wheel and small seconds hand (one 6° step per second)
    gF.rotation.z = -secV * TAU / 60 + 0.1;
    secHand.rotation.z = -secV * TAU / 60 + deg(-40);
    // glows: lever on the seconds wheel (warm), reset contact closed (blue)
    const g2 = smooth((stopK - 0.85) / 0.15);
    glowBrake.material.opacity = 0.9 * g2; glowBrake.visible = g2 > 0.01; glowBrake.scale.setScalar(0.8 + 0.4 * g2);
    glowPad.material.opacity = 0.95 * g2; glowPad.visible = g2 > 0.01; glowPad.scale.setScalar(0.8 + 0.5 * g2);
    // highlights
    MAT.settingLever.emissiveIntensity = 0.28 * hl.lever; MAT.yoke.emissiveIntensity = 0.28 * hl.yoke;
    MAT.clutch.emissiveIntensity = 0.3 * hl.clutch; MAT.jumper.emissiveIntensity = 0.25 * hl.jumper;
    MAT.trainLever.emissiveIntensity = 0.3 * g2 * (mode === 'positions' ? 1 : 0.6);
    // friction cutaway
    let frInfo = null;
    if (isFr) {
      const tS = (p.split !== undefined ? p.split : 0.45) * dur;
      const wRun = p.run || 0.55, wSet = p.set || 2.2;
      const G = (t, r) => (t <= 0 ? 0 : t < r ? t * t * t / (r * r) - t * t * t * t / (2 * r * r * r) : r / 2 + (t - r));
      const t = u - tS;
      const arbor = -wRun * (Math.min(u, tS) + Math.max(0, t) - G(t, 0.35));
      const cannon = -wRun * (Math.min(u, tS) + Math.max(0, t) - G(t, 0.7)) - wSet * G(t, 0.7);
      frArbor.rotation.y = arbor;
      frCannon.rotation.y = cannon;
      frMW.rotation.y = -cannon * 10 / 30 + 0.2;
      const slipping = smooth(t / 0.5);
      MAT.glowNeck.opacity = 0.25 + 0.6 * slipping * (0.75 + 0.25 * Math.sin(u * 9));
      frInfo = { phase: t < 0 ? 1 : 2, k: slipping, slip: Math.abs(cannon - arbor) };
    }
    last = { mode, s, sched, shownDate, stopK, g2, frInfo, u, dur, p };
  }

  // ───────────── overlay ─────────────
  const fade = (el, o) => { el.style.opacity = o.toFixed(3); el.style.display = o > 0.003 ? '' : 'none'; };
  const pt = {};
  function drawOverlay(u, p, dur) {
    const L = last, mode = L.mode;
    const vw = WX.viewW || 1280, vh = WX.viewH || 720, k = vh / 720;
    ui.cards.style.transform = `scale(${(vw / 1280).toFixed(4)},${k.toFixed(4)})`;
    const inA = smooth((u - 0.15) / 0.5);
    fade(ui.pos, mode === 'positions' ? inA : 0);
    fade(ui.date, mode === 'date' ? inA : 0);
    fade(ui.time, mode === 'time' ? inA : 0);
    fade(ui.fric, mode === 'friction' ? inA : 0);
    if (mode === 'positions') {
      const cur = Math.round(L.s);
      stepEls.forEach((e, i) => {
        const on = i === cur, dot = e.firstElementChild;
        dot.style.borderColor = on ? '#e39a5c' : '#5d6670'; dot.style.color = on ? '#e39a5c' : '#9aa3ad';
        dot.style.background = on ? 'rgba(227,154,92,0.16)' : 'transparent';
        e.lastElementChild.style.color = on ? '#ecebe6' : '#7d8690';
      });
      const sc = L.sched;
      let st;
      if (cur === 0) st = (sc && u > sc.tOpen) ? '<span class="ov-pulse">contact open</span> · seconds restart exactly 1 s later' : 'normal running · crown turns nothing';
      else if (cur === 1) st = 'clutch slides out onto the date corrector<br>seconds keep running';
      else st = 'clutch slides in onto the setting wheel<br><span class="ov-accent">seconds stop</span> · <span class="ov-pulse">reset contact closed</span>';
      if (ui.status.dataset.v !== st) { ui.status.innerHTML = st; ui.status.dataset.v = st; }
    } else if (mode === 'date') {
      const d = String(L.shownDate);
      if (ui.dnum.textContent !== d) ui.dnum.textContent = d;
    } else if (mode === 'time') {
      fade(ui.t2a, smooth((u - 0.34 * dur) / 0.5)); fade(ui.t2b, smooth((u - 0.44 * dur) / 0.5)); fade(ui.t2c, smooth((u - 0.62 * dur) / 0.5));
    } else if (mode === 'friction') {
      const ph = L.frInfo ? L.frInfo.phase : 1;
      f1.style.color = ph === 1 ? '#ecebe6' : '#6f7882'; f2.style.color = ph === 2 ? '#e39a5c' : '#6f7882';
      fade(ui.fnote, smooth((u - (p.split !== undefined ? p.split : 0.45) * dur - 0.4) / 0.6));
    }
    // part labels
    const want = p.labels === false ? [] : (LABELS[mode] || []);
    const seen = new Set();
    let svg = '';
    want.forEach(([key, text, dx, dy], i) => {
      const o = keyObj(key); if (!o) return;
      let op = smooth((u - 0.5 - 0.25 * i) / 0.5);
      if (mode === 'time' && (key === 'trainLever' || key === 'contact' || key === 'fourth')) op *= smooth((u - 0.34 * dur - 0.3 * (key === 'contact')) / 0.5);
      if (mode === 'time' && (key === 'arbor' || key === 'cannon')) op *= smooth((u - 0.2 * dur) / 0.5);
      if (op <= 0.01) return;
      WX.project(o, pt);
      if (!pt.visible) return;
      const e = labEl(key + ':' + mode); seen.add(e);
      if (e.text !== text) { e.text = text; e.el.textContent = text; }
      const w = e.el.offsetWidth || text.length * 7, h = e.el.offsetHeight || 20;
      let tx = pt.x + dx * k, ty = pt.y + dy * k;
      let x0 = dx < 0 ? tx - w : tx, y0 = ty - h / 2;
      x0 = clamp(x0, 8, vw - w - 8); y0 = clamp(y0, 8, vh * 600 / 720 - h);
      if (x0 < 335 * k && y0 < 72 * k) y0 = 72 * k;
      e.el.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`;
      e.el.style.opacity = op.toFixed(3);
      const ex = dx < 0 ? x0 + w : x0, ey = y0 + h / 2;
      svg += `<line x1="${pt.x.toFixed(1)}" y1="${pt.y.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#e39a5c" stroke-width="1" opacity="${(0.8 * op).toFixed(3)}"/><circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.6" fill="#e39a5c" opacity="${op.toFixed(3)}"/>`;
    });
    for (const k2 in labEls) if (!seen.has(labEls[k2])) labEls[k2].el.style.opacity = 0;
    ui.lines.innerHTML = svg;
  }

  return {
    cameras: {
      overview: { t: [-2.5, 0.5, 3], yaw: 0.06, pitch: 0.4, dist: 98 },
      stem: { t: [10.5, 6.5, 4], yaw: 0.22, pitch: 0.5, dist: 52 },
      wheels: { t: [-9, 1, 3], yaw: -0.12, pitch: 0.42, dist: 84 },
      date: { t: [8.5, -6.5, 2], yaw: 0.18, pitch: 0.45, dist: 52 },
      friction: { t: [-1.5, 1.5, 0], yaw: 0.62, pitch: 0.32, dist: 62 },
    },
    update(u, p, T, dur) { pose(u, p || {}, dur || 10); },
    overlay(u, p, T, dur) { drawOverlay(u, p || {}, dur || 10); },
  };
});
