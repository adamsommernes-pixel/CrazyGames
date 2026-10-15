// Close-up stage "quartz": the 32,768 Hz quartz tuning-fork crystal that keeps the 8T63's time.
//
// p.mode:
//   'can'          The sealed crystal unit. p.reveal (0..1) cuts the can away; by default it animates 0 → 1
//                  between 0.3·dur and 0.7·dur, revealing the fork mounted on its leads.
//   'lattice'      Stylised quartz lattice (Si and O atoms) between two gold electrode plates. First half: a press
//                  squeezes it and charges appear on its faces. Second half: a voltage bends it one way, then the
//                  reversed voltage bends it the other way. p.part: 'both' (default) | 'squeeze' | 'voltage'.
//   'fork'         A large fork in its flexural mode, prongs swinging in mirror image, ~15,000× slower than real,
//                  with the electrode polarity alternating in step.
//   'oscillator'   The fork, smaller, inside an amplifier loop (overlay). Start-up from rest, then steady.
//                  From p.halveAt (fraction of dur, default 0.58; p.halve:false hides it) a card halves 32,768
//                  fifteen times down to 1 per second.
//   'temperature'  Frequency error vs temperature: −0.034 ppm/°C² parabola peaking at 25 °C, 5–35 °C shaded,
//                  ±5.8 ppm (±15 s/month) band; a marker sweeps 25 → 5 → 35 → 25 °C with a live readout.
// The four set-ups stand side by side on one bench (can, lattice, fork, circuit along +x), so the director's
// camera blends between consecutive modes read as moves along the bench.
WX.registerStage('quartz', function (ctx) {
  'use strict';
  const { THREE, WX, group, overlay } = ctx;
  const { clamp, lerp, smooth, ease } = WX;
  const COP = '#e39a5c', PUL = '#78c3ff', TXT = '#ecebe6', MUT = '#9aa3ad';
  const cCop = new THREE.Color(WX.COL.copper), cPul = new THREE.Color(WX.COL.pulse);
  const F_FORK = 32768 / 15000;   // fork mode: shown ~15,000× slower (≈2.2 Hz)
  const F_OSC = 32768 / 30000;    // oscillator / temperature: shown ~30,000× slower (≈1.1 Hz)
  const ORG = { can: new THREE.Vector3(0, 0, 0), lattice: new THREE.Vector3(170, 0, 0), fork: new THREE.Vector3(340, 0, 0), circuit: new THREE.Vector3(500, 0, 0) };
  const frac = x => x - Math.floor(x);
  const MINUS = '−';
  const fmtSigned = (v, d = 1) => { const s = Math.abs(v).toFixed(d); return (+s === 0 ? '' : v < 0 ? MINUS : '+') + s; };

  // ───────────────────────── geometry helpers ─────────────────────────
  function mergeGeos(list) {
    const parts = list.map(g => (g.index ? g.toNonIndexed() : g));
    let n = 0; parts.forEach(g => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    parts.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return out;
  }
  const cylX = (r, x0, x1, seg = 32) => { const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); return g; };
  const boxAt = (w, h, d, x, y, z, sy = 1) => { const g = new THREE.BoxGeometry(w, h, d, 1, sy, 1); g.translate(x, y, z); return g; };
  const ball = (r, x, y, z) => { const g = new THREE.SphereGeometry(r, 14, 10); g.translate(x, y, z); return g; };
  const GOLD_BASE = new THREE.Color(0x2a1c08);
  const goldMat = (extra) => WX.mat('gold', Object.assign({ metalness: 0.6, roughness: 0.34, emissive: GOLD_BASE.clone() }, extra || {}));
  const setGlow = (mat, v, k = 1) => { if (v >= 0) mat.emissive.copy(cCop).multiplyScalar(v * k); else mat.emissive.copy(cPul).multiplyScalar(-v * k); mat.emissive.add(GOLD_BASE); };

  // ───────────────────────── tuning fork (shared builder) ─────────────────────────
  // Fork-local units: stem bottom at y = 0, prongs along +y, fork plane = XY, thickness along z.
  // Shape and proportions are illustrative, not to scale.
  const FK = { w: 4.2, gap: 5.0, L: 26, bH: 9, sW: 6.4, sH: 5, t: 2.4, bev: 0.2 };
  FK.W = 2 * FK.w + FK.gap; FK.y0 = FK.sH + FK.bH; FK.cx = FK.gap / 2 + FK.w / 2; FK.len = FK.y0 + FK.L;
  const modeShape = e => (e <= 0 ? 0 : e >= 1 ? 1 : e * e * (3 - e) / 2);   // cantilever deflection shape, tip = 1
  function forkOutline() {
    const { gap, L, sW, sH, W, y0 } = FK, r = gap / 2, n = 20, s = new THREE.Shape();
    s.moveTo(-sW / 2, 0); s.lineTo(sW / 2, 0); s.lineTo(sW / 2, sH); s.lineTo(W / 2, sH); s.lineTo(W / 2, y0);
    for (let i = 1; i <= n; i++) s.lineTo(W / 2, y0 + L * i / n);
    s.lineTo(r, y0 + L);
    for (let i = n - 1; i >= 0; i--) s.lineTo(r, y0 + r + (L - r) * i / n);
    s.absarc(0, y0 + r, r, 0, Math.PI, true);
    for (let i = 1; i <= n; i++) s.lineTo(-r, y0 + r + (L - r) * i / n);
    s.lineTo(-W / 2, y0 + L);
    for (let i = n - 1; i >= 0; i--) s.lineTo(-W / 2, y0 + L * i / n);
    s.lineTo(-W / 2, sH); s.lineTo(-sW / 2, sH); s.closePath();
    return s;
  }
  // Two electrode terminals: A = front strip on the left prong + outer side of the right prong + left pad;
  // B = the mirror image. Driving A against B makes the prongs bend apart or together.
  function buildFork(opt = {}) {
    const { t, W, y0, L, cx, bev, sH } = FK, zf = t / 2;
    const g = new THREE.Group();
    const body = new THREE.Mesh(WX.extrude(forkOutline(), -zf, zf, 12, bev), WX.mat('quartz', { opacity: opt.opacity || 0.74, color: new THREE.Color(0xe4edf3), roughness: 0.1, emissive: new THREE.Color(0x0c1218) }));
    const e0 = y0 + 0.1 * L, e1 = y0 + 0.8 * L, eh = e1 - e0, em = (e0 + e1) / 2, sx0 = W / 2 + bev + 0.05;
    const term = sx => mergeGeos([
      boxAt(1.8, eh, 0.1, sx * cx, em, zf + 0.05, 18),
      boxAt(0.1, eh, t * 0.56, -sx * sx0, em, 0, 18),
      WX.extrude(WX.barShape([[sx * cx, e0 + 0.5], [sx * cx, sH + 3.6], [sx * 1.7, sH + 1.2], [sx * 1.7, 2.4]], 1.0), zf, zf + 0.08, 4),
      (() => { const q = WX.extrude(WX.roundRect(2.2, 2.8, 0.4), zf, zf + 0.09, 6); q.translate(sx * 1.7, 2.0, 0); return q; })(),
    ]);
    const matA = goldMat(), matB = goldMat();
    const mA = new THREE.Mesh(term(-1), matA), mB = new THREE.Mesh(term(1), matB);
    const trims = new THREE.Mesh(mergeGeos([-1, 1].map(sx => boxAt(FK.w * 0.72, 0.09 * L, 0.12, sx * cx, y0 + 0.91 * L, zf + 0.06, 3))), goldMat({ roughness: 0.42 }));
    g.add(body, mA, mB, trims);
    const defs = [body, mA, mB, trims].map(m => { m.geometry.computeBoundingSphere(); const pos = m.geometry.attributes.position; return { pos, rest: Float32Array.from(pos.array) }; });
    let lastA = null;   // cache only: the pose is a pure function of A
    let pose = function (A, drive) {
      if (A !== lastA) {
        for (const d of defs) {
          const a = d.pos.array, r = d.rest;
          for (let i = 0; i < a.length; i += 3) { const e = (r[i + 1] - y0) / L; a[i] = e > 0 ? r[i] + Math.sign(r[i]) * A * modeShape(e) : r[i]; }
          d.pos.needsUpdate = true;
        }
        lastA = A;
      }
      setGlow(matA, drive, 1.25); setGlow(matB, -drive, 1.25);
    };
    // marker objects (not registered as anchors) for overlay use
    const mk = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); return o; };
    const edgeX = W / 2 + bev;
    const marks = { padA: mk(-1.7, 2.0, zf + 0.1), padB: mk(1.7, 2.0, zf + 0.1), tipL: mk(-edgeX, y0 + 0.93 * L, zf), tipR: mk(edgeX, y0 + 0.93 * L, zf), strip: mk(cx, y0 + 0.45 * L, zf + 0.1) };
    const pose0 = pose;
    pose = (A, drive) => { pose0(A, drive); const d = A * modeShape(0.93); marks.tipL.position.x = -edgeX - d; marks.tipR.position.x = edgeX + d; };
    pose(0, 0);
    return { g, pose: (A, d) => pose(A, d), body, marks };
  }
  function forkRestOutline(z, opacity) {
    const pts = forkOutline().getPoints(6).map(p => new THREE.Vector3(p.x, p.y, z));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity, depthWrite: false }));
    return line;
  }

  // ───────────────────────── A · the crystal can (real proportions, mm, scaled ×7) ─────────────────────────
  const SC = 7, RAD = 1.0;
  const canG = new THREE.Group(); canG.position.copy(ORG.can); canG.scale.setScalar(SC); group.add(canG);
  const tubeHalf = (th0) => { const g = new THREE.CylinderGeometry(RAD, RAD, 4.8, 56, 1, true, th0, Math.PI); g.rotateZ(-Math.PI / 2); g.translate(-0.25, 0, 0); return g; };
  const domeHalf = (ph0) => { const g = new THREE.SphereGeometry(RAD, 40, 10, ph0, Math.PI, 0, Math.PI / 2); g.rotateZ(Math.PI / 2); g.scale(0.35, 1, 1); g.translate(-2.65, 0, 0); return g; };
  const canFrontMat = WX.mat('steel', { side: THREE.DoubleSide, transparent: true });
  const canFront = new THREE.Mesh(mergeGeos([tubeHalf(-Math.PI / 2), domeHalf(0)]), canFrontMat);
  const canBack = new THREE.Mesh(mergeGeos([tubeHalf(Math.PI / 2), domeHalf(Math.PI)]), WX.mat('brushed', { side: THREE.DoubleSide }));
  canFront.renderOrder = 3;
  canG.add(canFront, canBack);
  // cut edges of the back half (wall thickness)
  canG.add(new THREE.Mesh(mergeGeos([boxAt(4.8, 0.06, 0.05, -0.25, RAD - 0.03, 0), boxAt(4.8, 0.06, 0.05, -0.25, -RAD + 0.03, 0)]), WX.mat('steel')));
  // plug, glass seal and leads
  canG.add(new THREE.Mesh(mergeGeos([cylX(0.93, 1.85, 2.15, 40), cylX(1.03, 2.15, 2.92, 40)]), WX.mat('brushed')));
  canG.add(new THREE.Mesh(cylX(0.86, 2.92, 2.99, 40), WX.mat('plastic')));
  const LEAD_Y = 0.32, LEAD_Z = -0.2;
  canG.add(new THREE.Mesh(mergeGeos([
    ...[-1, 1].map(s => { const g = cylX(0.075, 1.05, 6.8, 12); g.translate(0, s * LEAD_Y, LEAD_Z); return g; }),
    ...[-1, 1].map(s => ball(0.1, 1.3, s * 0.3, -0.1)),
  ]), WX.mat('pin')));
  // the fork inside, at real scale (about 4 mm long), lying along the can axis with its base on the leads
  const canFork = buildFork({ opacity: 0.86 });
  canFork.g.scale.setScalar(0.1); canFork.g.rotation.z = Math.PI / 2; canFork.g.position.set(1.55, 0, 0);
  canG.add(canFork.g);
  ctx.anchor('can', canG, -0.6, RAD, 0.25);
  ctx.anchor('leads', canG, 5.0, LEAD_Y, LEAD_Z);
  ctx.anchor('canfork', canG, -1.4, 0.46, 0.12);
  const vacMark = new THREE.Object3D(); vacMark.position.set(-2.62, -0.5, -0.2); canG.add(vacMark);

  // ───────────────────────── B · the lattice block ─────────────────────────
  // Stylised honeycomb: Si (+) on the "up" sites of each zigzag chain, O (−) on the "down" sites. Squeezing
  // flattens the zigzags with bond lengths fixed, so the Si sublattice drops relative to the O sublattice:
  // the centres of + and − charge separate and the faces become charged (top −, bottom +).
  const LT = { b: 3.2, h0: 1.6, cols: 15, chains: 6, pad: 3.0, D: 7, zs: [0] };
  LT.dx0 = Math.sqrt(LT.b * LT.b - LT.h0 * LT.h0);
  const Hof = h => 2 * LT.pad + (LT.chains - 1) * (h + LT.b) + h;
  const Wof = dx => 2 * LT.pad + (LT.cols - 1) * dx;
  LT.H0 = Hof(LT.h0); LT.W0 = Wof(LT.dx0);
  const latG = new THREE.Group(); latG.position.set(ORG.lattice.x, -15, 0); group.add(latG);
  const atoms = [];
  LT.zs.forEach((z, li) => { for (let j = 0; j < LT.chains; j++) for (let i = 0; i < LT.cols; i++) atoms.push({ i, j, z, li, up: (i + j) % 2 === 1, si: -1, oi: -1 }); });
  const idx = (li, i, j) => li * LT.cols * LT.chains + j * LT.cols + i;
  const bonds = [];
  LT.zs.forEach((z, li) => { for (let j = 0; j < LT.chains; j++) for (let i = 0; i < LT.cols; i++) {
    if (i < LT.cols - 1) bonds.push([idx(li, i, j), idx(li, i + 1, j)]);
    if ((i + j) % 2 === 1 && j < LT.chains - 1) bonds.push([idx(li, i, j), idx(li, i, j + 1)]);
  } });
  let nSi = 0, nO = 0; atoms.forEach(a => { if (a.up) a.si = nSi++; else a.oi = nO++; });
  const sph = new THREE.SphereGeometry(1, 16, 12);
  const siMesh = new THREE.InstancedMesh(sph, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.35 }), nSi);
  const oMesh = new THREE.InstancedMesh(sph, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.45 }), nO);
  const bondMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x8f99a4, metalness: 0.4, roughness: 0.45 }), bonds.length);
  const SI_COL = [new THREE.Color(0xd9e0e8)], O_COL = [new THREE.Color(0xd4644a)];
  atoms.forEach(a => { if (a.up) siMesh.setColorAt(a.si, SI_COL[a.li]); else oMesh.setColorAt(a.oi, O_COL[a.li]); });
  [siMesh, oMesh, bondMesh].forEach(m => { m.frustumCulled = false; latG.add(m); });
  // translucent crystal block + its outline, deformed with the lattice
  const blockGeo = new THREE.BoxGeometry(LT.W0, LT.H0, LT.D, 12, 12, 1); blockGeo.translate(0, LT.H0 / 2, 0);
  const block = new THREE.Mesh(blockGeo, new THREE.MeshPhysicalMaterial({ color: 0xcfe3ee, metalness: 0, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.1, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), new THREE.LineBasicMaterial({ color: 0xbfd6e6, transparent: true, opacity: 0.4 }));
  block.renderOrder = 2; latG.add(block, edges);
  const blockRest = Float32Array.from(blockGeo.attributes.position.array), edgeRest = Float32Array.from(edges.geometry.attributes.position.array);
  // electrode plates (gold): bottom fixed, top rides on the block
  const PW = LT.W0 + 8, PT = 1.4, PD = LT.D + 5;
  const plateBotMat = goldMat(), plateTopMat = plateBotMat;
  const plateBot = new THREE.Mesh(new THREE.BoxGeometry(PW, PT, PD), plateBotMat); plateBot.position.y = -PT / 2; latG.add(plateBot);
  const plateTop = new THREE.Mesh(new THREE.BoxGeometry(PW, PT, PD), plateTopMat); latG.add(plateTop);
  const mkL = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const ptTopR = mkL(plateTop, PW / 2, 0, PD / 2), ptBotR = mkL(plateBot, PW / 2, 0, PD / 2);
  // press
  const press = new THREE.Group(); latG.add(press);
  const pressBlock = new THREE.Mesh(new THREE.BoxGeometry(LT.W0 * 0.62, 5.5, PD + 1), WX.mat('brushed')); pressBlock.position.y = 2.75; press.add(pressBlock);
  press.add(new THREE.Mesh(WX.cylY(1.6, 5.5, 40), WX.mat('steel')));
  const arrowMat = new THREE.MeshBasicMaterial({ color: WX.COL.copper, transparent: true, depthWrite: false, toneMapped: false });
  const arrow = new THREE.Group(); arrow.position.set(-LT.W0 * 0.38, 0, 0); press.add(arrow);
  arrow.add(new THREE.Mesh(WX.cylY(0.55, 4.2, 11), arrowMat));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 20), arrowMat); cone.rotation.x = Math.PI; cone.position.y = 2.8; arrow.add(cone);
  const arrow2 = arrow.clone(); arrow2.position.x = LT.W0 * 0.38; press.add(arrow2);
  // electric field chevrons inside the block (instanced, additive glow)
  const chev = WX.polyShape([[-1.3, 0.55], [0, -0.65], [1.3, 0.55], [1.3, 1.25], [0, 0.05], [-1.3, 1.25]]);
  const chevMat = WX.mat('glow'); chevMat.side = THREE.DoubleSide;
  const CH_COLS = 7, CH_ROWS = 4;
  const chevMesh = new THREE.InstancedMesh(new THREE.ShapeGeometry(chev), chevMat, CH_COLS * CH_ROWS);
  chevMesh.frustumCulled = false; chevMesh.renderOrder = 4; latG.add(chevMesh);
  ctx.anchor('lattice', latG, LT.W0 * 0.28, LT.H0 * 0.72, LT.D / 2);
  ctx.anchor('plate', plateBot, -PW * 0.36, 0, PD / 2);
  ctx.anchor('press', press, -LT.W0 * 0.2, 5.5, PD / 2);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
  const atomPos = atoms.map(() => new THREE.Vector3());
  function latGeom(s, V) { const h = LT.h0 * (1 - 0.42 * s - 0.2 * V); const dx = Math.sqrt(LT.b * LT.b - h * h); return { h, dx, H: Hof(h), W: Wof(dx), bend: 4.8 * V }; }
  const bendX = (G, yn) => G.bend * (0.55 * yn + 0.45 * yn * yn);
  const mapPt = (G, x, y, z, out) => { const yn = y / LT.H0; return out.set(x * G.W / LT.W0 + bendX(G, yn), yn * G.H, z); };
  function latticeState(u, p, dur) {
    const part = p.part || 'both';
    const q1 = part === 'squeeze' ? u / dur : u / (0.48 * dur), q2 = part === 'voltage' ? u / dur : (u - 0.5 * dur) / (0.5 * dur);
    let s = 0, pr = 0, V = 0, away = 1;
    if (part !== 'voltage') { const Q = clamp(q1); pr = smooth((Q - 0.06) / 0.2) * (1 - smooth((Q - 0.8) / 0.17)); s = smooth((Q - 0.26) / 0.22) * (1 - smooth((Q - 0.7) / 0.12)); away = smooth((Q - 0.9) / 0.1); }
    if (part !== 'squeeze' && q2 >= 0) { const Q = clamp(q2); V = smooth((Q - 0.05) / 0.17) - 2 * smooth((Q - 0.5) / 0.2); }
    const step = part === 'voltage' ? 2 : part === 'squeeze' ? 1 : (u < 0.49 * dur ? 1 : 2);
    return { s, pr, V, step, away, phase: u };
  }
  function poseLattice(st) {
    const G = latGeom(st.s, st.V);
    atoms.forEach((a, k) => { const y = LT.pad + a.j * (G.h + LT.b) + (a.up ? G.h : 0); atomPos[k].set((a.i - (LT.cols - 1) / 2) * G.dx + bendX(G, y / G.H), y, a.z); });
    atoms.forEach((a, k) => {
      const r = a.up ? 1.05 : 0.74; _s.set(r, r, r); _m.compose(atomPos[k], _q.identity(), _s);
      if (a.up) siMesh.setMatrixAt(a.si, _m); else oMesh.setMatrixAt(a.oi, _m);
    });
    bonds.forEach(([i, j], k) => {
      const A = atomPos[i], B = atomPos[j]; _d.subVectors(B, A); const len = _d.length();
      _q.setFromUnitVectors(_Y, _d.multiplyScalar(1 / len)); _v.addVectors(A, B).multiplyScalar(0.5); _s.set(1, len, 1);
      bondMesh.setMatrixAt(k, _m.compose(_v, _q, _s));
    });
    siMesh.instanceMatrix.needsUpdate = oMesh.instanceMatrix.needsUpdate = bondMesh.instanceMatrix.needsUpdate = true;
    const bp = blockGeo.attributes.position.array;
    for (let i = 0; i < bp.length; i += 3) { mapPt(G, blockRest[i], blockRest[i + 1], blockRest[i + 2], _v); bp[i] = _v.x; bp[i + 1] = _v.y; bp[i + 2] = _v.z; }
    blockGeo.attributes.position.needsUpdate = true; blockGeo.computeVertexNormals();
    const ep = edges.geometry.attributes.position.array;
    for (let i = 0; i < ep.length; i += 3) { mapPt(G, edgeRest[i], edgeRest[i + 1], edgeRest[i + 2], _v); ep[i] = _v.x; ep[i + 1] = _v.y; ep[i + 2] = _v.z; }
    edges.geometry.attributes.position.needsUpdate = true;
    plateTop.position.set(bendX(G, 1), G.H + PT / 2, 0);   // the mapping is a shear, so the top face stays level
    // press: from parked high above, down onto the top plate
    const contact = G.H + PT, parked = LT.H0 + PT + 5;
    press.position.set(bendX(G, 1), lerp(parked, contact, st.pr) + 40 * (st.away || 0), 0);
    press.visible = (st.away || 0) < 0.999;
    arrowMat.opacity = 0.95 * clamp(st.pr * 1.5);
    arrow.position.y = arrow2.position.y = 5.5 + 2.2 * (1 - st.s);
    // field chevrons: E points from the + plate to the − plate
    const amp = Math.abs(st.V);
    chevMesh.visible = amp > 0.02; chevMat.opacity = 0.9 * clamp(amp * 1.3);
    const dir = st.V >= 0 ? -1 : 1;
    for (let c = 0; c < CH_COLS; c++) for (let r = 0; r < CH_ROWS; r++) {
      const yn = frac(r / CH_ROWS + dir * st.phase * 0.32), x = -LT.W0 / 2 + 6 + c * (LT.W0 - 12) / (CH_COLS - 1);
      const sc = smooth(yn / 0.16) * smooth((1 - yn) / 0.16) * 1.1 + 1e-4;
      mapPt(G, x, yn * LT.H0, 0, _v); _q.setFromAxisAngle(_Z, st.V >= 0 ? 0 : Math.PI); _s.set(sc, sc, sc);
      chevMesh.setMatrixAt(c * CH_ROWS + r, _m.compose(_v, _q, _s));
    }
    chevMesh.instanceMatrix.needsUpdate = true;
    return G;
  }

  // ───────────────────────── C · the big fork ─────────────────────────
  const big = buildFork({ opacity: 0.72 });
  big.g.position.set(ORG.fork.x, -21, 0); group.add(big.g);
  big.g.add(forkRestOutline(FK.t / 2 + 0.25, 0.32));
  ctx.anchor('fork', big.g, -FK.cx - FK.w / 2, FK.y0 + 0.62 * FK.L, FK.t / 2);
  ctx.anchor('electrode', big.g, FK.cx, FK.y0 + 0.4 * FK.L, FK.t / 2 + 0.1);

  // ───────────────────────── D · the small fork in the circuit ─────────────────────────
  const small = buildFork({ opacity: 0.76 });
  const SS = 0.55;
  small.g.scale.setScalar(SS); small.g.rotation.z = -Math.PI / 2; small.g.position.copy(ORG.circuit); group.add(small.g);
  small.g.add(new THREE.Mesh(mergeGeos([-1, 1].map(s => { const g = WX.cylY(0.34, -7, 1.6, 12); g.translate(s * 1.7, 0, 0); return g; })), WX.mat('pin')));
  const leadA = new THREE.Object3D(); leadA.position.set(-1.7, -7, 0); small.g.add(leadA);
  const leadB = new THREE.Object3D(); leadB.position.set(1.7, -7, 0); small.g.add(leadB);
  ctx.anchor('oscfork', small.g, FK.cx, FK.y0 + 0.6 * FK.L, FK.t / 2);
  const smallTint = { cold: new THREE.Color(0xc7dcff), warm: new THREE.Color(0xffd9bf), base: small.body.material.color.clone() };

  // ───────────────────────── overlay scaffolding (designed at 1280×720, scaled to the view) ─────────────────────────
  const SVGNS = 'http://www.w3.org/2000/svg';
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0;';
  overlay.appendChild(root);
  const cards = document.createElement('div'); cards.style.cssText = 'position:absolute;inset:0;'; root.appendChild(cards);
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', '1280'); svg.setAttribute('height', '720'); svg.setAttribute('viewBox', '0 0 1280 720');
  svg.style.left = '0px'; svg.style.top = '0px'; root.appendChild(svg);
  const S = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; };
  // svg text: the shared stylesheet sets text fill, so colours go in the inline style
  const T_ = (parent, x, y, text, attrs = {}) => { const a = Object.assign({ x, y }, attrs), fill = a.fill; delete a.fill; const e = S('text', a, parent); if (fill) e.style.fill = fill; e.textContent = text; return e; };
  const card = (css, html) => { const d = document.createElement('div'); d.className = 'ov-card'; d.style.cssText = css; d.innerHTML = html; cards.appendChild(d); return d; };
  const q = (elm, sel) => elm.querySelector(sel);
  const setA = (e, attrs) => { for (const k in attrs) { if (k === 'fill' && e.tagName === 'text') e.style.fill = attrs[k]; else e.setAttribute(k, typeof attrs[k] === 'number' ? attrs[k].toFixed(1) : attrs[k]); } };
  // leader label: dot on the part, thin leader, boxed text
  function mkLabel(parent, text, opts = {}) {
    const g = S('g', {}, parent);
    const line = S('line', { stroke: 'rgba(236,235,230,0.6)', 'stroke-width': 1 }, g);
    S('circle', { r: 3.5, fill: COP, cx: 0, cy: 0, class: 'dot' }, g);
    const bg = S('rect', { rx: 4, fill: 'rgba(9,12,16,0.84)', stroke: 'rgba(205,218,232,0.2)' }, g);
    const tx = T_(g, 0, 0, text, { 'font-size': opts.size || 13, 'dominant-baseline': 'central', fill: opts.color || TXT });
    const w = text.length * (opts.size || 13) * 0.6 + 16;
    const dot = g.querySelector('.dot');
    return {
      g, set(x, y, dx, dy, op) {
        const lx = x + dx, ly = y + dy, left = dx < 0, bx = left ? lx - w : lx;
        setA(line, { x1: x, y1: y, x2: lx, y2: ly }); setA(dot, { cx: x, cy: y });
        setA(bg, { x: bx, y: ly - 12, width: w, height: 24 }); setA(tx, { x: bx + 8, y: ly + 1 });
        g.setAttribute('opacity', clamp(op).toFixed(3));
      },
    };
  }
  let ovS = 1, ovX = 0, ovY = 0;
  const _pp = {};
  const proj = (o) => { WX.project(o, _pp); return { x: (_pp.x - ovX) / ovS, y: (_pp.y - ovY) / ovS, v: _pp.visible }; };
  const projW = (v3) => proj({ x: v3.x, y: v3.y, z: v3.z });
  const OV = {};
  const mkMode = name => { const g = S('g', {}); const cardsOf = []; OV[name] = { g, cards: cardsOf, update: () => {} }; return OV[name]; };

  // ── A · can overlay ──
  {
    const m = mkMode('can');
    m.cards.push(card('left:40px;top:86px;width:300px;', `
      <div class="ov-k">Quartz crystal unit</div>
      <div style="font-size:15px;line-height:1.45;margin-top:5px">A sealed metal can, a few millimetres long, with two leads</div>
      <div data-in style="font-size:15px;line-height:1.45;opacity:0;overflow:hidden;max-height:0">Inside: a quartz <span class="ov-accent">tuning fork</span>, sealed in a vacuum</div>`));
    const inside = q(m.cards[0], '[data-in]');
    const lFork = mkLabel(m.g, 'quartz tuning fork'), lVac = mkLabel(m.g, 'vacuum', { color: PUL }), lLeads = mkLabel(m.g, 'leads to the circuit');
    const canMark = WX.anchors['quartz:canfork'], leadsMark = WX.anchors['quartz:leads'];
    m.update = (u, p, dur) => {
      const k = revealOf(u, p, dur);
      const ki = smooth((k - 0.5) / 0.4);
      inside.style.opacity = smooth((k - 0.6) / 0.3).toFixed(3); inside.style.maxHeight = (ki * 56).toFixed(1) + 'px'; inside.style.marginTop = (ki * 8).toFixed(1) + 'px';
      const a = proj(canMark), b = proj(vacMark), c = proj(leadsMark);
      lFork.set(a.x, a.y, -60, -92, smooth((k - 0.7) / 0.25));
      lVac.set(b.x, b.y, -50, 78, smooth((k - 0.8) / 0.2));
      lLeads.set(c.x, c.y, 26, 64, smooth((u - 0.12 * dur) / 0.5));
    };
  }

  // ── B · lattice overlay ──
  const NCH = 8;
  function mkBadge(parent, r = 10) {
    const g = S('g', {}, parent);
    const c = S('circle', { r, cx: 0, cy: 0, stroke: 'rgba(9,12,16,0.85)', 'stroke-width': 2 }, g);
    const t = T_(g, 0, 0.5, '+', { 'font-size': r * 1.9, 'font-weight': 600, fill: '#0b0e13', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    return { set(x, y, positive, op) { g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); c.setAttribute('fill', positive ? COP : PUL); t.textContent = positive ? '+' : MINUS; g.setAttribute('opacity', clamp(op).toFixed(3)); } };
  }
  const CHARGE_STYLE = col => ({ 'font-size': 30, 'font-weight': 600, fill: col, 'text-anchor': 'middle', 'dominant-baseline': 'central', stroke: 'rgba(9,12,16,0.9)', 'stroke-width': 5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
  {
    const m = mkMode('lattice');
    m.cards.push(card('left:40px;top:86px;width:292px;', `
      <div class="ov-k">Piezoelectric effect</div>
      <div data-s1 style="font-size:15px;line-height:1.4;margin-top:8px"><span class="ov-accent" style="font-family:'IBM Plex Mono',monospace">1</span>&nbsp; Squeeze it → <b style="font-weight:600">charges appear</b></div>
      <div data-s2 style="font-size:15px;line-height:1.4;margin-top:6px"><span class="ov-accent" style="font-family:'IBM Plex Mono',monospace">2</span>&nbsp; Apply a voltage → <b style="font-weight:600">it bends</b></div>
      <div style="display:flex;gap:14px;align-items:center;margin-top:10px;font-size:12px" class="ov-muted">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#d9e0e8;vertical-align:-1px"></span> Si</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d4644a;vertical-align:0"></span> O</span>
        <span>stylised, motion exaggerated</span></div>`));
    const s1 = q(m.cards[0], '[data-s1]'), s2 = q(m.cards[0], '[data-s2]');
    const top = [], bot = [];
    for (let i = 0; i < NCH; i++) {
      top.push(mkBadge(m.g)); bot.push(mkBadge(m.g));
    }
    // the instrument at the plates' right ends: a voltmeter while squeezing, a voltage source afterwards
    const wires = S('path', { fill: 'none', stroke: 'rgba(236,235,230,0.7)', 'stroke-width': 1.6 }, m.g);
    const dev = S('g', {}, m.g);
    const DX = 1150, DY = 372;
    S('rect', { x: DX - 52, y: DY - 58, width: 104, height: 116, rx: 10, fill: 'rgba(11,14,19,0.86)', stroke: 'rgba(205,218,232,0.28)' }, dev);
    const meter = S('g', {}, dev);
    S('path', { d: `M ${DX - 34} ${DY + 6} A 34 34 0 0 1 ${DX + 34} ${DY + 6}`, fill: 'none', stroke: 'rgba(236,235,230,0.5)', 'stroke-width': 1.5 }, meter);
    for (let i = -2; i <= 2; i++) { const a = i * 0.35 - Math.PI / 2; S('line', { x1: DX + 30 * Math.cos(a), y1: DY + 6 + 30 * Math.sin(a), x2: DX + 36 * Math.cos(a), y2: DY + 6 + 36 * Math.sin(a), stroke: 'rgba(236,235,230,0.6)', 'stroke-width': 1.2 }, meter); }
    const needle = S('line', { x1: DX, y1: DY + 6, x2: DX, y2: DY - 26, stroke: COP, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, meter);
    S('circle', { cx: DX, cy: DY + 6, r: 3, fill: COP }, meter);
    T_(meter, DX, DY + 34, 'voltmeter', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    const src = S('g', {}, dev);
    S('line', { x1: DX - 26, y1: DY - 8, x2: DX + 26, y2: DY - 8, stroke: TXT, 'stroke-width': 2.4 }, src);
    S('line', { x1: DX - 14, y1: DY + 4, x2: DX + 14, y2: DY + 4, stroke: TXT, 'stroke-width': 4 }, src);
    const srcP = T_(src, DX + 36, DY - 8, '+', { 'font-size': 16, 'font-weight': 600, fill: COP, 'dominant-baseline': 'central' });
    const srcM = T_(src, DX + 36, DY + 5, MINUS, { 'font-size': 16, 'font-weight': 600, fill: PUL, 'dominant-baseline': 'central' });
    T_(src, DX, DY + 34, 'voltage', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    S('line', { x1: DX, y1: DY - 58, x2: DX, y2: DY - 8, stroke: 'rgba(236,235,230,0.7)', 'stroke-width': 1.6 }, src);
    S('line', { x1: DX, y1: DY + 4, x2: DX, y2: DY + 58, stroke: 'rgba(236,235,230,0.7)', 'stroke-width': 1.6 }, src);
    const _w = new THREE.Vector3();
    m.update = (u, p, dur) => {
      const st = latticeState(u, p, dur), G = latGeom(st.s, st.V);
      s1.style.opacity = st.step === 1 ? '1' : '0.42'; s2.style.opacity = st.step === 2 ? '1' : '0.42';
      // charge rows at the two faces: induced while squeezed (top −, bottom +), then the applied polarity
      const sq = st.step === 1, topPos = !sq && st.V >= 0;
      const chOp = sq ? clamp(st.s * 1.4) : clamp(Math.abs(st.V) * 1.6);
      for (let i = 0; i < NCH; i++) {

        const x = -LT.W0 / 2 + 3.5 + i * (LT.W0 - 7) / (NCH - 1);
        mapPt(G, x, LT.H0 - 1.3, LT.D / 2, _w); latG.localToWorld(_w); let P = projW(_w); top[i].set(P.x, P.y, topPos, chOp);
        mapPt(G, x, 1.3, LT.D / 2, _w); latG.localToWorld(_w); P = projW(_w); bot[i].set(P.x, P.y, !topPos, chOp);
      }
      const pos = st.V >= 0;
      // wires from the plates' right ends to the instrument (kept below y = 262 near the right edge)
      const c = proj(ptTopR), d = proj(ptBotR), xr = Math.max(c.x, d.x) + 34;
      wires.setAttribute('d', `M ${c.x.toFixed(1)} ${c.y.toFixed(1)} L ${xr.toFixed(1)} ${c.y.toFixed(1)} L ${xr.toFixed(1)} 282 L ${DX} 282 L ${DX} ${DY - 58} M ${d.x.toFixed(1)} ${d.y.toFixed(1)} L ${DX} ${d.y.toFixed(1)} L ${DX} ${DY + 58}`);
      const meterOn = st.step === 1;
      meter.setAttribute('opacity', meterOn ? '1' : '0'); src.setAttribute('opacity', meterOn ? '0' : '1');
      const ang = -0.75 * st.s;
      setA(needle, { x2: DX + 32 * Math.sin(ang), y2: DY + 6 - 32 * Math.cos(ang) });
      srcP.setAttribute('y', pos ? DY - 8 : DY + 5); srcM.setAttribute('y', pos ? DY + 5 : DY - 8);
      src.setAttribute('opacity', meterOn ? '0' : (0.45 + 0.55 * clamp(Math.abs(st.V) * 2)).toFixed(3));
    };
  }

  // ── C · fork overlay ──
  {
    const m = mkMode('fork');
    m.cards.push(card('left:892px;top:300px;width:330px;', `
      <div class="ov-k">Quartz tuning fork</div>
      <div class="ov-big" style="margin-top:4px"><span class="ov-accent">32,768</span> Hz</div>
      <div style="font-size:13.5px;margin-top:2px">shown ~15,000× slower</div>
      <div class="ov-muted" style="font-size:12.5px;margin-top:6px;line-height:1.45">Swing exaggerated. The prongs move in mirror image, apart and together. The electrode polarity (<span class="ov-accent">+</span> / <span class="ov-pulse">${MINUS}</span>) flips in step.</div>`));
    const lEl = mkLabel(m.g, 'gold electrodes');
    const pA = mkBadge(m.g, 12), pB = mkBadge(m.g, 12);
    const arrows = [0, 1].map(() => S('path', { fill: COP, stroke: 'none' }, m.g));
    const arrowPath = (x, y, dir, len) => { const t = x + dir * len, hb = 7; return `M ${x.toFixed(1)} ${(y - 1.6).toFixed(1)} L ${(t - dir * 10).toFixed(1)} ${(y - 1.6).toFixed(1)} L ${(t - dir * 10).toFixed(1)} ${(y - hb).toFixed(1)} L ${t.toFixed(1)} ${y.toFixed(1)} L ${(t - dir * 10).toFixed(1)} ${(y + hb).toFixed(1)} L ${(t - dir * 10).toFixed(1)} ${(y + 1.6).toFixed(1)} L ${x.toFixed(1)} ${(y + 1.6).toFixed(1)} Z`; };
    m.update = (u, p, dur) => {
      const th = 2 * Math.PI * F_FORK * u, drive = Math.sin(th), vel = Math.cos(th);
      const e = proj(big.marks.strip); lEl.set(e.x, e.y, 70, -40, smooth((u - 0.15 * dur) / 0.5));
      const a = proj(big.marks.padA), b = proj(big.marks.padB);
      const posA = drive >= 0, op = 0.35 + 0.65 * Math.abs(drive);
      pA.set(a.x - 34, a.y, posA, op); pB.set(b.x + 34, b.y, !posA, op);
      // motion arrows at the tips: outward while the prongs open, inward while they close
      const tl = proj(big.marks.tipL), tr = proj(big.marks.tipR), open = vel >= 0, aop = clamp(Math.abs(vel) * 1.6 - 0.25).toFixed(3);
      arrows[0].setAttribute('d', open ? arrowPath(tl.x - 10, tl.y, -1, 36) : arrowPath(tl.x - 46, tl.y, 1, 36)); arrows[0].setAttribute('opacity', aop);
      arrows[1].setAttribute('d', open ? arrowPath(tr.x + 10, tr.y, 1, 36) : arrowPath(tr.x + 46, tr.y, -1, 36)); arrows[1].setAttribute('opacity', aop);
    };
  }

  // ── D · oscillator overlay ──
  const envOf = (u, dur) => { const f = x => 1 / (1 + Math.exp(-(x - 0.24 * dur) / (0.045 * dur))); return clamp((f(u) - f(0)) / (1 - f(0))); };
  {
    const m = mkMode('oscillator');
    // output "scope" card (fixed, upper left) and the 2^15 card (lower left)
    m.cards.push(card('left:64px;top:96px;width:530px;height:236px;box-sizing:border-box;', `
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div><div class="ov-k">Output</div><div class="ov-big" style="margin-top:2px"><span class="ov-accent">32,768</span> Hz</div></div>
        <div class="ov-muted" style="font-size:12px;text-align:right">shown ~30,000× slower</div></div>
      <div data-status style="position:absolute;left:12px;bottom:10px;font-size:13px"></div>`));
    const status = q(m.cards[0], '[data-status]');
    const halveCard = card('left:64px;top:356px;width:530px;box-sizing:border-box;', `
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="ov-k">Why 32,768?</div><div class="ov-eq"><span class="ov-accent">32,768 = 2<sup style="font-size:10px">15</sup></span></div></div>
      <div data-chain class="ov-eq" style="font-size:14px;line-height:1.9;margin-top:6px"></div>
      <div data-foot style="font-size:13.5px;margin-top:4px">Halve it 15 times → exactly <span class="ov-accent">one pulse per second</span></div>`);
    m.cards.push(halveCard);
    const chainEl = q(halveCard, '[data-chain]'), foot = q(halveCard, '[data-foot]');
    const nums = []; for (let k = 0; k <= 15; k++) nums.push(32768 / Math.pow(2, k));
    chainEl.innerHTML = nums.map((n, k) => `${k ? '<span data-ar style="color:#9aa3ad"> → </span>' : ''}<span data-n>${n.toLocaleString('en-US')}</span>${k === 15 ? ' per second' : ''}${k === 7 ? '<br>' : ''}`).join('');
    const numEls = chainEl.querySelectorAll('[data-n]'), arEls = chainEl.querySelectorAll('[data-ar]');
    // scope trace
    const SX0 = 84, SX1 = 574, SY = 236, SA = 40;
    S('line', { x1: SX0, y1: SY, x2: SX1, y2: SY, stroke: 'rgba(205,218,232,0.18)', 'stroke-width': 1 }, m.g);
    for (const dy of [-SA, SA]) S('line', { x1: SX0, y1: SY + dy, x2: SX1, y2: SY + dy, stroke: 'rgba(205,218,232,0.08)', 'stroke-width': 1, 'stroke-dasharray': '3 4' }, m.g);
    const trace = S('polyline', { fill: 'none', stroke: PUL, 'stroke-width': 2, 'stroke-linejoin': 'round' }, m.g);
    // loop circuit, laid out relative to the fork's lead ends
    const W_ = { stroke: 'rgba(236,235,230,0.78)', 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round' };
    const wires = S('path', W_, m.g), rzig = S('path', W_, m.g), outW = S('path', W_, m.g), outHead = S('path', { fill: 'rgba(236,235,230,0.78)' }, m.g);
    const caps = S('path', { stroke: TXT, 'stroke-width': 3, fill: 'none' }, m.g), gnds = S('path', { stroke: 'rgba(236,235,230,0.78)', 'stroke-width': 2, fill: 'none' }, m.g);
    const icBox = S('rect', { fill: 'rgba(227,154,92,0.05)', stroke: COP, 'stroke-width': 1.2, 'stroke-dasharray': '5 4', rx: 8 }, m.g);
    const amp = S('path', { fill: 'rgba(11,14,19,0.92)', stroke: TXT, 'stroke-width': 2, 'stroke-linejoin': 'round' }, m.g);
    const bub = S('circle', { r: 5, fill: 'rgba(11,14,19,0.92)', stroke: TXT, 'stroke-width': 2 }, m.g);
    const ampGlow = S('path', { fill: PUL, opacity: 0 }, m.g);
    const nodes = [0, 1, 2, 3].map(() => S('circle', { r: 3.5, fill: TXT }, m.g));
    const tIC = T_(m.g, 0, 0, 'amplifier in the IC', { 'font-size': 13, fill: COP, 'text-anchor': 'middle' });
    const tR = T_(m.g, 0, 0, 'resistor', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    const tC1 = T_(m.g, 0, 0, 'capacitor', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    const tC2 = T_(m.g, 0, 0, 'capacitor', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    const tFork = T_(m.g, 0, 0, 'quartz fork', { 'font-size': 13, fill: TXT, 'text-anchor': 'middle' });
    const tail = []; for (let i = 0; i < 14; i++) tail.push(S('line', { stroke: PUL, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, m.g));
    const halo = S('circle', { r: 12, fill: PUL, opacity: 0.22 }, m.g), head = S('circle', { r: 5, fill: '#dff0ff' }, m.g);
    const F = n => n.toFixed(1);
    function polyAt(pts, lens, d) { for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) { const a = pts[i], b = pts[i + 1], k = lens[i] > 0 ? clamp(d / lens[i]) : 0; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), i]; } d -= lens[i]; } return [pts[0][0], pts[0][1], 0]; }
    m.update = (u, p, dur) => {
      const env = envOf(u, dur);
      const A = proj(leadA), B = proj(leadB);
      const xL = A.x - 46, xB = A.x - 22, xR = A.x + 404, yAmp = A.y - 124, yRf = A.y - 178, yBot = B.y + 76, xc = (xL + xR) / 2;
      const tipX = xc - 36, baseX = xc + 36, bubX = tipX - 6;
      wires.setAttribute('d', [
        `M ${F(bubX - 5)} ${F(yAmp)} L ${F(xL)} ${F(yAmp)} L ${F(xL)} ${F(A.y)} L ${F(A.x)} ${F(A.y)}`,
        `M ${F(B.x)} ${F(B.y)} L ${F(xB)} ${F(B.y)} L ${F(xB)} ${F(yBot)} L ${F(xR)} ${F(yBot)} L ${F(xR)} ${F(yAmp)} L ${F(baseX)} ${F(yAmp)}`,
        `M ${F(xL)} ${F(yAmp)} L ${F(xL)} ${F(yRf)} L ${F(xc - 40)} ${F(yRf)} M ${F(xc + 40)} ${F(yRf)} L ${F(xR)} ${F(yRf)} L ${F(xR)} ${F(yAmp)}`,
        `M ${F(xL)} ${F(A.y - 54)} L ${F(xL - 40)} ${F(A.y - 54)} L ${F(xL - 40)} ${F(A.y - 34)} M ${F(xL - 40)} ${F(A.y - 24)} L ${F(xL - 40)} ${F(A.y - 4)}`,
        `M ${F(xR)} ${F(A.y - 54)} L ${F(xR + 40)} ${F(A.y - 54)} L ${F(xR + 40)} ${F(A.y - 34)} M ${F(xR + 40)} ${F(A.y - 24)} L ${F(xR + 40)} ${F(A.y - 4)}`,
      ].join(' '));
      let z = `M ${F(xc - 40)} ${F(yRf)}`; for (let i = 0; i < 8; i++) z += ` L ${F(xc - 40 + 5 + i * 10)} ${F(yRf + (i % 2 ? 7 : -7))}`; z += ` L ${F(xc + 40)} ${F(yRf)}`;
      rzig.setAttribute('d', z);
      caps.setAttribute('d', `M ${F(xL - 52)} ${F(A.y - 34)} L ${F(xL - 28)} ${F(A.y - 34)} M ${F(xL - 52)} ${F(A.y - 24)} L ${F(xL - 28)} ${F(A.y - 24)} M ${F(xR + 28)} ${F(A.y - 34)} L ${F(xR + 52)} ${F(A.y - 34)} M ${F(xR + 28)} ${F(A.y - 24)} L ${F(xR + 52)} ${F(A.y - 24)}`);
      const gnd = (x, y) => `M ${F(x - 12)} ${F(y)} L ${F(x + 12)} ${F(y)} M ${F(x - 7)} ${F(y + 5)} L ${F(x + 7)} ${F(y + 5)} M ${F(x - 3)} ${F(y + 10)} L ${F(x + 3)} ${F(y + 10)}`;
      gnds.setAttribute('d', gnd(xL - 40, A.y - 4) + ' ' + gnd(xR + 40, A.y - 4));
      setA(icBox, { x: xc - 64, y: yRf - 34, width: 128, height: yAmp - yRf + 74 });
      amp.setAttribute('d', `M ${F(baseX)} ${F(yAmp - 30)} L ${F(baseX)} ${F(yAmp + 30)} L ${F(tipX)} ${F(yAmp)} Z`);
      setA(bub, { cx: bubX, cy: yAmp });
      [[xL, yAmp], [xR, yAmp], [xL, A.y - 54], [xR, A.y - 54]].forEach((n, i) => setA(nodes[i], { cx: n[0], cy: n[1] }));
      setA(tIC, { x: xc, y: yAmp + 58 }); setA(tR, { x: xc, y: yRf - 15 });
      setA(tC1, { x: xL - 40, y: A.y + 24 }); setA(tC2, { x: xR + 40, y: A.y + 24 });
      setA(tFork, { x: A.x + 150, y: yBot - 14 });
      // output to the scope card
      const oy = clamp(yAmp, 150, 320);
      outW.setAttribute('d', `M ${F(xL)} ${F(yAmp)} L ${F(xL - 60)} ${F(yAmp)} L ${F(xL - 60)} ${F(oy)} L 612 ${F(oy)}`);
      outHead.setAttribute('d', `M 610 ${F(oy - 6)} L 610 ${F(oy + 6)} L 600 ${F(oy)} Z`);
      // pulse path around the loop: amp output → fork → amp input → through the amp
      const FORK_LEN = 150, AMP_LEN = baseX - tipX;
      const pts = [[bubX - 5, yAmp], [xL, yAmp], [xL, A.y], [A.x, A.y], [B.x, B.y], [xB, B.y], [xB, yBot], [xR, yBot], [xR, yAmp], [baseX, yAmp], [bubX - 5, yAmp]];
      const lens = []; for (let i = 0; i < pts.length - 1; i++) lens.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
      lens[3] = FORK_LEN;   // time spent inside the fork
      const total = lens.reduce((a, b) => a + b, 0);
      const forkMid = lens[0] + lens[1] + lens[2] + FORK_LEN / 2;
      const c0 = forkMid / total - 0.25;   // the pulse is mid-fork when the drive peaks
      const dHead = frac(F_OSC * u + c0) * total;
      const bright = 0.35 + 0.65 * env;
      const hp = polyAt(pts, lens, dHead), hidden = hp[2] === 3;
      setA(head, { cx: hp[0], cy: hp[1] }); setA(halo, { cx: hp[0], cy: hp[1] });
      head.setAttribute('opacity', hidden ? 0 : bright.toFixed(3)); halo.setAttribute('opacity', hidden ? 0 : (0.22 * bright).toFixed(3));
      for (let i = 0; i < tail.length; i++) {
        const d0 = dHead - i * 9, d1 = dHead - (i + 1) * 9;
        const a0 = polyAt(pts, lens, ((d0 % total) + total) % total), a1 = polyAt(pts, lens, ((d1 % total) + total) % total);
        const bad = a0[2] === 3 || a1[2] === 3 || Math.hypot(a0[0] - a1[0], a0[1] - a1[1]) > 30;
        setA(tail[i], { x1: a0[0], y1: a0[1], x2: a1[0], y2: a1[1] });
        tail[i].setAttribute('opacity', bad ? 0 : (bright * 0.75 * (1 - i / tail.length)).toFixed(3));
      }
      const inAmp = hp[2] === 9 ? 1 - clamp((hp[0] - tipX) / AMP_LEN) : 0;
      ampGlow.setAttribute('d', amp.getAttribute('d')); ampGlow.setAttribute('opacity', (0.35 * Math.sin(Math.PI * inAmp) * bright).toFixed(3));
      // scope: the last ~3.4 s of output
      let ptsS = '';
      for (let i = 0; i <= 200; i++) {
        const t = u - 3.4 + 3.4 * i / 200;
        let v = 0;
        if (t >= 0) { const e = envOf(t, dur); v = e * Math.sin(2 * Math.PI * F_OSC * t) + (1 - e) * 0.05 * (Math.sin(37.1 * t) + 0.6 * Math.sin(53.7 * t + 1) + 0.4 * Math.sin(91.3 * t + 2)); }
        ptsS += `${F(SX0 + (SX1 - SX0) * i / 200)},${F(SY - v * SA)} `;
      }
      trace.setAttribute('points', ptsS);
      status.innerHTML = env < 0.93 ? `<span class="ov-pulse">Start-up:</span> each trip round the loop adds a little more swing` : `<span class="ov-pulse">Steady:</span> the amplifier just tops up what is lost`;
      // 2^15 halving card
      const show = p.halve !== false, h0 = (p.halveAt !== undefined ? p.halveAt : 0.58) * dur;
      halveCard.style.display = show ? '' : 'none';
      halveCard.style.opacity = smooth((u - h0) / 0.6).toFixed(3);
      const span = Math.max(1.5, Math.min(0.3 * dur, dur - h0 - 1.2));
      const k = clamp((u - h0 - 0.4) / span) * 15;
      numEls.forEach((n, i) => { const on = i <= k + 1e-6; n.style.color = on ? (i === 15 ? COP : TXT) : 'rgba(154,163,173,0.38)'; });
      arEls.forEach((n, i) => { n.style.color = i + 1 <= k + 1e-6 ? '#9aa3ad' : 'rgba(154,163,173,0.25)'; });
      foot.style.opacity = smooth((k - 14.5) / 0.5).toFixed(3);
    };
  }

  // ── E · temperature overlay ──
  const CHT = { x0: 136, x1: 704, y0: 146, y1: 494, t0: -10, t1: 60, p0: 8, p1: -46 };
  const cX = t => CHT.x0 + (t - CHT.t0) / (CHT.t1 - CHT.t0) * (CHT.x1 - CHT.x0);
  const cY = v => CHT.y0 + (CHT.p0 - v) / (CHT.p0 - CHT.p1) * (CHT.y1 - CHT.y0);
  const ppmAt = t => -0.034 * (t - 25) * (t - 25);
  const tempKeys = [[0, 25], [0.36, 25], [0.48, 5], [0.56, 5], [0.7, 35], [0.78, 35], [0.9, 25], [1, 25]];
  function tempAt(f) { for (let i = 1; i < tempKeys.length; i++) if (f <= tempKeys[i][0]) { const a = tempKeys[i - 1], b = tempKeys[i]; return lerp(a[1], b[1], ease((f - a[0]) / (b[0] - a[0]))); } return 25; }
  {
    const m = mkMode('temperature');
    m.cards.push(card('left:64px;top:84px;width:676px;height:488px;box-sizing:border-box;', `
      <div class="ov-k">Crystal frequency vs temperature</div>
      <div class="ov-muted" style="font-size:11.5px;margin-top:3px">typical 32 kHz tuning fork · curvature ≈ ${MINUS}0.034 ppm/°C²</div>`));
    m.cards.push(card('left:842px;top:276px;width:330px;box-sizing:border-box;', `
      <div style="display:flex;gap:22px">
        <div><div class="ov-k">Temperature</div><div class="ov-big" style="margin-top:2px"><span data-t>25</span> °C</div></div>
        <div><div class="ov-k">Rate error</div><div class="ov-big" style="margin-top:2px"><span data-p>0.0</span> <span style="font-size:14px">ppm</span></div></div></div>
      <div class="ov-eq" style="font-size:13.5px;margin-top:2px">≈ <span data-d>0.0</span> s a day</div>`));
    const rT = q(m.cards[1], '[data-t]'), rP = q(m.cards[1], '[data-p]'), rD = q(m.cards[1], '[data-d]');
    const g = m.g;
    const shade = S('rect', { x: cX(5), y: CHT.y0, width: cX(35) - cX(5), height: CHT.y1 - CHT.y0, fill: 'rgba(227,154,92,0.09)' }, g);
    const shadeT = T_(g, (cX(5) + cX(35)) / 2, CHT.y1 - 12, '5–35 °C: normal use', { 'font-size': 12, fill: COP, 'text-anchor': 'middle' });
    const band = S('g', {}, g);
    S('rect', { x: CHT.x0, y: cY(5.8), width: CHT.x1 - CHT.x0, height: cY(-5.8) - cY(5.8), fill: 'rgba(120,195,255,0.11)' }, band);
    for (const v of [5.8, -5.8]) S('line', { x1: CHT.x0, x2: CHT.x1, y1: cY(v), y2: cY(v), stroke: PUL, 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.8 }, band);
    T_(band, CHT.x1 - 8, cY(0) - 8, '±15 s/month', { 'font-size': 13, fill: PUL, 'text-anchor': 'end', 'font-weight': 500 });
    T_(band, CHT.x1 - 8, cY(0) + 11, `≈ ±5.8 ppm ≈ ±0.5 s/day`, { 'font-size': 11, fill: PUL, 'text-anchor': 'end', opacity: 0.85 });
    // axes and grid
    for (let t = -10; t <= 60; t += 10) {
      S('line', { x1: cX(t), x2: cX(t), y1: CHT.y0, y2: CHT.y1, stroke: 'rgba(205,218,232,0.07)' }, g);
      T_(g, cX(t), CHT.y1 + 20, String(t).replace('-', MINUS), { 'font-size': 12, fill: MUT, 'text-anchor': 'middle' });
    }
    for (const v of [5, 0, -10, -20, -30, -40]) {
      S('line', { x1: CHT.x0, x2: CHT.x1, y1: cY(v), y2: cY(v), stroke: v === 0 ? 'rgba(205,218,232,0.3)' : 'rgba(205,218,232,0.07)' }, g);
      T_(g, CHT.x0 - 8, cY(v) + 4, (v > 0 ? '+' : '') + String(v).replace('-', MINUS), { 'font-size': 12, fill: MUT, 'text-anchor': 'end' });
    }
    S('rect', { x: CHT.x0, y: CHT.y0, width: CHT.x1 - CHT.x0, height: CHT.y1 - CHT.y0, fill: 'none', stroke: 'rgba(205,218,232,0.22)' }, g);
    T_(g, (CHT.x0 + CHT.x1) / 2, CHT.y1 + 44, 'temperature (°C)', { 'font-size': 12, fill: MUT, 'text-anchor': 'middle' });
    const yl = T_(g, 0, 0, 'frequency error (ppm)', { 'font-size': 12, fill: MUT, 'text-anchor': 'middle' });
    yl.setAttribute('transform', `translate(${CHT.x0 - 46} ${(CHT.y0 + CHT.y1) / 2}) rotate(-90)`);
    // the curve, drawn in from the left
    let d = '', clen = 0, prev = null;
    for (let t = -10; t <= 60.001; t += 0.5) { const x = cX(t), y = cY(ppmAt(t)); d += (prev ? ' L ' : 'M ') + x.toFixed(1) + ' ' + y.toFixed(1); if (prev) clen += Math.hypot(x - prev[0], y - prev[1]); prev = [x, y]; }
    const curve = S('path', { d, fill: 'none', stroke: TXT, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-dasharray': `${clen.toFixed(1)} ${clen.toFixed(1)}` }, g);
    const peak = S('g', {}, g);
    S('circle', { cx: cX(25), cy: cY(0), r: 5, fill: COP }, peak);
    T_(peak, cX(25), cY(0) - 16, 'least drift near 25 °C', { 'font-size': 13, fill: COP, 'text-anchor': 'middle' });
    const drop = S('line', { stroke: PUL, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, g);
    const mHalo = S('circle', { r: 13, fill: PUL, opacity: 0.22 }, g), mDot = S('circle', { r: 6, fill: PUL, stroke: '#0b0e13', 'stroke-width': 2 }, g);
    m.update = (u, p, dur) => {
      const f = u / dur;
      const draw = clamp((f - 0.02) / 0.22);
      curve.setAttribute('stroke-dashoffset', ((1 - ease(draw)) * clen).toFixed(1));
      peak.setAttribute('opacity', smooth((f - 0.18) / 0.06).toFixed(3));
      const shOp = smooth((f - 0.34) / 0.06); shade.setAttribute('opacity', shOp.toFixed(3)); shadeT.setAttribute('opacity', shOp.toFixed(3));
      band.setAttribute('opacity', smooth((f - 0.5) / 0.06).toFixed(3));
      const t = tempAt(f), v = ppmAt(t), mx = cX(t), my = cY(v), mOp = smooth((f - 0.25) / 0.05);
      setA(mDot, { cx: mx, cy: my, opacity: mOp.toFixed(3) }); setA(mHalo, { cx: mx, cy: my, opacity: (0.22 * mOp).toFixed(3) });
      setA(drop, { x1: mx, x2: mx, y1: my + 8, y2: CHT.y1, opacity: (0.8 * mOp).toFixed(3) });
      rT.textContent = Math.round(t).toString(); rP.textContent = fmtSigned(v, 1); rD.textContent = fmtSigned(v * 0.0864, 1);
      m.cards[1].style.opacity = smooth((f - 0.25) / 0.05).toFixed(3);
    };
  }
  function revealOf(u, p, dur) { return typeof p.reveal === 'number' ? clamp(p.reveal) : ease((u - 0.3 * dur) / (0.4 * dur)); }

  // ───────────────────────── update / overlay ─────────────────────────
  function update(u, p, T, dur) {
    p = p || {}; dur = dur || 10;
    const mode = p.mode || 'can';
    // A · can: front half lifts toward the camera and fades
    const k = mode === 'can' ? revealOf(u, p, dur) : 1;
    canFront.visible = k < 0.995;
    canFrontMat.opacity = 1 - smooth((k - 0.15) / 0.75);
    canFrontMat.depthWrite = k < 0.15;
    canFront.position.set(0, 0.55 * ease(k), 1.4 * ease(k));
    canFront.rotation.x = -0.25 * ease(k);
    // B · lattice
    poseLattice(mode === 'lattice' ? latticeState(u, p, dur) : { s: 0, pr: 0, V: 0, step: 1, away: 0, phase: 0 });
    // C · big fork: flexural mode, prong tips ±2 units, ~15,000× slower than real
    if (mode === 'fork') { const th = 2 * Math.PI * F_FORK * u; big.pose(2.0 * Math.sin(th), Math.sin(th)); }
    else big.pose(0, 0);
    // D · small fork in the oscillator loop
    if (mode === 'oscillator') { const env = envOf(u, dur), th = 2 * Math.PI * F_OSC * u; small.pose(1.9 * env * Math.sin(th), env * Math.sin(th)); }
    else if (mode === 'temperature') { const th = 2 * Math.PI * F_OSC * u; small.pose(1.5 * Math.sin(th), 0.7 * Math.sin(th)); }
    else small.pose(0, 0);
    const tt = mode === 'temperature' ? tempAt(u / dur) : 25;
    small.body.material.color.copy(smallTint.base);
    if (tt < 25) small.body.material.color.lerp(smallTint.cold, clamp((25 - tt) / 20) * 0.7);
    else small.body.material.color.lerp(smallTint.warm, clamp((tt - 25) / 20) * 0.7);
  }
  function overlayFn(u, p, T, dur) {
    p = p || {}; dur = dur || 10;
    const mode = p.mode || 'can';
    const vw = WX.viewW || 1280, vh = WX.viewH || 720;
    ovS = Math.min(vw / 1280, vh / 720); ovX = (vw - 1280 * ovS) / 2; ovY = (vh - 720 * ovS) / 2;
    root.style.transform = `translate(${ovX.toFixed(2)}px, ${ovY.toFixed(2)}px) scale(${ovS.toFixed(5)})`;
    for (const name in OV) { const on = name === mode; OV[name].g.style.display = on ? '' : 'none'; OV[name].cards.forEach(c => { c.style.display = on ? '' : 'none'; }); }
    if (OV[mode]) OV[mode].update(u, p, dur);
  }
  // initial pose so the stage looks right before the first update
  update(0, { mode: 'can' }, 0, 10);

  return {
    cameras: {
      can: { t: [ORG.can.x - 8.5, 3, 0], yaw: 0.36, pitch: 0.26, dist: 92 },
      canClose: { t: [ORG.can.x - 4, 0.5, 0], yaw: 0.24, pitch: 0.2, dist: 64 },
      lattice: { t: [ORG.lattice.x - 5, 7, 0], yaw: 0.26, pitch: 0.2, dist: 138 },
      fork: { t: [ORG.fork.x + 9, 0, 0], yaw: 0.3, pitch: 0.08, dist: 118 },
      forkTips: { t: [ORG.fork.x, 12, 0], yaw: 0.22, pitch: 0.06, dist: 86 },
      circuit: { t: [ORG.circuit.x - 11, 12, 0], yaw: 0, pitch: 0.05, dist: 108 },
    },
    update,
    overlay: overlayFn,
  };
});
