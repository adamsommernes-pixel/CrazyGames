// Close-up stage: the stopwatch reset, by hammer and heart cams (purely mechanical in the 8T63).
//
// Facts used (Seiko 8T63A technical guide): the chronograph mechanism is based on the mechanical
// Cal. 8R28 and uses a one-piece, three-pointed reset hammer. Pusher B moves a hammer operating lever,
// which lets the spring-loaded hammer strike the heart cams. Each stopwatch arbor (centre stopwatch
// seconds, 60-minute counter) carries a heart cam.
//
// Physics shown: the cam radius grows linearly with angle on both sides of the notch (Archimedean
// profile r = rmin + k·|φ|). A flat hammer face pushes along a line that misses the arbor, so the push
// has a lever arm and twists the cam towards smaller radius. The cam angle is never animated directly
// while the hammer touches it: it is solved from the hammer position, as the angle at which the real
// cam outline just reaches the face (support function of the outline = face distance from the arbor).
// At zero the flat face spans the notch and rests on both flanks: the two twists cancel and the cam is
// locked. A hand short of half a turn flies back; one past half a turn flies forward.
// The third point of the hammer is modelled but strikes nothing (its job is not documented).
// Sizes, proportions and travel are illustrative (not to scale); all motion is slowed down.
//
// Modes (p.mode): 'profile' | 'force' | 'both' | 'linkage'   (params are listed above update())
// Cameras: cam (single heart), both, linkage (3/4 view), top (plan view of the linkage).
// Anchors: heart, notch, point, hammer, face, lever, spring, pusher.
WX.registerStage('heart', function (ctx) {
  const { THREE, WX, group, overlay } = ctx;
  const { TAU, clamp, lerp, smooth, deg } = WX;
  const PI = Math.PI;
  const wrap = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const COP = '#e39a5c', TXT = '#ecebe6', MUT = '#9aa3ad';

  // ───────────── heart profile (unit size: largest radius = 1) ─────────────
  const RMIN = 0.26, KR = (1 - RMIN) / PI;     // r(φ) = RMIN + KR·|φ|, φ from the notch (local +Y)
  const R0 = 10;                               // built size of a heart (stage mm, illustrative)
  const BEV = 0.1, EDGE = BEV / R0, THK = 1.2; // bevel grows the outline by BEV
  const NB = 1080, BXs = new Float64Array(NB), BYs = new Float64Array(NB), BPs = new Float64Array(NB);
  for (let i = 0; i < NB; i++) {
    const f = -PI + TAU * i / NB, r = RMIN + KR * Math.abs(f);
    BXs[i] = -r * Math.sin(f); BYs[i] = r * Math.cos(f); BPs[i] = f;
  }
  // highest point of the cam along world +Y with the hand at th (clockwise from 12; cam turned by -th).
  // flank: +1 only the φ>0 side, -1 only φ<0, 0 both. Returns h (incl. bevel) and the contact x (unit).
  function supp(th, flank) {
    const s = Math.sin(th), c = Math.cos(th);
    let best = -1e9, bi = 0;
    for (let i = 0; i < NB; i++) {
      if ((flank > 0 && BPs[i] < 0) || (flank < 0 && BPs[i] > 0)) continue;
      const v = -BXs[i] * s + BYs[i] * c;
      if (v > best) { best = v; bi = i; }
    }
    return { h: best + EDGE, x: BXs[bi] * c + BYs[bi] * s };
  }
  const hS = th => supp(th, 0).h;
  const H0 = hS(0);                            // face height when the cam is locked at zero
  // hand angle between 0 and th0 at which the cam outline just reaches a face at height d (unit)
  function solveTh(d, th0) {
    if (d >= hS(th0)) return th0;
    if (d <= H0) return 0;
    const sg = th0 < 0 ? -1 : 1;
    let lo = 0, hi = Math.abs(th0);
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (hS(sg * m) > d) hi = m; else lo = m; }
    return sg * (lo + hi) / 2;
  }
  const rOf = th => RMIN + KR * Math.abs(wrap(th));
  // constant speed with smoothed start and end
  function glide(x, e = 0.14) {
    x = clamp(x); const v = 1 / (1 - e);
    if (x < e) return 0.5 * v * x * x / e;
    if (x > 1 - e) return 1 - 0.5 * v * (1 - x) * (1 - x) / e;
    return v * (x - e / 2);
  }
  // linear, then a quadratic ease-out over the last part with matching speed
  function settle(x, xa = 0.7) {
    x = clamp(x); const ya = 2 * xa / (1 + xa);
    if (x <= xa) return ya * x / xa;
    const q = (x - xa) / (1 - xa);
    return ya + (1 - ya) * (1 - (1 - q) * (1 - q));
  }
  const secOf = th => { const d = ((th * 180 / PI) % 360 + 360) % 360; return d / 6; };

  // ───────────── materials and shared geometry ─────────────
  const M = {
    blued: WX.mat('blued', { metalness: 0.62, roughness: 0.38 }), nickel: WX.mat('nickel'), steel: WX.mat('steel'), brushed: WX.mat('brushed'),
    gold: WX.mat('gold'), pin: WX.mat('pin'),
    hand: new THREE.MeshStandardMaterial({ color: 0xf3f1ea, metalness: 0.3, roughness: 0.36 }),
    tick: new THREE.MeshBasicMaterial({ color: 0x8d96a0, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  };
  const heartGeo = WX.extrude(WX.heartShape(RMIN * R0, R0, 0, 360), 0, THK, 12, BEV);
  const arborGeo = WX.cylGeo(0.6, -1.8, 2.75, 24);
  const colletGeo = WX.cylGeo(1.3, THK - 0.05, THK + 0.32, 32);
  const handGeo = WX.extrude(WX.polyShape([[-0.12, 12.7], [0.12, 12.7], [0.36, 0.6], [0.36, -2.3], [-0.36, -2.3], [-0.36, 0.6]]), 2.05, 2.25);
  const hubGeo = WX.cylGeo(0.95, 1.9, 2.42, 28);
  const cwGeo = WX.cylGeo(0.72, 2.05, 2.25, 24);
  const tickGeo = (() => {
    const pos = [], idx = [];
    for (let i = 0; i < 60; i++) {
      const maj = i % 5 === 0, a = i / 60 * TAU, r0 = maj ? 11.9 : 12.55, r1 = 13.4, w = maj ? 0.17 : 0.075;
      const dx = Math.sin(a), dy = Math.cos(a), px = Math.cos(a), py = -Math.sin(a), b = pos.length / 3;
      pos.push(dx * r0 + px * w, dy * r0 + py * w, 0, dx * r1 + px * w, dy * r1 + py * w, 0, dx * r1 - px * w, dy * r1 - py * w, 0, dx * r0 - px * w, dy * r0 - py * w, 0);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  })();
  const numerals = ['60', '15', '30', '45'].map(t => WX.textPlane(t, { size: 1.45, color: '#8d96a0', weight: 500 }));

  // ───────────── a heart unit: cam + arbor + hand (turning) and a dial ring (fixed) ─────────────
  function makeUnit() {
    const g = new THREE.Group(), spin = new THREE.Group(), dial = new THREE.Group();
    g.add(dial); g.add(spin); group.add(g);
    spin.add(new THREE.Mesh(heartGeo, M.blued), new THREE.Mesh(colletGeo, M.nickel), new THREE.Mesh(arborGeo, M.nickel));
    spin.add(new THREE.Mesh(handGeo, M.hand), new THREE.Mesh(hubGeo, M.hand));
    const cw = new THREE.Mesh(cwGeo, M.hand); cw.position.y = -2.3; spin.add(cw);
    const ticks = new THREE.Mesh(tickGeo, M.tick); ticks.position.z = -0.9; dial.add(ticks);
    numerals.forEach((n, i) => { const m = n.clone(); const a = i * PI / 2; m.position.set(10.55 * Math.sin(a), 10.55 * Math.cos(a), -0.9); dial.add(m); });
    return { g, spin, dial, x: 0, y: 0, sc: 1, th: 0,
      set(x, y, sc, th) { this.x = x; this.y = y; this.sc = sc; this.th = th; g.position.set(x, y, 0); g.scale.setScalar(sc); spin.rotation.z = -th; } };
  }
  const UA = makeUnit(), UB = makeUnit();

  // ───────────── hammers ─────────────
  // force: a flat-faced block (face on local y = 0), moves straight down
  const hamF = new THREE.Group(); group.add(hamF);
  hamF.add(new THREE.Mesh(WX.extrude(WX.polyShape([[-5, 0], [5, 0], [5, 2.6], [4.2, 3.4], [-4.2, 3.4], [-5, 2.6]]), -0.25, 1.45, 4, 0.08), M.blued));
  // both: one bar with two faces over the two hearts (scale 0.8)
  const SB = 0.8, XB = 15;
  const hamB = new THREE.Group(); group.add(hamB);
  {
    const pad = (cx, out) => { out.push([cx - 4.3, 0.9], [cx - 3.5, 0], [cx + 3.5, 0], [cx + 4.3, 0.9]); };
    const pts = [[-25, 2.9], [-25, 0.9]]; pad(-XB, pts); pad(XB, pts); pts.push([25, 0.9], [25, 2.9]);
    hamB.add(new THREE.Mesh(WX.extrude(WX.polyShape(pts), -0.2, THK * SB + 0.15, 4, 0.08), M.blued));
  }
  // linkage: pivoted one-piece hammer with three points, its spring, the operating lever, pusher B
  const SL = 0.6, XM = -17;                     // hearts: seconds at (0, 0), minutes at (XM, 0)
  const H0L = H0 * R0 * SL, FACE = 1.4;
  const PH = [22, H0L + FACE];                  // hammer pivot; faces lie FACE below it (local y = -FACE)
  const BREST = -0.19;                          // hammer angle when held up (rad); 0 = resting on the hearts at zero
  const TREL = [1.6, -7.2], PINR = 0.55;        // tail pin (hammer local)
  const SREL = [-9, 1.14];                      // where the hammer spring presses (top of the bar, hammer local)
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const onHam = (v, b) => { const r = rot(v, b); return [PH[0] + r[0], PH[1] + r[1]]; };
  const T0 = onHam(TREL, BREST);
  const BREL = [-0.65, 5.5], CREL = [1.2, -3.0], LW = 1.4;    // operating lever: beak arm, pusher arm (lever local)
  const PO = [T0[0] + PINR - BREL[0], T0[1] - BREL[1]];      // lever pivot: beak holds the tail pin at rest
  const ALPHA = -0.42;                                       // lever turn when pusher B is fully in (clockwise)
  const beakX = a => PO[0] + rot(BREL, a)[0];
  const contactX = a => PO[0] + rot(CREL, a)[0] + LW / 2;
  function betaBeak(a) {                                     // hammer angle allowed by the beak
    const bx = beakX(a); let lo = BREST - 0.15, hi = 0.6;
    for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (onHam(TREL, m)[0] + PINR > bx) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }
  const hamL = new THREE.Group(); hamL.position.set(PH[0], PH[1], 0); group.add(hamL);
  const XA_L = 0 - PH[0], XB_L = XM - PH[0], XC_L = (XM / 2) - PH[0];   // pad centres (hammer local)
  const ZH0 = -0.1, ZH1 = THK * SL + 0.1;
  {
    const pts = [[-43, 0.9], [-43, -0.7]];
    const pad = (cx, wt, wb, d) => pts.push([cx - wt, -0.7], [cx - wb, -0.7 - d], [cx + wb, -0.7 - d], [cx + wt, -0.7]);
    pad(XB_L, 2.9, 2.3, FACE - 0.7); pad(XC_L, 1.3, 0.42, 0.45); pad(XA_L, 2.9, 2.3, FACE - 0.7);
    pts.push([1.2, -0.7], [1.2, 0.9]);
    hamL.add(new THREE.Mesh(WX.extrude(WX.polyShape(pts), ZH0, ZH1, 4, 0.06), M.blued));
    hamL.add(new THREE.Mesh(WX.extrude(WX.barShape([[0.2, -0.6], TREL], 1.3), ZH0, ZH1, 4, 0.06), M.blued));
    hamL.add(new THREE.Mesh(WX.cylGeo(1.7, ZH0 - 0.05, ZH1 + 0.05, 32), M.blued));
    hamL.add(new THREE.Mesh(WX.cylGeo(0.75, ZH1 + 0.05, ZH1 + 0.25, 24), M.gold));
    const pin = new THREE.Mesh(WX.cylGeo(PINR, ZH0, 1.85, 20), M.nickel); pin.position.set(TREL[0], TREL[1], 0); hamL.add(pin);
  }
  const ZL0 = 1.0, ZL1 = 1.6;                                // lever sits above the hammer, at the pin's height
  const lever = new THREE.Group(); lever.position.set(PO[0], PO[1], 0); group.add(lever);
  lever.add(new THREE.Mesh(WX.extrude(WX.barShape([[BREL[0] + LW / 2, BREL[1] + 0.7], [0, 0], [CREL[0], CREL[1] - 0.2]], LW), ZL0, ZL1, 4, 0.05), M.nickel));
  lever.add(new THREE.Mesh(WX.cylGeo(1.35, ZL0 - 0.05, ZL1 + 0.05, 28), M.nickel));
  lever.add(new THREE.Mesh(WX.cylGeo(0.55, ZL1 + 0.05, ZL1 + 0.22, 20), M.gold));
  const lstud = new THREE.Mesh(WX.cylGeo(0.5, -0.3, ZL0, 16), M.pin); lstud.position.set(PO[0], PO[1], 0); group.add(lstud);
  // hammer spring: a pre-bent blade from a fixed stud to the top of the hammer bar
  const AS = [2.5, PH[1] + 4.7];
  const tip0 = onHam(SREL, BREST), SPL = Math.hypot(tip0[0] - AS[0], tip0[1] - AS[1]);
  const spring = new THREE.Group(); spring.position.set(AS[0], AS[1], 0); group.add(spring);
  {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([t * SPL, 0.55 * Math.sin(PI * t)]); }
    const blade = new THREE.Mesh(WX.extrude(WX.barShape(pts, 0.55), 0.05, ZH1 - 0.05), M.nickel); blade.name = 'blade'; spring.add(blade);
  }
  const sstud = new THREE.Group(); sstud.position.set(AS[0], AS[1], 0); group.add(sstud);
  sstud.add(new THREE.Mesh(WX.cylGeo(1.1, -0.2, ZH1 + 0.05, 24), M.nickel), new THREE.Mesh(WX.cylGeo(0.6, ZH1 + 0.05, ZH1 + 0.22, 20), M.gold));
  // case middle (a segment of it) and pusher B
  const CC = [-8, 0], CRI = 41, CRO = 44;
  const case_ = new THREE.Mesh((() => {
    const s = new THREE.Shape(), a0 = deg(-21.5), a1 = deg(-8);
    s.absarc(CC[0], CC[1], CRO, a0, a1, false); s.absarc(CC[0], CC[1], CRI, a1, a0, true);
    return WX.extrude(s, -1.2, 2.2, 24, 0.15);
  })(), M.brushed);
  group.add(case_);
  const PY = PO[1] + CREL[1], PZ = 1.28;                       // pusher axis
  const caseOutX = CC[0] + Math.sqrt(CRO * CRO - (PY - CC[1]) ** 2);
  const PX0 = contactX(0), HEAD0 = caseOutX + 1.45 - PX0, HEADL = 3.6;
  const pusher = new THREE.Group(); pusher.position.set(PX0, PY, PZ); group.add(pusher);
  {
    const cx = (r, x0, x1, seg = 28) => { const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg); g.rotateZ(PI / 2); g.translate((x0 + x1) / 2, 0, 0); return g; };
    pusher.add(new THREE.Mesh(cx(0.55, 0, HEAD0 + 0.5, 20), M.pin));
    pusher.add(new THREE.Mesh(cx(1.75, HEAD0, HEAD0 + HEADL, 36), M.steel));
    pusher.add(new THREE.Mesh(cx(1.45, HEAD0 + HEADL, HEAD0 + HEADL + 0.35, 36), M.steel));
  }
  const linkParts = [hamL, lever, lstud, spring, sstud, case_, pusher];

  // ───────────── anchors ─────────────
  const an = {
    heart: ctx.anchor('heart', UA.spin, -4.4, -2.6, THK),
    notch: ctx.anchor('notch', UA.spin, 0, RMIN * R0 + 0.1, THK),
    point: ctx.anchor('point', UA.spin, 0, -R0 + 0.15, THK),
    hammer: ctx.anchor('hammer', group, 0, 0, 0),
    face: ctx.anchor('face', group, 0, 0, 0),
    lever: ctx.anchor('lever', lever, 0.25, 2.8, ZL1),
    spring: ctx.anchor('spring', spring, SPL * 0.45, 0.6, ZH1),
    pusher: ctx.anchor('pusher', pusher, HEAD0 + 1.6, 1.75, 0),
  };

  // ───────────── per-mode state (pure functions of u, p, dur) ─────────────
  const MODES = ['profile', 'force', 'both', 'linkage'];
  const modeOf = p => (MODES.indexOf(p.mode) >= 0 ? p.mode : 'profile');

  function stProfile(u, p, dur) {
    const a0 = deg(num(p.a0, -180)), a1 = deg(num(p.a1, 0));
    const s = glide((u - 0.1 * dur) / (0.78 * dur));
    return { th: lerp(a0, a1, s), a0, a1, s };
  }

  function stForce(u, p, dur) {
    let th0 = wrap(deg(num(p.theta0, 130)));
    if (Math.abs(th0) > PI - 0.03) th0 = (th0 < 0 ? -1 : 1) * (PI - 0.03);
    if (Math.abs(th0) < 0.03) th0 = 0.03;
    const from = p.from === undefined || p.from === null ? 0 : deg(p.from);
    const tA = 0.12 * dur, tB = 0.22 * dur, tC = 0.72 * dur;
    const yRest = 1.24, yHit = hS(th0);
    let y, th;
    if (u < tA) y = yRest;
    else if (u < tB) { const s = (u - tA) / (tB - tA); y = lerp(yRest, yHit, s * s); }
    else y = lerp(yHit, H0, settle((u - tB) / (tC - tB)));
    if (u < tB) {
      // pre-roll: the stopwatch hand runs clockwise from p.from to theta0 before the reset
      let tgt = th0; const f = wrap(from);
      while (tgt < f) tgt += TAU;
      th = wrap(lerp(f, tgt, smooth((u - 0.02 * dur) / (0.09 * dur))));
    } else th = solveTh(y, th0);
    const touch = u >= tB;
    const fl = th0 > 0 ? 1 : -1;
    const c1 = supp(th, fl), c2 = supp(th, -fl);
    const gap = Math.max(0, c1.h - c2.h);
    const w2 = touch ? 1 - smooth(gap / 0.022) : 0;
    const F2 = 0.5 * w2, F1 = 1 - F2;
    const tq = -(F1 * c1.x + F2 * c2.x);                 // net twist (unit), + = anticlockwise
    const tqRef = Math.abs(supp(th0, fl).x);
    return { th, th0, y, touch, c1, c2, F1, F2, w2, tq, tqRef, tA, tB, tC, done: touch && Math.abs(th) < 1e-3 };
  }

  function stBoth(u, p, dur) {
    const thA0 = wrap(deg(num(p.left, 15) * 6)), thB0 = wrap(deg(num(p.right, 40) * 6));
    const at = num(p.at, 0.4 * dur), snap = Math.max(0.06, 1.8 * num(p.slow, 1));
    const s = clamp((u - at) / snap);
    const y = lerp(1.22, H0, smooth(s));
    return { thA0, thB0, thA: solveTh(y, thA0), thB: solveTh(y, thB0), y, at, snap, s };
  }

  function stLink(u, p, dur) {
    const tP = num(p.press, 0.2 * dur), tR = num(p.release, 0.62 * dur);
    const dP = Math.max(0.45, 0.05 * dur);
    const pin = smooth((u - tP) / dP), pout = smooth((u - tR) / dP);
    const press = pin * (1 - pout);
    const alpha = ALPHA * press;
    const dF = Math.max(1.1, 0.14 * dur), tF = tP + 0.35 * dP;
    const f = clamp((u - tF) / dF);
    const bFall = lerp(BREST, 0.05, Math.pow(f, 1.4));
    const beta = Math.min(0, betaBeak(alpha), bFall);
    const betaEff = Math.min(0, betaBeak(ALPHA * pin), bFall);   // deepest position so far: the hearts stay at zero after reset
    const thS0 = wrap(deg(num(p.sec, 40) * 6)), thM0 = wrap(deg(num(p.min, 15) * 6));
    const camAt = (cx, th0) => {
      const n = [-Math.sin(betaEff), Math.cos(betaEff)], F0 = onHam([0, -FACE], betaEff);
      const d = ((F0[0] - cx) * n[0] + (F0[1] - 0) * n[1]) / (R0 * SL);
      const psi0 = th0 + betaEff;
      if (d >= hS(psi0)) return th0;
      let th = solveTh(d, psi0) - betaEff;
      if (th * th0 <= 0) th = 0; else if (Math.abs(th) > Math.abs(th0)) th = th0;
      return th;
    };
    return { tP, tR, dP, press, alpha, beta, thS: camAt(0, thS0), thM: camAt(XM, thM0), thS0, thM0, tF, dF };
  }

  // ───────────── 2D overlay (authored in a 1280×720 box, scaled to the view) ─────────────
  overlay.innerHTML = `
  <div class="ht-root" style="position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0">
    <svg class="ht-svg" width="1280" height="720" style="left:0;top:0"></svg>
    <div class="ht-labs"></div>
    <div class="ov-card ht-plot" style="left:112px;top:178px;width:392px;opacity:0">
      <div class="ov-k">Radius at the top, as the cam turns</div>
      <svg class="ht-plotsvg" width="392" height="196" style="position:relative;display:block;margin-top:8px"></svg>
      <div style="font-size:13.5px;line-height:1.45;margin-top:6px">Two straight sides: each degree of turn changes the radius by the same amount. <span class="ov-accent">Smallest at the notch.</span></div>
    </div>
    <div class="ov-card ht-fcard" style="left:112px;top:150px;width:356px;opacity:0">
      <div class="ov-k">Why the cam turns</div>
      <div class="ht-fl" data-i="0" style="font-size:14px;line-height:1.45;margin-top:8px">The flat face pushes straight down, along a line that <span class="ov-accent">misses the arbor</span>.</div>
      <div class="ht-fl" data-i="1" style="font-size:14px;line-height:1.45;margin-top:8px">Push × lever arm = <span class="ov-accent">twist</span>. It turns the cam towards a smaller radius.</div>
      <div class="ht-fl" data-i="2" style="font-size:14px;line-height:1.45;margin-top:8px">Notch under the face: it rests on both sides, the two twists cancel. <span class="ov-accent">Locked at zero.</span></div>
      <div style="margin-top:10px;display:flex;gap:18px;align-items:baseline">
        <div><div class="ov-k">Hand</div><div class="ov-big ht-read">21.7 s</div></div>
        <div><div class="ov-k">Twist</div><div class="ov-big ht-tq">0</div></div>
      </div>
    </div>
    <div class="ht-cap" data-u="A" style="position:absolute;left:0;top:0;width:300px;text-align:center;opacity:0"></div>
    <div class="ht-cap" data-u="B" style="position:absolute;left:0;top:0;width:300px;text-align:center;opacity:0"></div>
    <div class="ov-card ht-steps" style="left:50%;top:566px;transform:translateX(-50%);padding:6px 12px;white-space:nowrap;opacity:0"></div>
    <div class="ht-badge" style="position:absolute;left:50%;top:22px;transform:translateX(-50%);font:500 11px 'IBM Plex Mono',monospace;letter-spacing:0.12em;text-transform:uppercase;color:#ecebe6;background:rgba(9,12,16,0.78);border:1px solid rgba(227,154,92,0.55);border-radius:12px;padding:4px 12px;white-space:nowrap;opacity:0"></div>
    <div class="ht-tag ov-muted" style="position:absolute;right:24px;top:578px;font:11px 'IBM Plex Mono',monospace;letter-spacing:0.08em;text-transform:uppercase">Not to scale</div>
  </div>`;
  const $ = s => overlay.querySelector(s);
  const root = $('.ht-root'), svg = $('.ht-svg'), labs = $('.ht-labs');
  const plotCard = $('.ht-plot'), plotSvg = $('.ht-plotsvg'), fCard = $('.ht-fcard'), fLines = overlay.querySelectorAll('.ht-fl');
  const fRead = $('.ht-read'), fTq = $('.ht-tq'), steps = $('.ht-steps'), badge = $('.ht-badge'), tag = $('.ht-tag');
  const caps = { A: $('.ht-cap[data-u="A"]'), B: $('.ht-cap[data-u="B"]') };

  // plot geometry (radius vs angle from the notch)
  const PX = [40, 376], PYB = 160, PYT = 24;
  const pX = a => PX[0] + (PX[1] - PX[0]) * (a / TAU + 0.5);
  const pY = r => PYB - (PYB - PYT) * r;
  plotSvg.innerHTML = (() => {
    let s = `<line x1="${PX[0]}" y1="${PYB}" x2="${PX[1]}" y2="${PYB}" stroke="rgba(205,218,232,0.35)"/>`;
    s += `<line x1="${PX[0]}" y1="${PYB}" x2="${PX[0]}" y2="${PYT - 12}" stroke="rgba(205,218,232,0.35)"/>`;
    s += `<text x="${PX[0] - 6}" y="${PYT - 16}" font-size="11" style="fill:${MUT}">radius</text>`;
    s += `<text x="${PX[0] - 6}" y="${PYB + 4}" font-size="10" text-anchor="end" style="fill:#6f7882">0</text>`;
    s += `<line x1="${pX(0)}" y1="${PYB}" x2="${pX(0)}" y2="${PYT}" stroke="rgba(205,218,232,0.22)" stroke-dasharray="3 3"/>`;
    for (const [a, t] of [[-PI, 'point'], [0, 'notch'], [PI, 'point']]) s += `<text x="${pX(a)}" y="${PYB + 17}" font-size="11.5" text-anchor="middle" style="fill:${t === 'notch' ? COP : MUT}">${t}</text>`;
    s += `<text x="${(PX[0] + PX[1]) / 2}" y="${PYB + 32}" font-size="10.5" text-anchor="middle" style="fill:#6f7882">angle round the cam →</text>`;
    s += `<polyline points="${pX(-PI)},${pY(1)} ${pX(0)},${pY(RMIN)} ${pX(PI)},${pY(1)}" fill="none" stroke="rgba(236,235,230,0.55)" stroke-width="1.6"/>`;
    s += `<polyline class="pl-done" points="" fill="none" stroke="${COP}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<line class="pl-drop" x1="0" y1="0" x2="0" y2="0" stroke="${COP}" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>`;
    s += `<circle class="pl-dot" r="5.5" cx="0" cy="0" style="fill:${COP}" stroke="#0b0e13" stroke-width="2"/>`;
    return s;
  })();
  const plDone = plotSvg.querySelector('.pl-done'), plDot = plotSvg.querySelector('.pl-dot'), plDrop = plotSvg.querySelector('.pl-drop');

  let ovS = 1, ovX = 0, ovY = 0;
  const _v = new THREE.Vector3(), _pp = {};
  const P = (x, y, z) => { _v.set(x, y, z).applyMatrix4(group.matrixWorld); WX.project(_v, _pp); return [(_pp.x - ovX) / ovS, (_pp.y - ovY) / ovS]; };
  const PA = a => { a.getWorldPosition(_v); WX.project(_v, _pp); return [(_pp.x - ovX) / ovS, (_pp.y - ovY) / ovS]; };
  const f1 = v => v.toFixed(1);
  const op3 = v => clamp(v).toFixed(3);
  function arrowSvg(pts, col, w, head = 10, opacity = 1, dash) {
    if (pts.length < 2) return '';
    const n = pts.length, [x2, y2] = pts[n - 1], [x1, y1] = pts[n - 2];
    const a = Math.atan2(y2 - y1, x2 - x1), hw = head * 0.55;
    const bx = x2 - head * Math.cos(a), by = y2 - head * Math.sin(a);
    const line = pts.slice(0, n - 1).map(q => `${f1(q[0])},${f1(q[1])}`).join(' ') + ` ${f1(bx)},${f1(by)}`;
    return `<g opacity="${op3(opacity)}"><polyline points="${line}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>` +
      `<polygon points="${f1(x2)},${f1(y2)} ${f1(bx - hw * Math.sin(a))},${f1(by + hw * Math.cos(a))} ${f1(bx + hw * Math.sin(a))},${f1(by - hw * Math.cos(a))}" style="fill:${col}"/></g>`;
  }
  const lineSvg = (a, b, col, w, extra = '') => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${col}" stroke-width="${w}" ${extra}/>`;
  const pill = (x, y, t, o = {}) => {
    const w = t.length * (o.size || 12.5) * 0.6 + 14, h = 22, x0 = o.anchor === 'start' ? x : o.anchor === 'end' ? x - w : x - w / 2;
    return `<g opacity="${op3(o.op === undefined ? 1 : o.op)}"><rect x="${f1(x0)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${h}" rx="4" style="fill:rgba(9,12,16,0.8)" stroke="${o.stroke || 'rgba(205,218,232,0.16)'}"/>` +
      `<text x="${f1(x0 + w / 2)}" y="${f1(y + 4.3)}" font-size="${o.size || 12.5}" text-anchor="middle" style="fill:${o.color || TXT};font-family:'IBM Plex Mono',monospace">${t}</text></g>`;
  };
  // arc of radius r (unit-local mm) round a heart unit, between hand angles a0 → a1 (clockwise from 12)
  function arcPts(U, r, a0, a1, z) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.05) + 1), out = [];
    for (let i = 0; i < n; i++) { const a = lerp(a0, a1, i / (n - 1)); out.push(P(U.x + U.sc * r * Math.sin(a), U.y + U.sc * r * Math.cos(a), z)); }
    return out;
  }
  // part labels: [{ k: anchor | [x,y] px, text, dx, dy, op, accent }]
  function labelsHtml(list) {
    return list.filter(l => l.op > 0.01).map(l => {
      const [x, y] = l.k.isObject3D ? PA(l.k) : l.k, dx = l.dx, dy = l.dy;
      const box = dx >= 0 ? `left:${dx + 4}px` : `right:${-dx + 4}px`;
      return `<div style="position:absolute;left:0;top:0;transform:translate(${f1(x)}px,${f1(y)}px);opacity:${op3(l.op)}">
        <svg width="1" height="1" style="position:absolute;left:0;top:0;overflow:visible"><line x1="0" y1="0" x2="${dx}" y2="${dy}" stroke="rgba(236,235,230,0.6)" stroke-width="1"/></svg>
        <div style="position:absolute;left:-3.5px;top:-3.5px;width:7px;height:7px;border-radius:50%;background:${COP};box-shadow:0 0 0 3px rgba(227,154,92,0.22)"></div>
        <div style="position:absolute;${box};top:${dy}px;transform:translateY(-50%);white-space:nowrap;font-size:13px;padding:4px 8px;border-radius:4px;background:rgba(9,12,16,0.82);border:1px solid ${l.accent ? 'rgba(227,154,92,0.6)' : 'rgba(205,218,232,0.16)'}">${l.text}</div></div>`;
    }).join('');
  }
  // a point on the cam body of unit U, in world direction w (clockwise from 12), at fraction f of the edge radius
  const onCam = (U, w, f) => { const r = f * (rOf(U.th - w) + EDGE) * R0 * U.sc; return P(U.x + r * Math.sin(w), U.y + r * Math.cos(w), THK * U.sc); };
  const STEP_TXT = ['Pusher B in', 'Lever turns', 'Hammer falls', 'Hearts snap to zero', 'Pusher out: hammer lifts'];

  // ───────────── public API ─────────────
  return {
    cameras: {
      cam: { t: [-10.2, 1.4, 0], yaw: 0.05, pitch: 0.07, dist: 90 },
      both: { t: [0, -1.4, 0], yaw: 0, pitch: 0.06, dist: 88 },
      linkage: { t: [7.0, 0.2, 0], yaw: -0.1, pitch: 0.24, dist: 84 },
      top: { t: [7.0, -0.4, 0], yaw: 0, pitch: 0, dist: 84 },
    },
    // p.mode:
    //  'profile': p.a0 = -180, p.a1 = 0 (hand angles in degrees clockwise from 12 at the start/end of the turn;
    //             -180 puts the point at the top, 0 the notch). Turn runs 0.10–0.88·dur.
    //  'force':   p.theta0 = 130 (hand angle before the reset), p.from = 0 (hand pre-roll start; = theta0 for none).
    //             Hammer lands at 0.22·dur, cam reaches zero at 0.72·dur.
    //  'both':    p.left = 15, p.right = 40 (stopwatch seconds on the two dials), p.at = 0.4·dur (hammer starts),
    //             p.slow = 1 (on-screen length of the reset, × 1.8 s; 0.1 ≈ near-instant).
    //  'linkage': p.press = 0.2·dur, p.release = 0.62·dur (pusher B in/out), p.sec = 40, p.min = 15 (readings).
    //  all:       p.labels = false hides this stage's own part labels (e.g. when the director labels anchors).
    update(u, p, T, dur) {
      const mode = modeOf(p);
      hamF.visible = mode === 'force';
      hamB.visible = mode === 'both';
      linkParts.forEach(o => { o.visible = mode === 'linkage'; });
      UB.g.visible = mode === 'both' || mode === 'linkage';
      if (mode === 'profile') {
        const st = stProfile(u, p, dur);
        UA.set(0, 0, 1, st.th);
        an.hammer.position.set(0, R0 * 1.24 + 1.7, THK); an.face.position.set(0, R0 * 1.24, THK);
      } else if (mode === 'force') {
        const st = stForce(u, p, dur);
        UA.set(0, 0, 1, st.th);
        hamF.position.set(0, st.y * R0, 0);
        an.hammer.position.set(3.2, st.y * R0 + 1.7, 1.45); an.face.position.set(-4.2, st.y * R0, 1.45);
      } else if (mode === 'both') {
        const st = stBoth(u, p, dur);
        UA.set(-XB, 0, SB, st.thA); UB.set(XB, 0, SB, st.thB);
        hamB.position.set(0, st.y * R0 * SB, 0);
        an.hammer.position.set(0, st.y * R0 * SB + 1.9, THK * SB + 0.15); an.face.position.set(-XB - 3, st.y * R0 * SB, THK * SB + 0.15);
      } else {
        const st = stLink(u, p, dur);
        UA.set(0, 0, SL, st.thS); UB.set(XM, 0, SL, st.thM);
        hamL.rotation.z = st.beta;
        lever.rotation.z = st.alpha;
        pusher.position.x = contactX(st.alpha);
        const tip = onHam(SREL, st.beta);
        spring.rotation.z = Math.atan2(tip[1] - AS[1], tip[0] - AS[0]);
        spring.scale.x = Math.hypot(tip[0] - AS[0], tip[1] - AS[1]) / SPL;
        const hp = onHam([-15, 0.9], st.beta), fp = onHam([XA_L - 1.5, -FACE], st.beta);
        an.hammer.position.set(hp[0], hp[1], ZH1); an.face.position.set(fp[0], fp[1], ZH1);
      }
    },

    overlay(u, p, T, dur) {
      const mode = modeOf(p), vw = WX.viewW || 1280, vh = WX.viewH || 720;
      ovS = Math.min(vw / 1280, vh / 720); ovX = (vw - 1280 * ovS) / 2; ovY = (vh - 720 * ovS) / 2;
      root.style.transform = `translate(${ovX.toFixed(2)}px, ${ovY.toFixed(2)}px) scale(${ovS.toFixed(5)})`;
      const showLabels = p.labels !== false;
      let s = '', L = [], badgeTxt = '', badgeOp = 0;
      plotCard.style.opacity = '0'; fCard.style.opacity = '0'; steps.style.opacity = '0';
      caps.A.style.opacity = '0'; caps.B.style.opacity = '0';
      const ZF = THK + 0.4;

      if (mode === 'profile') {
        const st = stProfile(u, p, dur);
        const c = P(0, 0, ZF), r = rOf(st.th) + EDGE, e = P(0, r * R0, ZF);
        // the part of the edge that has passed the top (in the cam's own frame), then the radius probe
        const pr = smooth((u - 0.06 * dur) / 0.5);
        if (Math.abs(st.th - st.a0) > 0.01) {
          const n = Math.ceil(Math.abs(st.th - st.a0) / 0.03) + 1, pts = [];
          for (let i = 0; i < n; i++) {
            const ph = lerp(st.a0, st.th, i / (n - 1)), rr = (rOf(ph) + EDGE) * R0, a = ph - st.th;
            pts.push(P(-rr * Math.sin(a), rr * Math.cos(a), ZF));
          }
          s += `<polyline points="${pts.map(q => `${f1(q[0])},${f1(q[1])}`).join(' ')}" fill="none" stroke="${COP}" stroke-width="2.4" stroke-linecap="round" opacity="${op3(0.75 * pr)}"/>`;
        }
        s += `<g opacity="${op3(pr)}">` + lineSvg(c, e, COP, 3, 'stroke-linecap="round"') +
          `<circle cx="${f1(e[0])}" cy="${f1(e[1])}" r="5.5" style="fill:${COP}" stroke="#0b0e13" stroke-width="2"/>` +
          `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="3.5" style="fill:${TXT}"/></g>`;
        const mid = [(c[0] + e[0]) / 2, (c[1] + e[1]) / 2];
        s += pill(mid[0] + 14, mid[1], 'radius', { anchor: 'start', color: COP, op: pr });
        // plot
        const po = smooth((u - 0.4 * dur) / 0.6);
        plotCard.style.opacity = op3(po);
        const a = wrap(st.th), a0 = wrap(st.a0);
        const lo = Math.min(a0, a), hi = Math.max(a0, a), dpts = [];
        if (hi - lo > 1e-3) {
          for (const q of [lo, 0, hi]) if (q >= lo && q <= hi) dpts.push([pX(q), pY(rOf(q))]);
          dpts.sort((m, n) => m[0] - n[0]);
        }
        plDone.setAttribute('points', dpts.map(q => `${f1(q[0])},${f1(q[1])}`).join(' '));
        plDot.setAttribute('cx', f1(pX(a))); plDot.setAttribute('cy', f1(pY(rOf(a))));
        plDrop.setAttribute('x1', f1(pX(a))); plDrop.setAttribute('x2', f1(pX(a))); plDrop.setAttribute('y1', f1(pY(rOf(a)))); plDrop.setAttribute('y2', PYB);
        if (showLabels) {
          L.push({ k: onCam(UA, deg(160), 0.6), text: 'Heart cam', dx: 74, dy: 66, op: WX.win(u, 0.05 * dur, 0.5 * dur, 0.5, 0.5) });
          L.push({ k: P(0, 0, 2.75), text: 'Stopwatch arbor', dx: 150, dy: -14, op: WX.win(u, 0.1 * dur, 0.36 * dur, 0.5, 0.5) });
          const outward = (k, d) => { const q = PA(k), v = [q[0] - c[0], q[1] - c[1]], l = Math.hypot(v[0], v[1]) || 1; return [Math.round(v[0] / l * d), Math.round(v[1] / l * d)]; };
          const [pdx, pdy] = outward(an.point, 56), [ndx, ndy] = outward(an.notch, 64);
          L.push({ k: an.point, text: 'Point: largest radius', dx: pdx + (pdx >= 0 ? 10 : -10), dy: pdy, op: WX.win(u, 0.06 * dur, 0.62 * dur, 0.5, 0.5) });
          L.push({ k: an.notch, text: 'Notch: smallest radius', dx: ndx + (ndx >= 0 ? 10 : -10), dy: ndy, op: smooth((u - 0.5 * dur) / 0.5), accent: true });
        }
      } else if (mode === 'force') {
        const st = stForce(u, p, dur);
        const c0 = P(0, 0, ZF);
        const ac = smooth((u - st.tB) / 0.45);
        if (st.touch) {
          const LF = 5.2;
          const c1 = [st.c1.x * R0, st.c1.h * R0], c2 = [st.c2.x * R0, st.c2.h * R0];
          const q1 = P(c1[0], c1[1], ZF), q2 = P(c2[0], c2[1], ZF);
          // line of the push (dashed) and lever arm
          const foot1 = P(c1[0], 0, ZF), foot2 = P(c2[0], 0, ZF);
          const lop = ac * (1 - 0.65 * st.w2);
          s += lineSvg(P(c1[0], c1[1] + LF + 1.2, ZF), P(c1[0], -3.2, ZF), 'rgba(236,235,230,0.55)', 1.2, `stroke-dasharray="5 4" opacity="${op3(lop)}"`);
          s += lineSvg(c0, foot1, 'rgba(9,12,16,0.85)', 6.5, `stroke-linecap="round" opacity="${op3(lop)}"`) + lineSvg(c0, foot1, TXT, 2.6, `stroke-linecap="round" opacity="${op3(lop)}"`);
          const sq = 0.7, sgn = c1[0] < 0 ? 1 : -1;
          const k1 = P(c1[0] + sgn * sq, 0, ZF), k2 = P(c1[0] + sgn * sq, sq, ZF), k3 = P(c1[0], sq, ZF);
          s += `<polyline points="${f1(k1[0])},${f1(k1[1])} ${f1(k2[0])},${f1(k2[1])} ${f1(k3[0])},${f1(k3[1])}" fill="none" stroke="${TXT}" stroke-width="1.2" opacity="${op3(lop)}"/>`;
          if (st.w2 > 0.01) {
            s += lineSvg(P(c2[0], c2[1] + LF + 1.2, ZF), P(c2[0], -3.2, ZF), 'rgba(236,235,230,0.55)', 1.2, `stroke-dasharray="5 4" opacity="${op3(ac * st.w2 * 0.6)}"`);
            s += lineSvg(c0, foot2, 'rgba(9,12,16,0.85)', 6.5, `stroke-linecap="round" opacity="${op3(ac * st.w2 * 0.6)}"`) + lineSvg(c0, foot2, TXT, 2.6, `stroke-linecap="round" opacity="${op3(ac * st.w2 * 0.6)}"`);
          }
          s += pill(foot1[0] + (c1[0] < 0 ? -10 : 10), foot1[1] + 20, 'lever arm', { anchor: c1[0] < 0 ? 'end' : 'start', op: lop * (1 - st.w2) });
          // push arrows (perpendicular to the face, through each contact point)
          s += arrowSvg([P(c1[0], c1[1] + LF * st.F1, ZF), q1], COP, 4, 13, ac);
          if (st.w2 > 0.01) s += arrowSvg([P(c2[0], c2[1] + LF * st.F2, ZF), q2], COP, 4, 13, ac * smooth(st.w2 / 0.3));
          s += `<circle cx="${f1(q1[0])}" cy="${f1(q1[1])}" r="4" style="fill:${TXT}" opacity="${op3(ac)}"/>`;
          if (st.w2 > 0.01) s += `<circle cx="${f1(q2[0])}" cy="${f1(q2[1])}" r="4" style="fill:${TXT}" opacity="${op3(ac * st.w2)}"/>`;
          const pl = P(c1[0], c1[1] + LF * st.F1 + 0.2, ZF);
          s += pill(pl[0] + (c1[0] < 0 ? -12 : 12), pl[1] - 2, 'push', { anchor: c1[0] < 0 ? 'end' : 'start', color: COP, op: ac });
          // twist: arc round the arbor, length ∝ net torque
          const k = st.tq / (st.tqRef || 1), sweep = clamp(Math.abs(k), 0, 1.2) * deg(115);
          if (sweep > deg(4)) {
            const ccw = st.tq > 0, mid = PI;      // centred under the arbor (hand angle 180°)
            const a0 = ccw ? mid + sweep / 2 : mid - sweep / 2, a1 = ccw ? mid - sweep / 2 : mid + sweep / 2;
            s += arrowSvg(arcPts(UA, 4.6, a0, a1, ZF), COP, 4, 13, ac);
            const lp = P(0, -4.6 - 1.6, ZF);
            s += pill(lp[0], lp[1] + 6, 'twist', { color: COP, op: ac * smooth((sweep - deg(10)) / deg(20)) });
          }
          if (st.w2 > 0.2) s += pill(c0[0], c0[1] + 74, 'twists cancel', { color: COP, op: ac * smooth((st.w2 - 0.6) / 0.4), stroke: 'rgba(227,154,92,0.6)' });
        }
        // card
        fCard.style.opacity = op3(smooth((u - 0.06 * dur) / 0.5));
        const ph = [st.touch ? 1 : 0.25, smooth((u - st.tB - 0.12 * dur) / 0.5) * 0.75 + 0.25, smooth((st.w2 - 0.5) / 0.5) * 0.75 + 0.25];
        fLines.forEach((el, i) => { el.style.opacity = op3(ph[i]); });
        fRead.textContent = secOf(st.th).toFixed(1).replace('60.0', '0.0') + ' s';
        fTq.textContent = st.touch ? (Math.abs(st.tq / (st.tqRef || 1)) < 0.02 ? '0' : (st.tq > 0 ? 'anticlockwise' : 'clockwise')) : '–';
        fTq.style.fontSize = '17px';
        fTq.style.color = st.touch && Math.abs(st.tq / (st.tqRef || 1)) >= 0.02 ? COP : TXT;
        badgeTxt = 'Slow motion · in the watch: an instant'; badgeOp = WX.win(u, st.tB - 0.3, st.tC + 0.6, 0.4, 0.5);
        if (showLabels) {
          L.push({ k: an.face, text: 'Hammer: flat face', dx: -64, dy: -46, op: WX.win(u, 0.08 * dur, st.tB + 0.2 * dur, 0.5, 0.5) });
          L.push({ k: an.notch, text: 'Notch', dx: 70, dy: -10, op: smooth((u - st.tC + 0.6) / 0.5), accent: true });
          L.push({ k: onCam(UA, deg(232), 0.62), text: 'Heart cam', dx: -84, dy: 44, op: WX.win(u, 0.04 * dur, 0.3 * dur, 0.5, 0.5) });
        }
      } else if (mode === 'both') {
        const st = stBoth(u, p, dur);
        const pre = WX.win(u, 0.06 * dur, st.at + st.snap * 0.6, 0.5, 0.5);
        for (const [U, th0, th, key] of [[UA, st.thA0, st.thA, 'A'], [UB, st.thB0, st.thB, 'B']]) {
          const z = 0.4;
          // halfway line: 0 ↔ 30
          s += lineSvg(P(U.x, U.y + U.sc * 13.4, z), P(U.x, U.y - U.sc * 13.4, z), 'rgba(236,235,230,0.6)', 1.4, `stroke-dasharray="6 5" opacity="${op3(pre)}"`);
          const hb = P(U.x, U.y - U.sc * 12.6, z);
          s += pill(hb[0], hb[1], 'halfway', { op: pre, size: 11.5 });
          // the way back to zero: ghost before, solid while it happens
          s += arrowSvg(arcPts(U, 11.6, th0, 0, z), 'rgba(227,154,92,0.7)', 2, 11, smooth((u - 0.12 * dur) / 0.5) * (1 - smooth((u - st.at - st.snap) / 0.3)), '5 5');
          if (Math.abs(th - th0) > 0.02) s += arrowSvg(arcPts(U, 11.6, th0, th, z), COP, 4, 13, 1);
          // caption under the dial
          const cp = P(U.x, U.y - U.sc * 13.6, z), cap = caps[key];
          const sec = secOf(th0);
          const flown = smooth((u - st.at - st.snap * 0.5) / 0.4);
          cap.innerHTML = `<div style="font:500 22px 'IBM Plex Mono',monospace">${(Math.round(secOf(th) * 10) / 10).toFixed(Math.abs(th) < 1e-3 ? 0 : 1).replace(/^60(\.0)?$/, '0')} s</div>` +
            `<div style="font-size:14px;color:${MUT};margin-top:2px">started at ${sec.toFixed(0)} s: ${th0 < 0 ? 'past' : 'short of'} halfway</div>` +
            `<div style="font-size:16px;margin-top:3px;color:${COP};opacity:${op3(flown)}">${th0 < 0 ? 'flies forward (clockwise)' : 'flies back (anticlockwise)'}</div>`;
          cap.style.transform = `translate(${f1(cp[0] - 150)}px, ${f1(cp[1] + 12)}px)`;
          cap.style.opacity = op3(smooth((u - 0.04 * dur) / 0.4));
        }
        badgeTxt = 'Slow motion'; badgeOp = WX.win(u, st.at - 0.4, st.at + st.snap + 0.8, 0.3, 0.5);
      } else {
        const st = stLink(u, p, dur);
        // step strip
        const tHit = st.tF + st.dF * 0.85;
        const act = [st.press > 0.02 && u < st.tR, st.press > 0.05 && u < st.tR, u > st.tF && u < tHit + 0.2, u > st.tF + st.dF * 0.45 && u < st.tR, u > st.tR];
        steps.innerHTML = STEP_TXT.map((t, i) => `<span style="display:inline-block;margin:0 6px;font-size:13px;color:${act[i] ? COP : MUT};opacity:${act[i] ? 1 : 0.75}"><span style="font:500 11px 'IBM Plex Mono',monospace;margin-right:5px;color:${act[i] ? COP : '#6f7882'}">${i + 1}</span>${t}</span>`).join('<span style="color:#4b535c">›</span>');
        steps.style.opacity = op3(smooth((u - 0.05 * dur) / 0.5));
        badgeTxt = 'Slow motion'; badgeOp = WX.win(u, st.tP - 0.3, st.tR + st.dP + 0.8, 0.3, 0.5);
        // motion arrows: pusher in / out, hammer down / up
        const xh = contactX(st.alpha) + HEAD0, ya = PY + 3.3;
        const pIn = WX.win(u, st.tP - 0.25, st.tP + st.dP + 0.5, 0.25, 0.4), pOut = WX.win(u, st.tR - 0.25, st.tR + st.dP + 0.5, 0.25, 0.4);
        if (pIn > 0.01) s += arrowSvg([P(xh + HEADL + 2.6, ya, PZ), P(xh - 0.2, ya, PZ)], COP, 3.5, 12, pIn);
        if (pOut > 0.01) s += arrowSvg([P(xh - 0.2, ya, PZ), P(xh + HEADL + 2.6, ya, PZ)], COP, 3.5, 12, pOut);
        const endP = onHam([-44.5, 0], st.beta);
        const hDown = WX.win(u, st.tF, st.tF + st.dF * 0.9, 0.25, 0.35), hUp = WX.win(u, st.tR, st.tR + st.dP + 0.6, 0.2, 0.4);
        if (hDown > 0.01) s += arrowSvg([P(endP[0], endP[1] + 2.4, ZH1), P(endP[0], endP[1] - 2.6, ZH1)], COP, 3.5, 12, hDown);
        if (hUp > 0.01) s += arrowSvg([P(endP[0], endP[1] - 2.4, ZH1), P(endP[0], endP[1] + 2.6, ZH1)], COP, 3.5, 12, hUp);
        // the three points
        const tp = WX.win(u, 0.36 * dur, 0.62 * dur, 0.5, 0.5);
        if (tp > 0.01) {
          const pts = [XB_L, XC_L, XA_L].map(x => onHam([x, x === XC_L ? -1.15 : -FACE], st.beta));
          pts.forEach((q, i) => {
            const c = P(q[0], q[1], ZH1);
            s += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="11" fill="none" stroke="${COP}" stroke-width="2.2" opacity="${op3(tp)}"/>`;
          });
        }
        if (showLabels) {
          L.push({ k: an.pusher, text: 'Pusher B', dx: -26, dy: 66, op: smooth((u - 0.04 * dur) / 0.5) });
          L.push({ k: an.lever, text: 'Hammer operating lever', dx: 56, dy: -46, op: smooth((u - 0.1 * dur) / 0.5) });
          L.push({ k: an.spring, text: 'Hammer spring', dx: 40, dy: -40, op: smooth((u - 0.16 * dur) / 0.5) });
          const hn = WX.win(u, 0.42 * dur, 0.9 * dur, 0.5, 0.5);
          L.push({ k: an.hammer, text: 'Hammer: one piece, three points' + (hn > 0.01 ? `<div style="font-size:11.5px;color:${MUT};margin-top:2px;opacity:${op3(hn)}">design taken from Seiko's mechanical 8R28</div>` : ''), dx: -40, dy: -58, op: smooth((u - 0.3 * dur) / 0.5), accent: u > 0.36 * dur && u < 0.62 * dur });
          L.push({ k: P(UB.x + 3.4, UB.y - 4.2, 1), text: 'Heart · 60-min counter', dx: 30, dy: 70, op: smooth((u - 0.07 * dur) / 0.5) });
          L.push({ k: P(UA.x + 3.6, UA.y - 4.0, 1), text: 'Heart · stopwatch seconds', dx: 40, dy: 66, op: smooth((u - 0.07 * dur) / 0.5) });
        }
      }
      svg.innerHTML = s;
      labs.innerHTML = labelsHtml(L);
      badge.textContent = badgeTxt; badge.style.opacity = op3(badgeOp);
      tag.style.opacity = '1';
    },
  };
});
