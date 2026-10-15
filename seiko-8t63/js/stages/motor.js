// Close-up stage: the Lavet-type stepping motor. The 8T63 has two of them: coil block A drives the
// timekeeping train (1 step/s), coil block B drives the stopwatch (5 steps/s).
// Model: scaled up and simplified (not to scale). A copper coil on a straight soft-iron core, a one-piece
// soft-iron stator whose two arms meet round a bore, two thin saturable bridges joining the pole halves,
// two notches in the bore wall that fix the rest position, and a two-pole disc magnet rotor with a pinion.
//
// Physics shown (simplified): at rest the magnet's poles face full iron, so its N/S boundary lines up
// with the two notches (45° off the pole axis). A coil pulse makes the left/right pole tips N/S; the
// rotor swings round, the pulse ends, and the notches pull it into the next rest position half a turn on.
// It always turns the same way (clockwise here). The next pulse must have the opposite polarity; the
// same polarity again only makes it twitch towards the field and fall back.
//
// Modes (p.mode): overview | rest | pulse | wrong | twin   (see the update() comments for params)
WX.registerStage('motor', function (ctx) {
  const { THREE, WX, group, overlay } = ctx;
  const { TAU, clamp, smooth, easeOut, deg } = WX;

  // ───────────── layout (stage mm, illustrative sizes) ─────────────
  const RB = 3.9;              // bore radius
  const RM = 3.4;              // magnet radius
  const SLOT = 0.75;           // half-width of the outer slots that leave the two bridges
  const NECK = 4.55;           // outer edge of each bridge (a bridge spans bore wall .. NECK)
  const BX = 8.2, BY = 5.6;    // pole-tip block half extents
  const AX0 = 8.2, AX1 = 12.2, ABOT = -2.0; // stator arms (x range, bottom)
  const YC = 9.0, ZC = 1.6;    // coil / core axis (core lies on the arm feet)
  const ATOP = YC + 2.0;
  const CORE_R = 1.0, CORE_X = 11.9, COIL_R = 2.3, COIL_X = 7.0, FL_R = 2.6;
  const NOTCH = [45, 225], NW = 7, ND = 0.7; // notch centres (deg), half-width (deg), depth (mm)
  const Z0 = -0.6, Z1 = 0.6;   // stator plate thickness
  const ZM = 0.9;              // magnet half thickness
  const REST = deg(135);       // magnet N direction at rest when the next pulse is "+"
  const TWX = 17;              // twin layout: motors at x = -TWX (A) and +TWX (B)
  const PW = 0.3;              // visible (slowed) pulse length, s
  const COL_FLUX = 0xffe3b8, COL_I = 0x78c3ff;
  const C_IRON = new THREE.Color(0x8e959c), C_N = new THREE.Color(0xd2493c), C_S = new THREE.Color(0x3a72d8);

  // ───────────── small local helpers ─────────────
  const P2 = (r, a) => [r * Math.cos(deg(a)), r * Math.sin(deg(a))];
  const dB = Math.asin(SLOT / RB) * 180 / Math.PI;
  // bore wall from angle a0 to a1 (degrees, either direction) with the two rectangular notches cut in
  function boreArc(a0, a1) {
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1), pts = [], edges = [];
    for (const c of NOTCH) for (const k of [-360, 0, 360]) { const cc = c + k; if (cc - NW > lo && cc + NW < hi) edges.push([cc - NW, cc + NW]); }
    const inside = a => edges.some(([e0, e1]) => a > e0 - 0.3 && a < e1 + 0.3);
    for (let a = lo; a < hi; a += 2.5) if (!inside(a)) pts.push({ a, r: RB, o: 0 });
    pts.push({ a: hi, r: RB, o: 0 });
    for (const [e0, e1] of edges) {
      pts.push({ a: e0, r: RB, o: 1 }, { a: e0, r: RB + ND, o: 2 });
      for (let a = e0 + 2.5; a < e1 - 1; a += 2.5) pts.push({ a, r: RB + ND, o: 3 });
      pts.push({ a: e1, r: RB + ND, o: 4 }, { a: e1, r: RB, o: 5 });
    }
    pts.sort((p, q) => p.a - q.a || p.o - q.o);
    if (a0 > a1) pts.reverse();
    return pts.map(q => P2(q.r, q.a));
  }
  // instanced beads that travel along one or more curves (one draw call), plus faint path lines;
  // update(phase, opacity)
  function beadSet(curves, counts, size, color, opts = {}) {
    const geo = new THREE.SphereGeometry(size, 10, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    const total = counts.reduce((a, b) => a + b, 0);
    const im = new THREE.InstancedMesh(geo, mat, total);
    im.frustumCulled = false; im.renderOrder = 6;
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const lines = opts.lines ? curves.map(c => { const l = new THREE.Line(WX.lineGeo(c.getSpacedPoints(240)), lineMat); l.renderOrder = 5; im.add(l); return l; }) : [];
    const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
    im.userData.update = (phase, op) => {
      let k = 0;
      curves.forEach((c, ci) => {
        const n = counts[ci];
        for (let i = 0; i < n; i++) {
          const t = ((i / n + phase) % 1 + 1) % 1;
          c.getPointAt(t, v);
          const s = opts.taper ? smooth(t / 0.035) * smooth((1 - t) / 0.035) : 1;
          m4.makeScale(s, s, s); m4.setPosition(v.x, v.y, v.z); im.setMatrixAt(k++, m4);
        }
      });
      im.instanceMatrix.needsUpdate = true;
      mat.opacity = op; lineMat.opacity = op * (opts.lines || 0); im.visible = op > 0.004;
    };
    im.userData.update(0, 0);
    return im;
  }
  const curve = (pts, closed) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0)), closed, 'centripetal'); c.arcLengthDivisions = 800; return c; };
  // curved arrow (arc in the XY plane, z fixed) used for "nudge" and "turns this way" hints
  function arcArrow(r, a0, a1, z, mat) {
    const g = new THREE.Group(), n = 28, pts = [];
    const aEnd = a1 - Math.sign(a1 - a0) * 9;
    for (let i = 0; i <= n; i++) { const a = deg(a0 + (aEnd - a0) * i / n); pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.16, 8, false), mat));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.3, 16), mat);
    const ae = deg(aEnd), tip = deg(a1), s = Math.sign(a1 - a0);
    cone.position.set(r * Math.cos((ae + tip) / 2), r * Math.sin((ae + tip) / 2), z);
    cone.rotation.z = (ae + tip) / 2 + (s > 0 ? 0 : Math.PI);   // cone +Y -> tangent direction of travel
    g.add(cone);
    return g;
  }

  // ───────────── shared geometry ─────────────
  const yb = Math.sqrt(RB * RB - SLOT * SLOT);
  const ext = shape => WX.extrude(shape, Z0, Z1, 64, 0);
  const GEO = {
    tipL: ext(WX.polyShape([[-SLOT, BY], [-BX, BY], [-BX, -BY], [-SLOT, -BY], ...boreArc(270 - dB, 90 + dB)])),
    tipR: ext(WX.polyShape([[SLOT, BY], ...boreArc(90 - dB, -90 + dB), [SLOT, -BY], [BX, -BY], [BX, BY]])),
    brT: ext(WX.polyShape([[-SLOT, NECK], [SLOT, NECK], ...boreArc(90 - dB, 90 + dB)])),
    brB: ext(WX.polyShape([[SLOT, -NECK], [-SLOT, -NECK], ...boreArc(270 - dB, 270 + dB)])),
    armL: ext(WX.polyShape([[-AX0, ABOT], [-AX0, ATOP], [-AX1, ATOP], [-AX1, ABOT + 1.2], [-AX1 + 1.2, ABOT]])),
    armR: ext(WX.polyShape([[AX0, ABOT], [AX1 - 1.2, ABOT], [AX1, ABOT + 1.2], [AX1, ATOP], [AX0, ATOP]])),
    core: new THREE.CylinderGeometry(CORE_R, CORE_R, 2 * CORE_X, 28).rotateZ(Math.PI / 2).translate(0, YC, ZC),
    coil: new THREE.CylinderGeometry(COIL_R, COIL_R, 2 * COIL_X, 56, 1, true).rotateZ(Math.PI / 2).translate(0, YC, ZC),
    shell: new THREE.CylinderGeometry(COIL_R + 0.14, COIL_R + 0.14, 2 * COIL_X - 0.1, 56, 1, true).rotateZ(Math.PI / 2).translate(0, YC, ZC),
    flange: new THREE.CylinderGeometry(FL_R, FL_R, 0.3, 48).rotateZ(Math.PI / 2),
    screw: WX.cylGeo(0.78, ZC + CORE_R - 0.15, ZC + CORE_R + 0.4, 28),
    slot: new THREE.BoxGeometry(1.25, 0.2, 0.2),
    arbor: WX.cylGeo(0.4, -2.0, 4.4, 20),
    collar: WX.cylGeo(0.8, ZM, ZM + 0.7, 28),
    pinion: WX.gearGeo(10, 1.1, 0, 0.26),
  };
  const half = new THREE.Shape(); half.moveTo(0, -RM); half.absarc(0, 0, RM, -Math.PI / 2, Math.PI / 2, false); half.lineTo(0, -RM);
  GEO.half = WX.extrude(half, -ZM, ZM, 48, 0);

  const coilTex = WX.TEX.coil.clone(); coilTex.needsUpdate = true; coilTex.repeat.set(1, 1.6);

  // current path: lead in -> helix round the coil -> lead out (left to right)
  const TURNS = 9, HX = COIL_X - 0.35, HR = COIL_R + 0.16;
  const TX = 5.0, TY = YC + 3.05, LX = 6.2, LY = YC + 2.75;   // lead terminals, lead bend
  const iPts = [[-TX, TY, ZC], [-LX, LY, ZC], [-HX, YC + HR + 0.25, ZC]];
  for (let i = 0; i <= 360; i++) {
    const f = i / 360, x = -HX + 2 * HX * f, ph = TAU * TURNS * f;
    iPts.push([x, YC + HR * Math.cos(ph), ZC + HR * Math.sin(ph)]);
  }
  iPts.push([HX, YC + HR + 0.25, ZC], [LX, LY, ZC], [TX, TY, ZC]);
  const CUR = curve(iPts, false);
  // coil flux during a pulse: three lanes round the magnetic circuit (bore -> right tip -> arm -> core -> left arm -> left tip)
  const ZF = 0.86, ZR = ZM + 0.2;
  const fluxCurves = [-1, 0, 1].map(j => {
    const right = [[RB + 0.7, 1.3 * j, ZF], [6.5, 1.0 * j + 1.4, ZF], [AX0 + 2 + 0.9 * j, 3.6, ZF], [AX0 + 2 + 0.9 * j, YC - 1.6, ZF], [AX0 + 2.4 + 0.4 * j, YC + 0.4 * j, ZC], [6.0, YC + 0.4 * j, ZC]];
    const left = right.map(q => [-q[0], q[1], q[2]]).reverse();
    return curve([[-RB + 0.4, 1.3 * j, ZR], [0, 1.3 * j, ZR], [RB - 0.4, 1.3 * j, ZR], ...right, ...left], true);
  });
  // the magnet's own flux at rest: N face -> iron (round both sides, through the bridges) -> S face -> through the magnet
  const restFluxCurves = [-1, 1].map(side => {
    const a0 = 135, pts = [[0, 0, ZR]];
    const rr = a => 4.6 + 0.33 * Math.cos(deg(4 * (a - 45)));
    pts.push([...P2(RM * 0.55, a0), ZR], [...P2(RB + 0.1, a0), ZF]);
    for (let k = 0; k <= 12; k++) { const a = a0 + side * 180 * k / 12; pts.push([...P2(rr(a), a), ZF]); }
    pts.push([...P2(RB + 0.1, a0 + 180), ZF], [...P2(RM * 0.55, a0 + 180), ZR]);
    return curve(pts, true);
  });

  // ───────────── one motor ─────────────
  function makeMotor(pinKind) {
    const g = new THREE.Group();
    const iron = WX.mat('stator');
    const tipL = WX.mat('stator'), tipR = WX.mat('stator');
    const coilMat = WX.mat('coil'); coilMat.map = coilTex;
    const add = (geo, mat, x = 0, y = 0, z = 0, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    add(GEO.tipL, tipL); add(GEO.tipR, tipR);
    add(GEO.brT, iron); add(GEO.brB, iron);
    add(GEO.armL, iron); add(GEO.armR, iron);
    add(GEO.core, iron);
    add(GEO.coil, coilMat);
    const shellMat = WX.mat('glow'); shellMat.opacity = 0;
    const shell = add(GEO.shell, shellMat); shell.renderOrder = 4;
    const plastic = WX.mat('plastic');
    for (const s of [-1, 1]) add(GEO.flange, plastic, s * (COIL_X + 0.15), YC, ZC);
    const pin = WX.mat('pin'), dark = WX.mat('dark');
    for (const s of [-1, 1]) { add(GEO.screw, pin, s * (AX0 + AX1) / 2, YC, 0); add(GEO.slot, dark, s * (AX0 + AX1) / 2, YC, ZC + CORE_R + 0.42).rotation.z = 0.5 * s; }
    // coil leads (fine copper wire) and their terminals
    const copper = WX.mat('copper');
    for (const s of [-1, 1]) {
      add(WX.tubeGeo([[s * HX, YC + HR + 0.1, ZC], [s * LX, LY, ZC], [s * TX, TY, ZC]], 0.09, 24), copper);
      add(WX.cylGeo(0.42, ZC - 0.25, ZC + 0.25, 20), copper, s * TX, TY, 0);
    }
    const term = {};
    for (const [k, txt, x] of [['Lp', '+', -TX], ['Lm', '−', -TX], ['Rp', '+', TX], ['Rm', '−', TX]]) {
      const t = WX.textPlane(txt, { size: 1.5, color: txt === '+' ? '#ffb27a' : '#9fd2ff', weight: 600 });
      t.position.set(x + (x < 0 ? 1.2 : -1.2), TY + 0.1, ZC); g.add(t); term[k] = t;
    }
    // rotor: two-pole magnet on an arbor with a pinion
    const rotor = new THREE.Group(); g.add(rotor);
    add(GEO.half, WX.mat('magN'), 0, 0, 0, rotor);
    add(GEO.half, WX.mat('magS'), 0, 0, 0, rotor).rotation.z = Math.PI;
    add(GEO.arbor, WX.mat('steel'), 0, 0, 0, rotor);
    add(GEO.collar, WX.mat(pinKind), 0, 0, 0, rotor);
    add(GEO.pinion, WX.mat(pinKind), 0, 0, ZM + 1.3, rotor);
    const rN = WX.textPlane('N', { size: 1.55, color: '#ffffff' }), rS = WX.textPlane('S', { size: 1.55, color: '#ffffff' });
    rN.position.set(2.3, 0, ZM + 0.03); rS.position.set(-2.3, 0, ZM + 0.03); rotor.add(rN, rS);
    // pole letters on the tips (shown while current flows)
    const pole = {};
    for (const [k, txt, x] of [['LN', 'N', -1], ['LS', 'S', -1], ['RN', 'N', 1], ['RS', 'S', 1]]) {
      const t = WX.textPlane(txt, { size: 3.0, color: txt === 'N' ? '#ffd9d3' : '#dbe9ff', weight: 600 });
      t.position.set(x * 6.15, 0, Z1 + 0.03); g.add(t); pole[k] = t;
    }
    // beads
    const cur = beadSet([CUR], [46], 0.17, COL_I, { taper: true });
    const flux = beadSet(fluxCurves, [15, 17, 19], 0.19, COL_FLUX, { lines: 0.4 });
    const rflux = beadSet(restFluxCurves, [12, 12], 0.16, COL_FLUX, { lines: 0.5 });
    g.add(cur, flux, rflux);
    const api = { g, rotor };
    // st: { alpha (magnet N direction), P (signed drive, + = left tip N), t (bead clock), rest (rest-flux opacity), beads }
    api.pose = st => {
      rotor.rotation.z = st.alpha;
      rN.rotation.z = rS.rotation.z = -st.alpha;
      const P = st.P || 0, I = Math.abs(P), pos = P > 0 ? I : 0, neg = P < 0 ? I : 0;
      coilMat.emissive.setRGB(0.03 * I, 0.13 * I, 0.36 * I);
      shellMat.opacity = 0.13 * I; shell.visible = I > 0.01;
      const N = [0.34, 0.035, 0.025], S = [0.025, 0.09, 0.4];
      tipL.emissive.setRGB(N[0] * pos + S[0] * neg, N[1] * pos + S[1] * neg, N[2] * pos + S[2] * neg);
      tipR.emissive.setRGB(S[0] * pos + N[0] * neg, S[1] * pos + N[1] * neg, S[2] * pos + N[2] * neg);
      tipL.color.copy(C_IRON).lerp(pos ? C_N : C_S, 0.85 * I);
      tipR.color.copy(C_IRON).lerp(pos ? C_S : C_N, 0.85 * I);
      pole.LN.material.opacity = pos; pole.RS.material.opacity = pos; pole.LS.material.opacity = neg; pole.RN.material.opacity = neg;
      for (const k in pole) pole[k].visible = pole[k].material.opacity > 0.01;
      // + pulse (left tip N) needs current right -> left through the winding: right terminal is +
      term.Rp.material.opacity = pos; term.Lm.material.opacity = pos; term.Lp.material.opacity = neg; term.Rm.material.opacity = neg;
      for (const k in term) term[k].visible = term[k].material.opacity > 0.01;
      const dir = P >= 0 ? 1 : -1, t = st.t || 0;
      const bk = st.beads === false ? 0 : 1;
      cur.userData.update(-dir * t * 0.32, I * 0.95 * bk);
      flux.userData.update(dir * t * 0.22, I * 0.85 * bk);
      rflux.userData.update(t * 0.09, st.rest || 0);
    };
    return api;
  }

  const M = makeMotor('brass');   // the motor (motor A in the twin layout)
  const MB = makeMotor('nickel'); // motor B (twin only)
  group.add(M.g, MB.g);
  MB.g.position.x = TWX; MB.g.visible = false;

  // rest-mode extras: dashed line through the notches (the N/S boundary settles on it) and a nudge arrow
  const leader = WX.mat('leader'); leader.dashSize = 0.55; leader.gapSize = 0.4; leader.color.set(WX.COL.copper); leader.depthTest = false;
  const nl = new THREE.Line(WX.lineGeo([[...P2(RB + 2.6, 45), ZR + 0.1], [...P2(RB + 2.6, 225), ZR + 0.1]]), leader);
  nl.computeLineDistances(); nl.renderOrder = 9; M.g.add(nl);
  const arrowMat = new THREE.MeshBasicMaterial({ color: WX.COL.copper, transparent: true, opacity: 1, depthWrite: false, toneMapped: false });
  const nudgeArrow = arcArrow(RB + 2.2, 150, 108, ZF + 0.1, arrowMat); M.g.add(nudgeArrow);
  const turnMat = new THREE.MeshBasicMaterial({ color: WX.COL.copper, transparent: true, opacity: 1, depthWrite: false, toneMapped: false });
  const turnArrow = arcArrow(RB + 2.2, 112, 62, ZF + 0.1, turnMat); M.g.add(turnArrow);

  // ───────────── label anchors (keys become 'motor:<key>') ─────────────
  ctx.anchor('coil', M.g, 0, YC + COIL_R, ZC + 0.4);
  ctx.anchor('core', M.g, -(AX1 - 0.25), YC, ZC + 0.3);
  ctx.anchor('stator', M.g, -(AX0 + AX1) / 2, 2.5, Z1);
  ctx.anchor('bridge', M.g, 0, (yb + NECK) / 2, Z1);
  ctx.anchor('notch', M.g, ...P2(RB + ND * 0.5, 225), Z1);
  ctx.anchor('rotor', M.g, 0, -2.4, ZM);
  ctx.anchor('pinion', M.g, 0, 0, ZM + 1.9);
  ctx.anchor('motorA', group, -TWX, -BY - 1.2, 0);
  ctx.anchor('motorB', group, TWX, -BY - 1.2, 0);

  // ───────────── timing ─────────────
  // fraction of a half turn done t s after a pulse starts: swing ~k*0.4 s, small overshoot, settle
  function stepS(t, k = 1) {
    if (t <= 0) return 0;
    const T1 = 0.42 * k, A = 0.07;
    if (t < T1) return (1 + A) * smooth(t / T1);
    const tau = t - T1, a = 7 / k, w = TAU / (0.32 * k);
    return 1 + A * Math.exp(-a * tau) * (Math.cos(w * tau) + (a / w) * Math.sin(w * tau));
  }
  // twitch: towards the field and back (0 -> 1 -> 0)
  function twitchS(t) {
    if (t <= 0) return 0;
    if (t < 0.24) return easeOut(t / 0.24);
    const tau = t - 0.24, a = 6, w = TAU / 0.5;
    return Math.exp(-a * tau) * (Math.cos(w * tau) + (a / w) * Math.sin(w * tau));
  }
  const env = (t, pw = PW, fo = 0.1) => t < 0 ? 0 : clamp(t / 0.04) * (1 - smooth((t - pw + fo * 0.5) / fo));
  const TWITCH = deg(18);
  function plan(p, dur) {
    const mode = p.mode || 'overview';
    const pulses = [];
    if (mode === 'pulse') {
      const n = p.count === undefined ? 1 : p.count, at = p.at === undefined ? 0.25 * dur : p.at, iv = p.interval === undefined ? 1.6 : p.interval, pol = p.pol === undefined ? 1 : p.pol;
      for (let i = 0; i < n; i++) pulses.push({ t: at + i * iv, pol: i % 2 ? -pol : pol });
    } else if (mode === 'wrong') {
      const at = p.at === undefined ? 0.2 * dur : p.at, iv = p.interval === undefined ? 0.4 * dur : p.interval, pol = p.pol === undefined ? 1 : p.pol;
      pulses.push({ t: at, pol }, { t: at + iv, pol });
    }
    // a pulse steps the rotor only if its polarity is the one the rotor's position needs
    let need = pulses.length ? pulses[0].pol : (p.pol || 1);
    const alpha0 = need > 0 ? REST : REST + Math.PI;
    for (const q of pulses) { q.step = q.pol === need; if (q.step) need = -need; }
    return { mode, pulses, alpha0 };
  }
  // rotor angle (steps turn clockwise; a wrong-polarity pulse twitches it back towards the field) and coil drive
  function stateAt(pl, u) {
    let alpha = pl.alpha0, P = 0;
    for (const q of pl.pulses) {
      const t = u - q.t;
      if (q.step) alpha -= Math.PI * stepS(t); else alpha += TWITCH * twitchS(t);
      P += q.pol * env(t);
    }
    return { alpha, P: clamp(P, -1, 1) };
  }
  // twin: real-speed pulse trains, both alternating polarity, first pulse "+"
  const TW = { A: { t0: 0.45, iv: 1.0 }, B: { t0: 0.25, iv: 0.2 } };
  function twinState(m, u) {
    const n = u < m.t0 ? 0 : Math.floor((u - m.t0) / m.iv) + 1;
    if (!n) return { alpha: REST, P: 0, n };
    const tl = m.t0 + (n - 1) * m.iv, pol = (n - 1) % 2 ? -1 : 1;
    return { alpha: REST - Math.PI * (n - 1) - Math.PI * stepS(u - tl, 0.14), P: pol * env(u - tl, 0.07, 0.05), n };
  }
  const nudgeAt = (p, dur) => p.nudgeAt === undefined ? 0.55 * dur : p.nudgeAt;
  function nudgeS(t) { // rotor pushed 32° clockwise, released at 0.9 s, springs back to the detent
    if (t <= 0) return 0;
    if (t < 0.9) return smooth(t / 0.6);
    const tau = t - 0.9, a = 4.5, w = TAU / 0.6;
    return Math.exp(-a * tau) * (Math.cos(w * tau) + (a / w) * Math.sin(w * tau));
  }

  // ───────────── 2D overlay ─────────────
  const SW = 300, SH = 104, SX0 = 26, SX1 = SW - 8, SBASE = 52, SAMP = 26;
  overlay.innerHTML = `
    <div class="ov-card mo-scope" style="left:912px;top:282px;width:${SW}px;opacity:0">
      <div class="ov-k">Coil current</div>
      <svg width="${SW}" height="${SH}" style="position:relative;display:block;margin-top:6px"></svg>
      <div class="ov-muted" style="font-size:11.5px;margin-top:2px">pulse width: a few ms <span class="ov-pulse">(slowed)</span></div>
      <div class="mo-verdict ov-accent" style="font-family:'IBM Plex Mono',monospace;font-size:13px;margin-top:6px;opacity:0">same polarity twice: no step</div>
    </div>
    <div class="ov-card mo-rest" style="left:912px;top:282px;width:300px;opacity:0">
      <div class="ov-k">No current</div>
      <div style="font-size:13.5px;line-height:1.45;margin-top:5px">The magnet's own flux closes through the iron. Its N/S boundary settles on the line through the two notches.</div>
      <div class="mo-held ov-accent" style="font-size:13px;margin-top:6px;opacity:0">Nudged, it springs back: held in place.</div>
    </div>
    <div class="mo-twin" data-m="A" style="position:absolute;left:0;top:0;opacity:0"></div>
    <div class="mo-twin" data-m="B" style="position:absolute;left:0;top:0;opacity:0"></div>
    <div class="mo-twinnote ov-muted" style="position:absolute;left:0;right:0;top:0;text-align:center;font:12px 'IBM Plex Mono',monospace;opacity:0">pulse rates at real speed</div>
    <div class="mo-labels"></div>
    <div class="mo-tag ov-muted" style="position:absolute;right:24px;top:578px;font:11px 'IBM Plex Mono',monospace;letter-spacing:0.08em;text-transform:uppercase">Not to scale</div>`;
  const $ = s => overlay.querySelector(s);
  const scopeCard = $('.mo-scope'), scopeSvg = $('.mo-scope svg'), verdict = $('.mo-verdict');
  const restCard = $('.mo-rest'), held = $('.mo-held');
  const twinEls = { A: $('.mo-twin[data-m="A"]'), B: $('.mo-twin[data-m="B"]') }, twinNote = $('.mo-twinnote');
  const labLayer = $('.mo-labels');
  twinEls.A.innerHTML = twinCard('Time motor · 1 pulse/s');
  twinEls.B.innerHTML = twinCard('Stopwatch motor · 5 pulses/s');
  function twinCard(title) {
    return `<div class="ov-card" style="position:relative;transform:translate(-50%,0);padding:8px 12px;white-space:nowrap">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13.5px">${title.replace(/^([AB])/, '<span class="ov-accent">$1</span>')}</div>
      <svg width="250" height="30" style="position:relative;display:block;margin-top:6px"></svg></div>`;
  }
  let scopeKey = '';
  function buildScope(pl, dur) {
    const X = t => SX0 + (SX1 - SX0) * clamp(t / dur);
    let s = `<line x1="${SX0}" y1="${SBASE}" x2="${SX1}" y2="${SBASE}" stroke="rgba(205,218,232,0.28)" stroke-width="1"/>`;
    s += `<text x="4" y="${SBASE - SAMP + 9}" font-size="13" style="fill:#9aa3ad">+</text><text x="4" y="${SBASE + SAMP + 2}" font-size="13" style="fill:#9aa3ad">−</text><text x="4" y="${SBASE + 4}" font-size="10" style="fill:#6f7882">0</text>`;
    s += `<text x="${SX1}" y="${SH - 2}" font-size="10" text-anchor="end" style="fill:#6f7882">time →</text>`;
    // trace: baseline with a rectangular pulse for each pulse
    let d = `M${SX0},${SBASE}`;
    pl.pulses.forEach(q => { const xa = X(q.t), xb = Math.max(xa + 5, X(q.t + PW)), y = SBASE - q.pol * SAMP; d += ` L${xa.toFixed(1)},${SBASE} L${xa.toFixed(1)},${y} L${xb.toFixed(1)},${y} L${xb.toFixed(1)},${SBASE}`; });
    d += ` L${SX1},${SBASE}`;
    pl.pulses.forEach((q, i) => {
      const xa = X(q.t), xb = Math.max(xa + 5, X(q.t + PW)), y = q.pol > 0 ? SBASE - SAMP : SBASE;
      s += `<rect class="pz" data-i="${i}" x="${xa.toFixed(1)}" y="${y}" width="${(xb - xa).toFixed(1)}" height="${SAMP}" style="fill:#78c3ff" opacity="0.2"/>`;
      s += `<text x="${((xa + xb) / 2).toFixed(1)}" y="${q.pol > 0 ? SBASE - SAMP - 5 : SBASE + SAMP + 13}" font-size="12" text-anchor="middle" style="fill:${pl.mode === 'wrong' && i === 1 ? '#e39a5c' : '#78c3ff'}">${q.pol > 0 ? '+' : '−'}</text>`;
      if (pl.mode === 'wrong' && i === 1) {
        // the pulse that was needed: opposite polarity (dashed ghost)
        const yg = q.pol > 0 ? SBASE : SBASE - SAMP;
        s += `<rect x="${xa.toFixed(1)}" y="${yg}" width="${(xb - xa).toFixed(1)}" height="${SAMP}" fill="none" stroke="#9aa3ad" stroke-dasharray="3 2" stroke-width="1"/>`;
        s += `<text x="${(xb + 5).toFixed(1)}" y="${q.pol > 0 ? SBASE + SAMP - 6 : SBASE - SAMP + 12}" font-size="10.5" style="fill:#9aa3ad">needed ${q.pol > 0 ? '−' : '+'}</text>`;
      }
    });
    s += `<path d="${d}" fill="none" stroke="#78c3ff" stroke-width="1.6" stroke-linejoin="round"/>`;
    s += `<line class="ph" x1="0" y1="${SBASE - SAMP - 16}" x2="0" y2="${SBASE + SAMP + 16}" stroke="#e39a5c" stroke-width="1.4"/>`;
    scopeSvg.innerHTML = s;
  }
  function twinStrip(svg, m, u) {
    const W = 250, base = 15, amp = 10, win = 3.0;
    let s = `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="rgba(205,218,232,0.25)" stroke-width="1"/>`;
    const n = u < m.t0 ? 0 : Math.floor((u - m.t0) / m.iv) + 1;
    for (let k = n - 1; k >= 0; k--) {
      const t = m.t0 + k * m.iv, age = u - t; if (age > win) break;
      const x = W * (1 - age / win), pol = k % 2 ? -1 : 1, hot = age < 0.12;
      s += `<rect x="${(x - 4).toFixed(1)}" y="${pol > 0 ? base - amp : base}" width="4" height="${amp}" style="fill:#78c3ff" opacity="${hot ? 1 : 0.55}"/>`;
    }
    s += `<line x1="${W}" y1="2" x2="${W}" y2="28" stroke="#e39a5c" stroke-width="1.2"/>`;
    svg.innerHTML = s;
  }
  const LABEL_TEXT = { coil: 'Coil', core: 'Core', stator: 'Stator', bridge: 'Bridge', notch: 'Notch', rotor: 'Rotor (magnet)', pinion: 'Pinion' };
  // leader offsets in px (label box anchored at the end of the leader, on the side it points to)
  const LABEL_OFF = { coil: [36, -34], core: [-26, -40], stator: [-40, 46], bridge: [96, -34], notch: [-92, 52], rotor: [150, 92], pinion: [150, -104] };
  let labKey = '';
  const pt = {};

  return {
    cameras: {
      overview: { t: [-3.6, 3.2, 0.6], yaw: 0.36, pitch: 0.4, dist: 68 },
      bore: { t: [4.6, 3.3, 0], yaw: 0.04, pitch: 0.07, dist: 50 },
      tight: { t: [2.2, 0.6, 0], yaw: 0.0, pitch: 0.05, dist: 27 },
      side: { t: [0, 3.0, 1.0], yaw: 1.05, pitch: 0.3, dist: 66 },
      twin: { t: [0, 0.6, 0], yaw: 0, pitch: 0.12, dist: 123 },
    },
    // p.mode: 'overview' (static, all parts) | 'rest' (p.nudge=true, p.nudgeAt=0.55*dur) |
    // 'pulse' (p.count=1, p.at=0.25*dur, p.interval=1.6, p.pol=+1) | 'wrong' (p.at=0.2*dur, p.interval=0.4*dur, p.pol=+1) | 'twin'
    // p.labels: true (or a list of keys) draws this stage's own part labels in the overlay (off by default: the director labels anchors)
    update(u, p, T, dur) {
      const pl = plan(p, dur), mode = pl.mode;
      const twin = mode === 'twin';
      M.g.position.x = twin ? -TWX : 0;
      MB.g.visible = twin;
      nl.visible = nudgeArrow.visible = turnArrow.visible = false;
      if (twin) {
        const a = twinState(TW.A, u), b = twinState(TW.B, u);
        M.pose({ alpha: a.alpha, P: a.P, t: u, beads: false });
        MB.pose({ alpha: b.alpha, P: b.P, t: u, beads: false });
        return;
      }
      if (mode === 'rest') {
        const tn = u - nudgeAt(p, dur), nud = p.nudge === false ? 0 : nudgeS(tn);
        M.pose({ alpha: REST - deg(32) * nud, P: 0, t: u, rest: 0.75 * (1 - 0.5 * Math.min(1, Math.abs(nud))) });
        nl.visible = true; leader.opacity = 0.9 * smooth((u - 0.12 * dur) / 0.8);
        const na = p.nudge === false ? 0 : smooth(tn / 0.15) * (1 - smooth((tn - 0.75) / 0.2));
        nudgeArrow.visible = na > 0.01; arrowMat.opacity = na;
        return;
      }
      if (mode === 'pulse' || mode === 'wrong') {
        const s = stateAt(pl, u);
        M.pose({ alpha: s.alpha, P: s.P, t: u });
        nl.visible = true; leader.opacity = 0.4;   // the rest line the N/S boundary returns to
        // "turns this way" hint during each real step
        let ta = 0;
        pl.pulses.forEach(q => { if (q.step) { const t = u - q.t; ta = Math.max(ta, smooth(t / 0.1) * (1 - smooth((t - 0.55) / 0.25))); } });
        turnArrow.visible = ta > 0.01; turnMat.opacity = 0.9 * ta;
        return;
      }
      M.pose({ alpha: REST, P: 0, t: u });   // overview
    },
    overlay(u, p, T, dur) {
      const pl = plan(p, dur), mode = pl.mode;
      // scope (pulse / wrong)
      const scoped = mode === 'pulse' || mode === 'wrong';
      scopeCard.style.opacity = scoped ? '1' : '0';
      if (scoped) {
        const key = JSON.stringify([mode, pl.pulses, dur]);
        if (key !== scopeKey) { scopeKey = key; buildScope(pl, dur); }
        const x = SX0 + (SX1 - SX0) * clamp(u / dur);
        const ph = scopeSvg.querySelector('.ph'); ph.setAttribute('x1', x.toFixed(1)); ph.setAttribute('x2', x.toFixed(1));
        scopeSvg.querySelectorAll('.pz').forEach(r => {
          const q = pl.pulses[+r.dataset.i], t = u - q.t;
          r.setAttribute('opacity', (t < 0 ? 0.12 : 0.3 + 0.7 * Math.max(env(t), 1 - smooth((t - PW) / 0.6))).toFixed(2));
        });
        const q2 = pl.pulses[1];
        verdict.style.display = mode === 'wrong' ? '' : 'none';
        verdict.style.opacity = mode === 'wrong' && q2 ? smooth((u - q2.t - 0.5) / 0.4).toFixed(3) : '0';
      }
      // rest card
      restCard.style.opacity = mode === 'rest' ? smooth((u - 0.15 * dur) / 0.6).toFixed(3) : '0';
      if (mode === 'rest') { const tn = u - nudgeAt(p, dur); held.style.opacity = p.nudge === false ? '0' : smooth((tn - 1.0) / 0.5).toFixed(3); }
      // twin cards follow the motors
      for (const k of ['A', 'B']) {
        const el = twinEls[k];
        if (mode !== 'twin') { el.style.opacity = '0'; continue; }
        WX.project(WX.anchors['motor:motor' + k], pt);
        el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
        el.style.opacity = '1';
        twinStrip(el.querySelector('svg'), TW[k], u);
      }
      twinNote.style.opacity = mode === 'twin' ? '1' : '0';
      if (mode === 'twin') twinNote.style.top = Math.min(585, pt.y + 96).toFixed(1) + 'px';
      // optional part labels
      const want = p.labels ? (Array.isArray(p.labels) ? p.labels : Object.keys(LABEL_TEXT)) : [];
      const lk = want.join(',');
      if (lk !== labKey) {
        labKey = lk;
        labLayer.innerHTML = want.map(k => {
          const [dx, dy] = LABEL_OFF[k] || [40, -30];
          const box = dx >= 0 ? `left:${dx + 4}px` : `right:${-dx + 4}px`;
          return `<div data-k="${k}" style="position:absolute;left:0;top:0">
          <svg width="1" height="1" style="position:absolute;left:0;top:0;overflow:visible"><line x1="0" y1="0" x2="${dx}" y2="${dy}" stroke="rgba(236,235,230,0.6)" stroke-width="1"/></svg>
          <div style="position:absolute;left:-3.5px;top:-3.5px;width:7px;height:7px;border-radius:50%;background:#e39a5c;box-shadow:0 0 0 3px rgba(227,154,92,0.22)"></div>
          <div style="position:absolute;${box};top:${dy}px;transform:translateY(-50%);white-space:nowrap;font-size:12.5px;padding:4px 7px;border-radius:4px;background:rgba(9,12,16,0.8);border:1px solid rgba(205,218,232,0.14)">${LABEL_TEXT[k] || k}</div></div>`;
        }).join('');
      }
      labLayer.querySelectorAll('[data-k]').forEach(el => {
        const a = WX.anchors['motor:' + el.dataset.k]; if (!a) return;
        WX.project(a, pt);
        el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
      });
    },
  };
});
