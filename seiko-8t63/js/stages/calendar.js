// Close-up stage: the date change.
// A driving wheel that turns once a day carries a finger (a pin). Late in the evening the pin enters the
// date ring's internal teeth and pushes one tooth; a sprung jumper resists, riding up the tooth. When the
// tooth passes the jumper's tip (midnight) the jumper snaps the ring forward the rest of the way: one date.
// Modes: 'day' (the evening-to-midnight sequence), 'danger' (why not to quick-set 21:00-03:00),
// 'quickset' (the corrector advancing the ring one tooth per stroke).
// Layout, tooth shapes and sizes are illustrative, not a service drawing. Contact is computed from the
// part outlines (pin vs tooth, jumper V vs teeth), so the ring only moves when something touches it.
WX.registerStage('calendar', function (ctx) {
  'use strict';
  const { THREE, WX, group, overlay } = ctx;
  const { TAU, clamp, lerp, smooth, easeOut, deg, win } = WX;

  // ───────────── layout (stage mm; ring centre at the origin, dial side toward +Z) ─────────────
  const N = 31, PHI = TAU / N;
  const RT = 9.6, RR = 10.4, RO = 13.6, RNUM = 12.0;     // tooth tips, tooth roots, outer edge, number circle
  const HR = 0.17, HT = 0.06;                             // tooth half-width at root / at tip, in pitches
  const PSI_W = deg(108), DW = 8.4, RF = 1.6, RP = 0.2;   // driving wheel: direction, centre distance, finger radius, pin radius
  const G0 = PSI_W - 0.45 * PHI;                          // phase of the gap centres (ring at rest)
  const PSI_J = G0 - 3 * PHI;                             // the jumper's gap (about 68 deg)
  const PSI_K = PSI_W + 3 * PHI;                          // corrector (about 143 deg): same tooth phase as the finger
  const RA = 10.25, HW = 1.05, VDROP = HW / Math.tan(deg(52)), HBODY = 0.45; // jumper V head: apex radius, half width, V depth
  const WIN = deg(90);                                    // the date window
  const ZR0 = 0, ZR1 = 0.4;                               // ring thickness
  const SNAP_T = 0.14;                                    // seconds the jumper takes to throw the ring
  const WARN = '#ff7a59';

  // ───────────── 2D kinematics (pure functions) ─────────────
  const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const TOOTH = [[RR + 0.6, -HR], [RR, -HR], [RT, -HT], [RT, HT], [RR, HR], [RR + 0.6, HR]];
  // tooth j (relative to the ring at rest) with the ring advanced A pitches clockwise
  const toothPoly = (j, A) => TOOTH.map(([r, x]) => P(r, G0 + (j + 0.5 + x - A) * PHI));
  const toothAt = (ang, A) => Math.round(wrap(ang - G0) / PHI + A - 0.5);
  const segQ = [0, 0];
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2);
    segQ[0] = a[0] + t * dx; segQ[1] = a[1] + t * dy;
    return Math.hypot(p[0] - segQ[0], p[1] - segQ[1]);
  }
  function pip(p, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
    }
    return ins;
  }
  // signed clearance between a circle and tooth j (negative = overlap); `out` receives the closest tooth point
  function circTooth(c, r, j, A, out) {
    const poly = toothPoly(j, A); let d = 1e9;
    for (let i = 0; i < poly.length; i++) { const s = segDist(c, poly[i], poly[(i + 1) % poly.length]); if (s < d) { d = s; if (out) { out[0] = segQ[0]; out[1] = segQ[1]; } } }
    return (pip(c, poly) ? -d : d) - r;
  }
  // how far (in pitches) a pin at c has pushed tooth j: the top of the overlap interval in [0, 1)
  function pushOf(c, j) {
    const bad = A => circTooth(c, RP, j, A) < 0, n = 64;
    let i = n - 1; while (i >= 0 && !bad(i / n)) i--;
    if (i < 0) return 0;
    let lo = i / n, hi = (i + 1) / n;
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (bad(m)) lo = m; else hi = m; }
    return hi;
  }
  // first A >= a0 at which tooth j touches a (stationary) pin at c
  function blockOf(c, j, a0) {
    const bad = A => circTooth(c, RP, j, A) < 0;
    let lo = a0, hi = -1;
    for (let A = a0; A <= a0 + 1.2; A += 1 / 64) { if (bad(A)) { hi = A; break; } lo = A; }
    if (hi < 0) return Infinity;
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (bad(m)) hi = m; else lo = m; }
    return lo;
  }
  // jumper V head: apex on the jumper's gap line, moving straight inward by `lift`
  const JR = [Math.cos(PSI_J), Math.sin(PSI_J)], JT = [-JR[1], JR[0]];
  const HEAD = [[0, 0], [HW, -VDROP], [HW, -VDROP - HBODY], [-HW, -VDROP - HBODY], [-HW, -VDROP]];
  const jw = (t, r, l) => [JR[0] * (RA + r - l) + JT[0] * t, JR[1] * (RA + r - l) + JT[1] * t];
  function headFree(l, A) {
    const head = HEAD.map(([t, r]) => jw(t, r, l)), j0 = toothAt(PSI_J, A);
    for (let i = 0; i <= 20; i++) {
      const f = i / 20, q = jw(-HW + 2 * HW * f, -VDROP * Math.abs(2 * f - 1), l);
      for (let j = j0 - 1; j <= j0 + 1; j++) if (pip(q, toothPoly(j, A))) return false;
    }
    for (let j = j0 - 1; j <= j0 + 1; j++) for (const v of toothPoly(j, A)) if (pip(v, head)) return false;
    return true;
  }
  function liftOf(A) {
    if (headFree(0, A)) return 0;
    let lo = 0, hi = 1.4;
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (headFree(m, A)) hi = m; else lo = m; }
    return hi;
  }
  // driving wheel and corrector: w = angle turned past the "apex" (pin pointing straight at the teeth), clockwise
  const WC = P(DW, PSI_W), KC = P(DW, PSI_K);
  const pinAt = w => [WC[0] + RF * Math.cos(PSI_W - w), WC[1] + RF * Math.sin(PSI_W - w)];
  const lobeAt = w => [KC[0] + RF * Math.cos(PSI_K - w), KC[1] + RF * Math.sin(PSI_K - w)];

  // ── calibration (deterministic, once) ──
  let JK = 0;
  find: for (let w = deg(-90); w < deg(90); w += deg(0.2)) for (let j = -4; j <= 4; j++) if (circTooth(pinAt(w), RP, j, 0) < 0) { JK = j; break find; }
  const JKK = JK + 3;                                     // the corrector's tooth (same geometry, 3 pitches round)
  let LMAX = 0, AMAX = 0.5;
  for (let A = 0.3; A <= 0.7; A += 0.005) { const l = liftOf(A); if (l > LMAX + 1e-4) { LMAX = l; AMAX = A; } }
  let ACRIT = AMAX;                                       // the tooth has passed the jumper's tip
  for (let A = AMAX; A <= 0.9; A += 0.0025) { ACRIT = A; if (liftOf(A) < LMAX - 0.004) break; }
  const L0 = liftOf(0);
  // wheel angle at which the finger has pushed the ring to ACRIT (= midnight)
  let wLo = deg(-30), wHi = deg(80);
  for (let w = wLo; w <= wHi; w += deg(0.5)) { if (pushOf(pinAt(w), JK) >= ACRIT) { wHi = w; break; } wLo = w; }
  for (let k = 0; k < 24; k++) { const m = (wLo + wHi) / 2; if (pushOf(pinAt(m), JK) >= ACRIT) wHi = m; else wLo = m; }
  const W_SNAP = wHi, W_PER_H = deg(15);
  const wOfH = hRel => W_SNAP + hRel * W_PER_H;           // hRel: hours relative to midnight
  let H_CONTACT = -6, H_EXIT = 6, POST_CLEAR = 9;
  for (let hr = -6; hr < 0; hr += 0.02) if (pushOf(pinAt(wOfH(hr)), JK) > 1e-4) { H_CONTACT = hr; break; }
  for (let hr = 0; hr < 8; hr += 0.02) {
    const c = pinAt(wOfH(hr));
    for (let j = JK - 2; j <= JK + 2; j++) POST_CLEAR = Math.min(POST_CLEAR, circTooth(c, RP, j, 1));
    if (Math.hypot(c[0], c[1]) + RP < RT - 0.02) { H_EXIT = hr; break; }
  }
  if (POST_CLEAR < 0) console.warn('calendar: finger touches the ring after the snap', POST_CLEAR);

  // ───────────── materials ─────────────
  const M = {
    brass: WX.mat('brass', { metalness: 0.85, roughness: 0.4 }), steel: WX.mat('steel', { metalness: 0.72, roughness: 0.26 }), nickel: WX.mat('nickel', { color: new THREE.Color(0xd8d4cc) }), pin: WX.mat('pin'), plate: WX.mat('plate'),
    brushed: WX.mat('brushed'), dark: WX.mat('dark'),
    glowWarm: WX.mat('glowWarm', { opacity: 0 }), glowWarn: WX.mat('glowWarm', { opacity: 0 }), glowJ: WX.mat('glowWarm', { opacity: 0 }),
  };
  M.glowWarn.color.set(WARN);
  const ringTex = WX.canvasTex(2048, 2048, (c, n) => {
    const pt = WX.painter(c, n, RO);
    c.fillStyle = '#efeee8'; c.fillRect(0, 0, n, n);
    pt.mm();
    c.strokeStyle = 'rgba(20,22,26,0.18)'; c.lineWidth = 0.035;
    pt.circle(0, 0, RO - 0.35); c.stroke();
    pt.circle(0, 0, RR + 0.28); c.stroke();
    for (let d = 1; d <= N; d++) {
      const a = WIN + (d - 1) * PHI;
      pt.text(String(d), RNUM * Math.cos(a), RNUM * Math.sin(a), 1.62, { weight: 600, color: '#141518', rot: a - Math.PI / 2 });
    }
  });
  ringTex.repeat.set(1 / (2 * RO), 1 / (2 * RO)); ringTex.offset.set(0.5, 0.5);
  const ringFace = new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.62, metalness: 0, envMapIntensity: 0.7 });
  const ringSide = new THREE.MeshStandardMaterial({ color: 0xd9d8d2, roughness: 0.5, metalness: 0, envMapIntensity: 0.7 });

  // ───────────── meshes ─────────────
  // main plate (context only)
  const plate = new THREE.Mesh(WX.cylGeo(13.0, -1.45, -1.2, 120), M.plate); group.add(plate);
  // date ring: outer circle with 31 internal teeth
  const ringShape = new THREE.Shape(); ringShape.absarc(0, 0, RO, 0, TAU, false);
  const hole = new THREE.Path();
  for (let j = 0; j < N; j++) {
    const pts = [[RR, -HR], [RT, -HT], [RT, HT], [RR, HR]].map(([r, x]) => P(r, G0 + (j + 0.5 + x) * PHI));
    pts.forEach((q, i) => (j === 0 && i === 0) ? hole.moveTo(q[0], q[1]) : hole.lineTo(q[0], q[1]));
    const a0 = G0 + (j + 0.5 + HR) * PHI, a1 = G0 + (j + 1.5 - HR) * PHI;   // gap floor: arc on the root circle
    for (let s = 1; s < 6; s++) { const q = P(RR, lerp(a0, a1, s / 6)); hole.lineTo(q[0], q[1]); }
  }
  hole.closePath(); ringShape.holes.push(hole);
  const ringGeo = new THREE.ExtrudeGeometry(ringShape, { depth: ZR1 - ZR0, bevelEnabled: false, curveSegments: 180 });
  ringGeo.translate(0, 0, ZR0);
  const ring = new THREE.Mesh(ringGeo, [ringFace, ringSide]); group.add(ring);

  // date window frame (a cut-out in the dial would sit here)
  const WIN_W = 3.0, WIN_H = 2.5, winFrame = new THREE.Group();
  const frameShape = WX.roundRect(WIN_W + 0.7, WIN_H + 0.7, 0.35);
  const frameHole = new THREE.Path(); frameHole.moveTo(-WIN_W / 2, -WIN_H / 2); frameHole.lineTo(WIN_W / 2, -WIN_H / 2); frameHole.lineTo(WIN_W / 2, WIN_H / 2); frameHole.lineTo(-WIN_W / 2, WIN_H / 2); frameHole.closePath();
  frameShape.holes.push(frameHole);
  winFrame.add(new THREE.Mesh(WX.extrude(frameShape, 0.62, 0.86, 12, 0.04), M.brushed));
  winFrame.position.set(0, RNUM, 0); group.add(winFrame);

  // driving wheel (behind the ring), its finger arm and the finger pin that rises into the teeth
  const wheel = new THREE.Group(); wheel.position.set(WC[0], WC[1], 0); group.add(wheel);
  const wheelGear = new THREE.Mesh(WX.gearGeo(40, 0.3, 5), M.brass); wheelGear.position.z = -0.72; wheel.add(wheelGear);
  wheel.add(new THREE.Mesh(WX.cylGeo(0.42, -0.9, -0.35, 24), M.pin));
  const armShape = WX.barShape([[0, 0], [RF, 0]], 0.62);
  const arm = new THREE.Mesh(WX.extrude(armShape, -0.57, -0.42, 8), M.steel); wheel.add(arm);
  wheel.add(new THREE.Mesh(WX.cylGeo(0.5, -0.57, -0.4, 24), M.steel));
  const pin = new THREE.Mesh(WX.cylGeo(RP, -0.57, 0.62, 24), M.steel); pin.position.x = RF; wheel.add(pin);

  // jumper: a thin steel spring arm curving round inside the ring, ending in a V head
  const J_A0 = deg(21), J_A1 = PSI_J - HW / 9.15 + deg(1.5), J_R0 = 8.82, J_R1 = 9.18;
  const jArmShape = new THREE.Shape();
  jArmShape.absarc(0, 0, J_R1, J_A0, J_A1, false); jArmShape.absarc(0, 0, J_R0, J_A1, J_A0, true); jArmShape.closePath();
  const jArmGeo = WX.extrude(jArmShape, 0.06, 0.34, 64);
  const jArmBase = Float32Array.from(jArmGeo.attributes.position.array);
  const jArm = new THREE.Mesh(jArmGeo, M.steel); group.add(jArm);
  const jHeadShape = WX.polyShape(HEAD.map(([t, r]) => jw(t, r, 0)));
  const jHead = new THREE.Mesh(WX.extrude(jHeadShape, 0.06, 0.34, 4), M.steel); group.add(jHead);
  const JS = P(9.0, J_A0 - deg(2.2));
  const jBlock = new THREE.Mesh(WX.extrude(WX.roundRect(1.9, 1.15, 0.4), 0.06, 0.34, 6), M.steel);
  jBlock.position.set(JS[0], JS[1], 0); jBlock.rotation.z = J_A0 + Math.PI / 2; group.add(jBlock);
  const screw = new THREE.Group(); screw.position.set(JS[0], JS[1], 0); screw.rotation.z = 0.7; group.add(screw);
  screw.add(new THREE.Mesh(WX.cylGeo(0.48, 0.34, 0.56, 28), M.steel));
  screw.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.1).translate(0, 0, 0.56), M.dark));

  // date corrector (quick-set) wheel: three lobes in the ring's plane, driven from the crown at the 1st click
  const corr = new THREE.Group(); corr.position.set(KC[0], KC[1], 0); group.add(corr);
  const star = new THREE.Shape(), AH = 0.16, RL = RP, RH = 0.72;
  const xs = RF - Math.sqrt(RL * RL - AH * AH), xh = Math.sqrt(RH * RH - AH * AH), aSide = Math.atan2(AH, xh);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3, R2 = (x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const p0 = R2(xh, -AH); i === 0 ? star.moveTo(p0[0], p0[1]) : star.lineTo(p0[0], p0[1]);
    const p1 = R2(xs, -AH); star.lineTo(p1[0], p1[1]);
    const t0 = Math.atan2(-AH, xs - RF);
    for (let s = 1; s <= 16; s++) { const t = lerp(t0, -t0, s / 16); const q = R2(RF + RL * Math.cos(t), RL * Math.sin(t)); star.lineTo(q[0], q[1]); }
    const p2 = R2(xh, AH); star.lineTo(p2[0], p2[1]);
    for (let s = 1; s < 8; s++) { const t = lerp(aSide, TAU / 3 - aSide, s / 8); const q = R2(RH * Math.cos(t), RH * Math.sin(t)); star.lineTo(q[0], q[1]); }
  }
  star.closePath();
  const starHole = new THREE.Path(); starHole.absarc(0, 0, 0.2, 0, TAU, true); star.holes.push(starHole);
  corr.add(new THREE.Mesh(WX.extrude(star, 0.06, 0.34, 8), M.nickel));
  corr.add(new THREE.Mesh(WX.gearGeo(14, 0.24, 0, 0.16).clone().translate(0, 0, -0.3), M.nickel));
  corr.add(new THREE.Mesh(WX.cylGeo(0.2, -0.5, 0.42, 20), M.pin));

  // glows: finger contact, corrector contact, jumper click, warning
  const dotGeo = new THREE.SphereGeometry(1, 16, 10);
  const mkGlow = m => { const g = new THREE.Mesh(dotGeo, m); g.renderOrder = 8; g.visible = false; group.add(g); return g; };
  const gFinger = mkGlow(M.glowWarm), gCorr = mkGlow(M.glowWarm), gClick = mkGlow(M.glowJ), gWarn = mkGlow(M.glowWarn);
  const warnRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 40), new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  warnRing.renderOrder = 9; group.add(warnRing);

  // ───────────── anchors ─────────────
  const anc = {
    ring: ctx.anchor('ring', group, ...P(RO - 0.9, deg(146)), ZR1),
    teeth: ctx.anchor('teeth', group, ...P(RT + 0.25, deg(124)), ZR1),
    finger: ctx.anchor('finger', pin, 0, 0, 0.62),
    drivingWheel: ctx.anchor('drivingWheel', group, WC[0] - 0.9, WC[1] - 1.3, -0.4),
    jumper: ctx.anchor('jumper', group, ...P(9.0, deg(40)), 0.34),
    corrector: ctx.anchor('corrector', group, KC[0] - 0.55, KC[1] - 0.3, 0.34),
    window: ctx.anchor('window', group, 0, RNUM + WIN_H / 2 + 0.35, 0.86),
  };
  const head3 = new THREE.Object3D(); group.add(head3);       // follows the jumper apex
  const warn3 = new THREE.Object3D(); group.add(warn3);
  const fing3 = new THREE.Object3D(); group.add(fing3);
  const corr3 = new THREE.Object3D(); group.add(corr3);

  // ───────────── time ─────────────
  // simulated clock for 'day': monotone curve through (0, h0), (mid, 24), (1, h1) so midnight lands at `mid`
  function clockOf(f, h0, h1, mid) {
    if (!(h0 < 24 && h1 > 24)) return lerp(h0, h1, f);
    const X = [0, mid, 1], Y = [h0, 24, h1];
    const s1 = (Y[1] - Y[0]) / X[1], s2 = (Y[2] - Y[1]) / (1 - X[1]), m = [s1, 2 * s1 * s2 / (s1 + s2), s2];
    const i = f < mid ? 0 : 1, h = X[i + 1] - X[i], t = (f - X[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1];
  }
  // ring advance during and after the jumper's throw (t: seconds since the tooth passed the tip)
  function throwA(t, from = ACRIT, to = 1) {
    if (t < SNAP_T) { const k = t / SNAP_T; return from + (to - from) * k * k; }
    const s = t - SNAP_T; return to + 0.05 * Math.sin(s / 0.045) * Math.exp(-s / 0.05);
  }
  const fmtH = h => { h = ((h % 24) + 24) % 24; let H = Math.floor(h), Mi = Math.floor((h - H) * 60 + 1e-6); if (Mi >= 60) { Mi -= 60; H = (H + 1) % 24; } return String(H).padStart(2, '0') + ':' + String(Mi).padStart(2, '0'); };

  // the whole pose as a pure function of (u, p, dur)
  let memoKey = '', memo = null;
  function solve(u, p, dur) {
    const key = u + '|' + dur + '|' + JSON.stringify(p);
    if (key === memoKey) return memo;
    const mode = p.mode || 'day', D0 = p.date || 14, f = clamp(u / dur);
    const S = { mode, f, date: D0, A: 0, wF: wOfH(-12), wK: deg(-60), clickT: -1, contactF: false, contactK: false, jam: 0, h: 12, phase: '' };
    if (mode === 'day') {
      const h0 = p.h0 !== undefined ? p.h0 : 20.0, h1 = p.h1 !== undefined ? p.h1 : 24.6, mid = p.midAt !== undefined ? p.midAt : 0.68;
      const h = clockOf(f, h0, h1, mid); S.h = h;
      const passed = Math.floor(h / 24) - Math.floor(h0 / 24), hd = h - 24 * Math.floor(h / 24);
      S.date = D0 + passed;
      if (hd >= 12) {                                      // evening: the finger pushes the next tooth
        S.wF = wOfH(hd - 24); S.A = pushOf(pinAt(S.wF), JK); S.contactF = S.A > 0;
        S.phase = S.A <= 0 ? 'approach' : S.A < 0.2 ? 'touch' : 'push';
      } else {                                             // after midnight: thrown by the jumper, then at rest
        S.wF = wOfH(hd);
        if (passed > 0) {
          // film time of the last midnight crossing
          let lo = 0, hi = f; const target = 24 * Math.floor(h / 24);
          for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (clockOf(m, h0, h1, mid) >= target) hi = m; else lo = m; }
          const t = (f - hi) * dur; S.clickT = t;
          S.A = throwA(t) - 1;
        }
        S.phase = S.clickT >= 0 && S.clickT < 2.2 ? 'snap' : 'clear';
      }
    } else if (mode === 'danger') {
      const h = p.h !== undefined ? p.h : 22.5; S.h = h;
      const hd = h - 24 * Math.floor(h / 24), hRel = hd >= 12 ? hd - 24 : hd;
      S.wF = wOfH(hRel);
      const cF = pinAt(S.wF), Af = hRel < 0 ? pushOf(cF, JK) : 0;
      const jB = hRel < 0 ? JK + 1 : JK;                   // the tooth that sits just behind the finger
      const Ab = blockOf(cF, jB, Af);
      const k0 = p.corrAt !== undefined ? p.corrAt : 0.24, k1 = k0 + 0.4;
      const wKs = f2 => lerp(deg(-62), deg(64), smooth((f2 - k0) / (k1 - k0)));
      const Ac = f2 => { const w = wKs(f2); return pushOf(lobeAt(w), JKK); };
      S.wK = wKs(f);
      let A = Math.max(Af, Ac(f));
      S.contactF = Af > 0 && Ac(f) <= Af + 1e-4; S.contactK = Ac(f) > 0 && Ac(f) >= Af;
      if (A >= ACRIT && Ab > ACRIT) {
        // when did the corrector push the tooth past the jumper's tip?
        let lo = k0, hi = f;
        for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (Math.max(Af, Ac(m)) >= ACRIT) hi = m; else lo = m; }
        const t = (f - hi) * dur; S.clickT = t;
        const free = Math.max(throwA(t), Ac(f));
        A = Math.min(free, Ab);
        S.jam = free >= Ab ? 1 : 0;
        S.contactF = false; S.contactK = Ac(f) >= A - 1e-4;
        if (Ac(f) > A) {                                   // the lobe can't go further: it stalls against the tooth
          let a = k0, b = f;
          for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (Ac(m) >= A) b = m; else a = m; }
          S.wK = wKs(a); S.contactK = true;
        }
        if (S.jam) { let a = hi, b = f; for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (Math.max(throwA((m - hi) * dur), Ac(m)) >= Ab) b = m; else a = m; } S.jamT = (f - b) * dur; }
      } else if (A >= Ab) { A = Ab; S.jam = 1; S.jamT = 0; }
      S.A = A; S.Ab = Ab; S.Af = Af;
      S.phase = S.jam ? 'jam' : S.contactK ? 'corr' : 'engaged';
    } else {                                               // 'quickset'
      const steps = p.steps || 3, h = p.h !== undefined ? p.h : 12.0; S.h = h;
      const hd = h - 24 * Math.floor(h / 24); S.wF = wOfH(hd >= 12 ? hd - 24 : hd);
      const a = p.from !== undefined ? p.from : 0.1, span = (p.to !== undefined ? p.to : 0.92) - a, slot = span / steps, len = slot * 0.78;
      // corrector phase of the active lobe at the snap, and where in a stroke that happens
      const q = (W_SNAP + deg(60)) / deg(120);
      let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (smooth(m) >= q) hi = m; else lo = m; }
      const xSnap = hi;
      let done = 0, wLocal = deg(-60);
      for (let i = 0; i < steps; i++) {
        const s0 = a + i * slot, x = clamp((f - s0) / len);
        if (f >= s0) { wLocal = deg(-60) + deg(120) * smooth(x); }
        if (f >= s0 + xSnap * len) { done = i + 1; S.clickT = (f - (s0 + xSnap * len)) * dur; S.step = i; }
        if (f >= s0) S.stroke = i;
      }
      const stroke = S.stroke !== undefined ? S.stroke : -1;
      S.wK = wLocal + deg(120) * Math.max(0, stroke);        // total turn (lobes repeat every 120 deg)
      S.date = D0 + done;
      if (stroke >= 0 && done === stroke) { S.A = pushOf(lobeAt(wLocal), JKK); S.contactK = S.A > 0; }
      else if (done > 0) S.A = throwA(S.clickT) - 1;
      S.phase = S.clickT >= 0 && S.clickT < 0.6 ? 'snap' : S.contactK ? 'corr' : 'idle';
      S.steps = steps;
    }
    S.lift = liftOf(S.A);
    memoKey = key; memo = S;
    return S;
  }

  // ───────────── overlay (HTML/SVG) ─────────────
  overlay.innerHTML = `
<style>
  .stage-overlay[data-stage="calendar"] .cal-lab { position:absolute; left:0; top:0; opacity:0; pointer-events:none; }
  .stage-overlay[data-stage="calendar"] .cal-lab .d { position:absolute; left:-4px; top:-4px; width:8px; height:8px; border-radius:50%; background:#e39a5c; box-shadow:0 0 0 3px rgba(227,154,92,0.22); }
  .stage-overlay[data-stage="calendar"] .cal-lab svg { position:absolute; left:0; top:0; overflow:visible; }
  .stage-overlay[data-stage="calendar"] .cal-lab .t { position:absolute; white-space:nowrap; font-size:13px; line-height:1.25; padding:4px 8px; border-radius:4px; background:rgba(9,12,16,0.82); border:1px solid rgba(205,218,232,0.16); color:#ecebe6; transform:translate(0,-50%); }
  .stage-overlay[data-stage="calendar"] .cal-lab .t small { display:block; font-size:11px; color:#9aa3ad; }
  .stage-overlay[data-stage="calendar"] .cal-lab.warn .d { background:${WARN}; box-shadow:0 0 0 3px rgba(255,122,89,0.25); }
  .stage-overlay[data-stage="calendar"] .cal-lab.warn .t { border-color:rgba(255,122,89,0.55); }
  .stage-overlay[data-stage="calendar"] .cal-card { left:36px; top:92px; width:244px; opacity:0; }
  .stage-overlay[data-stage="calendar"] .cal-clock { font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums; font-size:38px; line-height:1.1; margin:2px 0 8px; letter-spacing:0.02em; }
  .stage-overlay[data-stage="calendar"] .cal-dates { font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums; font-size:20px; display:flex; align-items:center; gap:10px; margin-top:2px; }
  .stage-overlay[data-stage="calendar"] .cal-dates b { font-weight:500; display:inline-block; min-width:30px; text-align:center; padding:1px 4px; border-radius:4px; color:#6f7882; border:1px solid transparent; }
  .stage-overlay[data-stage="calendar"] .cal-dates b.on { color:#141518; background:#efeee8; }
  .stage-overlay[data-stage="calendar"] .cal-dates i { font-style:normal; color:#6f7882; font-size:15px; }
  .stage-overlay[data-stage="calendar"] .cal-status { font-size:13px; color:#ecebe6; margin-top:9px; min-height:17px; }
  .stage-overlay[data-stage="calendar"] .cal-bar { position:relative; height:44px; margin-top:8px; }
  .stage-overlay[data-stage="calendar"] .cal-note { font-size:11px; color:#9aa3ad; margin-top:6px; line-height:1.35; }
  .stage-overlay[data-stage="calendar"] .cal-dial { position:absolute; left:1000px; top:268px; width:248px; opacity:0; }
</style>
<div class="ov-card cal-card" data-k="card"></div>
<div class="cal-dial" data-k="dial"></div>
<div data-k="labs"></div>`;
  const elCard = overlay.querySelector('[data-k="card"]'), elDial = overlay.querySelector('[data-k="dial"]'), elLabs = overlay.querySelector('[data-k="labs"]');
  const labEls = {};
  function labEl(k) {
    if (labEls[k]) return labEls[k];
    const el = document.createElement('div'); el.className = 'cal-lab';
    el.innerHTML = '<svg width="1" height="1"><line stroke="rgba(236,235,230,0.62)" stroke-width="1"/></svg><span class="d"></span><span class="t"></span>';
    elLabs.appendChild(el);
    return (labEls[k] = { el, line: el.querySelector('line'), t: el.querySelector('.t'), html: '' });
  }
  const scrW = () => WX.viewW || 1280, scrH = () => WX.viewH || 720;
  // label: anchor object, screen offset (px at 720p) of the text box, html, opacity
  function setLab(k, obj, dx, dy, html, op, warn) {
    const L = labEl(k);
    if (op <= 0.01 || !obj) { L.el.style.opacity = 0; return; }
    const pt = WX.project(obj), s = scrH() / 720;
    if (!pt.visible) { L.el.style.opacity = 0; return; }
    if (L.html !== html) { L.html = html; L.t.innerHTML = html; }
    const cls = 'cal-lab' + (warn ? ' warn' : ''); if (L.el.className !== cls) L.el.className = cls;
    let bx = dx * s, by = dy * s;
    const w = L.t.offsetWidth || 120, left = bx < 0;
    // keep the box on screen and out of the subtitle band
    const absX = pt.x + bx + (left ? -w : 0), maxY = scrH() * (600 / 720) - pt.y - 14 * s;
    if (absX < 12 * s) bx += 12 * s - absX; else if (absX + w > scrW() - 12 * s) bx -= absX + w - (scrW() - 12 * s);
    if (by > maxY) by = maxY;
    L.el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
    L.line.setAttribute('x1', 0); L.line.setAttribute('y1', 0); L.line.setAttribute('x2', bx.toFixed(1)); L.line.setAttribute('y2', by.toFixed(1));
    L.t.style.left = (left ? bx - w : bx).toFixed(1) + 'px'; L.t.style.top = by.toFixed(1) + 'px';
    L.el.style.opacity = clamp(op).toFixed(3);
  }
  const hideLabs = keep => { for (const k in labEls) if (!keep.has(k)) labEls[k].el.style.opacity = 0; };

  // card contents
  function dayBar(S, h0, h1) {
    const W = 220, x = h => clamp((h - h0) / (h1 - h0)) * W;
    const hc = 24 + H_CONTACT, he = 24 + H_EXIT, mx = x(24);
    return `<svg width="${W}" height="44" viewBox="0 0 ${W} 44" style="position:static">
      <line x1="0" y1="20" x2="${W}" y2="20" stroke="rgba(236,235,230,0.25)" stroke-width="2"/>
      <rect x="${x(hc).toFixed(1)}" y="16" width="${(x(he) - x(hc)).toFixed(1)}" height="8" rx="2" fill="rgba(227,154,92,0.55)"/>
      <line x1="${mx}" y1="11" x2="${mx}" y2="29" stroke="#ecebe6" stroke-width="1.2"/>
      <text x="${mx}" y="41" text-anchor="middle" font-size="10" fill="#9aa3ad">00:00</text>
      <text x="0" y="41" font-size="10" fill="#9aa3ad">${fmtH(h0)}</text>
      <text x="${(x(hc) + 2).toFixed(1)}" y="10" font-size="10" fill="#e39a5c">finger in the teeth</text>
      <circle cx="${x(S.h).toFixed(1)}" cy="20" r="4.5" fill="#ecebe6"/>
    </svg>`;
  }
  function dialSvg(S) {
    const R = 92, C = 110, ang = h => (h / 24) * TAU - Math.PI / 2;     // 24 at the top, clockwise
    const pt = (h, r) => [C + r * Math.cos(ang(h)), C + r * Math.sin(ang(h))];
    const arc = (h0, h1, r) => { const a = pt(h0, r), b = pt(h1, r), large = ((h1 - h0 + 24) % 24) > 12 ? 1 : 0; return `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} A ${r} ${r} 0 ${large} 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)}`; };
    const sector = (h0, h1, r) => { const a = pt(h0, r), b = pt(h1, r); return `M ${C} ${C} L ${a[0].toFixed(1)} ${a[1].toFixed(1)} A ${r} ${r} 0 0 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)} Z`; };
    let ticks = '';
    for (let i = 0; i < 24; i++) { const a = pt(i, R - (i % 6 ? 6 : 11)), b = pt(i, R); ticks += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="rgba(236,235,230,${i % 6 ? 0.45 : 0.9})" stroke-width="${i % 6 ? 1 : 1.6}"/>`; }
    const nums = [[24, '24'], [6, '6'], [12, '12'], [18, '18']].map(([h, s]) => { const q = pt(h, R - 23); return `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#ecebe6">${s}</text>`; }).join('');
    const hand = pt(S.h, R - 14), e0 = pt(21, R + 13), e1 = pt(3, R + 13);
    return `<svg width="220" height="232" viewBox="0 0 220 232" style="position:static;overflow:visible">
      <circle cx="${C}" cy="${C}" r="${R}" fill="rgba(11,14,19,0.82)" stroke="rgba(205,218,232,0.3)" stroke-width="1"/>
      <path d="${sector(21, 27, R)}" fill="rgba(255,122,89,0.26)" stroke="${WARN}" stroke-width="1.2"/>
      <path d="${arc(24 + H_CONTACT, H_EXIT, R - 36)}" fill="none" stroke="#e39a5c" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
      ${ticks}${nums}
      <text x="${e0[0].toFixed(1)}" y="${(e0[1] + 3).toFixed(1)}" text-anchor="end" font-size="11" fill="${WARN}">21:00</text>
      <text x="${e1[0].toFixed(1)}" y="${(e1[1] + 3).toFixed(1)}" text-anchor="start" font-size="11" fill="${WARN}">03:00</text>
      <line x1="${C}" y1="${C}" x2="${hand[0].toFixed(1)}" y2="${hand[1].toFixed(1)}" stroke="#ecebe6" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="${C}" cy="${C}" r="4" fill="#ecebe6"/>
      <text x="${C}" y="${C + 34}" text-anchor="middle" font-size="15" fill="#ecebe6">${fmtH(S.h)}</text>
    </svg>`;
  }

  // ───────────── per-frame pose ─────────────
  const tmp = [0, 0], v3 = new THREE.Vector3();
  function poseJumper(lift) {
    const pos = jArmGeo.attributes.position, arr = pos.array, n = [-JR[0], -JR[1]];
    for (let i = 0; i < arr.length; i += 3) {
      const a = Math.atan2(jArmBase[i + 1], jArmBase[i]), s = clamp((a - J_A0) / (J_A1 - J_A0)), k = lift * s * s * (3 - s) / 2;
      arr[i] = jArmBase[i] + n[0] * k; arr[i + 1] = jArmBase[i + 1] + n[1] * k; arr[i + 2] = jArmBase[i + 2];
    }
    pos.needsUpdate = true;
    jHead.position.set(n[0] * lift, n[1] * lift, 0);
  }
  function placeGlow(g, x, y, z, r, op) { g.visible = op > 0.01; g.position.set(x, y, z); g.scale.setScalar(r); g.material.opacity = op; }

  function update(u, p, T, dur) {
    p = p || {}; dur = dur || 10;
    const S = solve(u, p, dur);
    ring.rotation.z = -(S.date - 1 + S.A) * PHI;
    wheel.rotation.z = PSI_W - S.wF;
    corr.rotation.z = PSI_K - S.wK;
    poseJumper(S.lift);
    head3.position.set(...jw(0, 0, S.lift), ZR1);
    corr.visible = true;
    // finger contact glow
    const cF = pinAt(S.wF);
    if (S.contactF) {
      circTooth(cF, RP, JK, S.A, tmp);
      placeGlow(gFinger, tmp[0], tmp[1], ZR1 + 0.05, 0.2 + 0.04 * Math.sin(T * 6), 0.85);
      fing3.position.set(tmp[0], tmp[1], ZR1);
    } else placeGlow(gFinger, 0, 0, 0, 0.1, 0);
    // corrector contact glow
    if (S.contactK) {
      const lw = S.mode === 'quickset' ? S.wK - deg(120) * Math.max(0, S.stroke || 0) : S.wK, c = lobeAt(lw);
      circTooth(c, RP, JKK, S.A, tmp);
      placeGlow(gCorr, tmp[0], tmp[1], ZR1 + 0.05, 0.2, S.mode === 'danger' && S.jam ? 0.95 : 0.8);
      corr3.position.set(tmp[0], tmp[1], ZR1);
    } else placeGlow(gCorr, 0, 0, 0, 0.1, 0);
    // jumper click flash
    const ck = S.clickT >= 0 ? S.clickT : 99;
    const flash = ck < 0.7 ? (1 - smooth(ck / 0.7)) : 0;
    const hp = jw(0, 0, S.lift);
    placeGlow(gClick, hp[0], hp[1], ZR1 + 0.1, 0.35 + 0.9 * smooth(ck / 0.25), 0.95 * flash);
    // warning at the jam (danger)
    if (S.mode === 'danger' && S.jam) {
      const jB = JK + 1; circTooth(cF, RP, jB, S.A, tmp);
      const pulse = 0.5 + 0.5 * Math.sin((S.jamT || 0) * 7);
      placeGlow(gWarn, tmp[0], tmp[1], ZR1 + 0.1, 0.24 + 0.08 * pulse, 0.9);
      warnRing.position.set(tmp[0], tmp[1], ZR1 + 0.3); warnRing.scale.setScalar(0.9 + 0.5 * pulse);
      warnRing.material.opacity = 0.85 * (1 - 0.6 * pulse);
      warn3.position.set(tmp[0], tmp[1], ZR1);
    } else { placeGlow(gWarn, 0, 0, 0, 0.1, 0); warnRing.material.opacity = 0; }
  }

  function overlayFn(u, p, T, dur) {
    p = p || {}; dur = dur || 10;
    const S = solve(u, p, dur), mode = S.mode, f = S.f, labels = p.labels !== 0 && p.labels !== false;
    const keep = new Set(), L = (k, obj, dx, dy, html, op, warn) => { keep.add(k); setLab(k, obj, dx, dy, html, op, warn); };
    const fadeIn = win(u, 0.15, dur + 10, 0.5, 0.4);
    if (mode === 'day') {
      const h0 = p.h0 !== undefined ? p.h0 : 20.0, h1 = p.h1 !== undefined ? p.h1 : 24.6;
      const after = S.date > (p.date || 14);
      const d0 = p.date || 14, d1 = d0 + 1;
      const status = S.phase === 'approach' ? 'The finger is still clear of the teeth'
        : S.phase === 'touch' ? 'The finger meets a tooth'
        : S.phase === 'push' ? 'Finger pushes · <span class="ov-accent">jumper holds the ring back</span>'
        : S.phase === 'snap' ? '<span class="ov-accent">Click:</span> the jumper throws the ring on'
        : 'One date further · the finger moves clear';
      elCard.innerHTML = `<div class="ov-k">Simulated time</div><div class="cal-clock">${fmtH(S.h)}</div>
        <div class="ov-k">Date</div><div class="cal-dates"><b class="${after ? '' : 'on'}">${d0}</b><i>→</i><b class="${after ? 'on' : ''}">${d1}</b></div>
        <div class="cal-status">${status}</div>${dayBar(S, h0, h1)}`;
      elCard.style.opacity = fadeIn.toFixed(3);
      elDial.style.opacity = 0;
      if (labels) {
        L('wheel', anc.drivingWheel, -70, 64, 'Date driving wheel<small>turns once in 24 hours</small>', win(f, 0.03, 0.34, 0.03, 0.05));
        L('finger', anc.finger, -60, -64, 'Finger', win(f, 0.12, 0.62, 0.04, 0.05));
        L('ring', anc.ring, -40, -54, 'Date ring<small>31 teeth, one per date</small>', win(f, 0.06, 0.34, 0.03, 0.05));
        L('jumper', anc.jumper, 70, 40, 'Jumper (spring)<small>holds the ring between steps</small>', win(f, 0.42, 0.66, 0.04, 0.04));
        const ck = S.clickT >= 0 ? S.clickT : 99;
        L('click', head3, 64, -50, 'Click! One tooth = one date', S.phase === 'snap' ? win(ck, 0, 2.2, 0.08, 0.5) : 0);
        L('window', anc.window, 58, -34, 'Date window', win(f, 0.74, 1.2, 0.05, 0.05));
      }
    } else if (mode === 'danger') {
      elCard.style.opacity = 0;
      elDial.innerHTML = `<div class="ov-k" style="margin-bottom:2px">Seiko 8T63 manual</div>
        <div style="font-size:15px;line-height:1.3;margin-bottom:8px"><span style="color:${WARN}">Don't set the date</span><br>between 21:00 and 03:00</div>${dialSvg(S)}
        <div class="cal-note"><span style="color:#e39a5c">━</span> finger in the teeth (this illustrative model)</div>`;
      elDial.style.opacity = fadeIn.toFixed(3);
      if (labels) {
        L('finger', anc.finger, -70, -60, `Finger already in the teeth<small>${fmtH(S.h)}</small>`, S.jam ? 0 : win(f, 0.04, 0.7, 0.04, 0.04));
        L('corr', anc.corrector, -60, 62, 'Quick-set corrector<small>turned from the crown</small>', win(f, 0.2, 1.2, 0.04, 0.05));
        L('warn', warn3, 46, -78, 'Ring forced against the finger', S.jam ? win(S.jamT || 0, 0.1, 99, 0.25, 0.3) : 0, true);
      }
    } else {
      const steps = S.steps, d0 = p.date || 14;
      let row = ''; for (let i = 0; i <= steps; i++) row += (i ? '<i>›</i>' : '') + `<b class="${S.date === d0 + i ? 'on' : ''}">${d0 + i}</b>`;
      elCard.innerHTML = `<div class="ov-k">Quick-set · crown at 1st click</div><div class="cal-dates" style="margin:10px 0 4px">${row}</div>
        <div class="cal-status">${S.phase === 'snap' ? '<span class="ov-accent">Click:</span> the jumper sets the ring' : S.phase === 'corr' ? 'A lobe pushes one tooth' : 'One stroke = one tooth = one date'}</div>
        <div class="cal-note">Daytime: the date finger is well clear of the teeth.</div>`;
      elCard.style.opacity = fadeIn.toFixed(3);
      elDial.style.opacity = 0;
      if (labels) {
        L('corr', anc.corrector, -60, 62, 'Date corrector wheel<small>driven from the crown</small>', win(f, 0.03, 1.2, 0.04, 0.05));
        L('jumper', anc.jumper, 70, 40, 'Jumper clicks each step', win(f, 0.2, 1.2, 0.04, 0.05));
      }
    }
    hideLabs(keep);
  }

  return {
    cameras: {
      overview: { t: [0.3, 6.6, 0], yaw: 0, pitch: 0.14, dist: 47 },
      finger: { t: [0.2, 10.4, 0], yaw: 0.04, pitch: 0.12, dist: 19.5 },
      window: { t: [0.2, 11.2, 0], yaw: -0.04, pitch: 0.08, dist: 10 },
      corrector: { t: [-3.2, 9.0, 0], yaw: 0.1, pitch: 0.2, dist: 24 },
    },
    update,
    overlay: overlayFn,
    // exposed for testing / the director
    info: { ACRIT, LMAX, L0, W_SNAP, H_CONTACT, H_EXIT, POST_CLEAR, JK },
  };
});
