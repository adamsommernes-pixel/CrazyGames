// Close-up stage "battery": the SR936SW silver-oxide button cell that powers the 8T63, and its power budget.
//
// Facts used (from the brief): SR936SW = Seiko SB-A4 = IEC SR45 = "394"; 1.55 V nominal; Ø 9.5 × 3.6 mm;
// about 85 mAh (Seiko Instruments figure; other makers 71–84 mAh). A steel can (+) holds a silver-oxide (Ag₂O)
// pellet; then a separator, a zinc gel anode under the negative cap, a nylon gasket insulating cap from can,
// alkaline electrolyte (NaOH in 'SW' low-drain cells). Zn + Ag₂O → ZnO + 2 Ag. Very flat discharge near 1.55 V,
// then a sharp drop. The whole movement draws < 2.70 µA (circuit block < 0.70 µA) at 1.55 V; Seiko rates
// about 3 years with 1 h/day of stopwatch use; near the end the small seconds hand moves in 2-second steps.
//
// Model: the outside is true to scale (mm). Inside, the layer shapes and thicknesses are illustrative and
// exaggerated so each layer reads on screen. The cell stands with its flat printed can face (+) up and the
// smaller cap (−) underneath, so the printing stays visible in every mode.
//
// p.mode:
//   'cell'      The closed cell turning slowly (p.turn, default 0.75 rad, settles to 0 at the end), with
//               "SR936SW / 1.55 V" on the can face, dimension callouts Ø 9.5 mm and 3.6 mm (p.dims:false hides
//               them) and a small ID card (p.card:false hides it).
//   'cutaway'   A quarter of the cell lifts away between p.openAt (0.04) and p.openEnd (0.30) × dur, revealing
//               can (+), Ag₂O pellet, separator, zinc anode, gasket and cap (−). Part labels follow
//               (p.labels: false | list of keys; default all six), then an electrolyte card (p.card:false hides it).
//               The cell then sways slightly and is back square at the end (p.turn:false keeps it still).
//   'reaction'  Cutaway (opens over the first p.openEnd = 0.12 × dur; p.open:false starts open) plus an external
//               circuit from the cap (−) through a small "watch" block to the can (+). Electrons (blue) leave the
//               zinc, run round the circuit and enter the silver oxide; hydroxide ions (orange) drift across the
//               separator towards the zinc. The pellet lightens to silver with p.progress (number 0..1, or by
//               default 0 → 0.6 between 0.15 and 0.95 × dur). Overlay: Zn + Ag₂O → ZnO + 2 Ag.
//               p.labels default ['cathode', 'separator', 'anode']. p.flow scales particle speed (1).
//   'curve'     Chart of voltage vs capacity used, plotted over the shot (p.plotStart 0.06, p.plotEnd 0.8):
//               silver oxide flat near 1.55 V with a sharp knee at the end, alkaline sloping 1.5 → 1.0 V for
//               contrast. The 3D cell sits small at the right. By default (p.close !== false) the quarter
//               drops back in and the circuit fades during the first ~1.3 s, continuing from 'reaction'.
//   'budget'    Energy-budget card (85 mAh ÷ 3.2 µA ≈ 26,600 h ≈ 3.0 years; Seiko: about 3 years with 1 h/day
//               of stopwatch) with a draining charge bar, and a small-seconds subdial stepping once a second,
//               switching to 2-second jumps at p.switchAt (0.6 × dur) as the charge runs out.
// Cameras: cell (face + dimensions), cutaway (cell left of centre with room for the circuit: frames both 'cutaway'
// and 'reaction'), closeup (bigger cutaway, labels only), reaction (cutaway turned a little towards the circuit),
// side (cell small at the right, for the chart and budget overlays).
// Own part labels are drawn in the overlay by default in 'cutaway'/'reaction'; pass p.labels:false if the director
// labels the anchors (battery:can, cathode, separator, anode, gasket, cap, load) instead.
WX.registerStage('battery', function (ctx) {
  'use strict';
  const { THREE, WX, group, overlay } = ctx;
  const { clamp, lerp, smooth, ease, easeOut, TAU } = WX;
  const COP = '#e39a5c', PUL = '#78c3ff', MUT = '#9aa3ad';
  const R = 4.75, H = 3.6;
  const CUT = Math.PI / 4;          // the removed quarter spans φ ∈ [−45°, 45°] around +Z (towards the default cameras)
  const S2 = Math.SQRT1_2;

  // ───────────── small helpers ─────────────
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // triangle soup builder: every triangle is wound to face its intended normal
  function soup() {
    const pos = [], nor = [], uv = [];
    return {
      pos,
      tri(A, B, C, N) {
        const ux = B.p[0] - A.p[0], uy = B.p[1] - A.p[1], uz = B.p[2] - A.p[2];
        const vx = C.p[0] - A.p[0], vy = C.p[1] - A.p[1], vz = C.p[2] - A.p[2];
        const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
        if (cx * N[0] + cy * N[1] + cz * N[2] < 0) { const t = B; B = C; C = t; }
        for (const V of [A, B, C]) { pos.push(V.p[0], V.p[1], V.p[2]); nor.push(V.n[0], V.n[1], V.n[2]); uv.push(V.t[0], V.t[1]); }
      },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        return g;
      },
    };
  }
  // A closed (r, y) profile revolved about +Y from phi0 to phi1 (φ = 0 is +Z), with flat cut faces at both ends.
  // Groups: 0 = revolved surface, 1 = cut faces. skip(a, b) leaves out an edge's revolved surface.
  function sectorGeo(prof, phi0, phi1, seg, skip, caps = true) {
    const pts = prof.map(p => [p[0], p[1]]);
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) pts.reverse();
    const n = pts.length, en = [];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; en.push([dy / l, -dx / l]); }
    const S = soup(), crease = Math.cos(WX.deg(40));
    const avg = (x, y) => { const s = [x[0] + y[0], x[1] + y[1]], l = Math.hypot(s[0], s[1]) || 1; return [s[0] / l, s[1] / l]; };
    const segs = Math.max(2, Math.ceil(seg * (phi1 - phi0) / TAU));
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (a[0] < 1e-6 && b[0] < 1e-6) continue;
      if (skip && skip(a, b)) continue;
      const ne = en[i], np = en[(i - 1 + n) % n], nn = en[(i + 1) % n];
      const na = ne[0] * np[0] + ne[1] * np[1] > crease ? avg(ne, np) : ne;
      const nb = ne[0] * nn[0] + ne[1] * nn[1] > crease ? avg(ne, nn) : ne;
      const rm = Math.max(0.5, (a[0] + b[0]) / 2);
      const V = (p, q, f) => ({ p: [p[0] * Math.sin(f), p[1], p[0] * Math.cos(f)], n: [q[0] * Math.sin(f), q[1], q[0] * Math.cos(f)], t: [f * rm / 2, p[1] / 2] });
      // long edges are split so the triangles stay well shaped
      const nsub = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.45));
      const P = j => [lerp(a[0], b[0], j / nsub), lerp(a[1], b[1], j / nsub)];
      const Nn = j => (j === 0 ? na : j === nsub ? nb : ne);
      for (let j = 0; j < nsub; j++) {
        const pa = P(j), pb = P(j + 1), qa = Nn(j), qb = Nn(j + 1);
        for (let k = 0; k < segs; k++) {
          const f0 = phi0 + (phi1 - phi0) * k / segs, f1 = phi0 + (phi1 - phi0) * (k + 1) / segs, fm = (f0 + f1) / 2;
          const N = [ne[0] * Math.sin(fm), ne[1], ne[0] * Math.cos(fm)];
          const a0 = V(pa, qa, f0), a1 = V(pa, qa, f1), b0 = V(pb, qb, f0), b1 = V(pb, qb, f1);
          S.tri(a0, b0, b1, N); S.tri(a0, b1, a1, N);
        }
      }
    }
    const g0 = S.pos.length / 3;
    const tris = caps ? THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []) : [];
    for (const [f, sg] of caps ? [[phi0, -1], [phi1, 1]] : []) {
      const N = [sg * Math.cos(f), 0, -sg * Math.sin(f)];
      const V = p => ({ p: [p[0] * Math.sin(f), p[1], p[0] * Math.cos(f)], n: N, t: [p[0] / 2, p[1] / 2] });
      for (const t of tris) S.tri(V(pts[t[0]]), V(pts[t[1]]), V(pts[t[2]]), N);
    }
    const g = S.geo();
    g.addGroup(0, g0, 0); g.addGroup(g0, S.pos.length / 3 - g0, 1);
    return g;
  }
  // flat printed face (disc sector at height y, normal +Y), planar UVs over [−rf, rf]²
  function faceGeo(rf, y, phi0, phi1, seg) {
    const S = soup(), rings = 8, na = Math.max(2, Math.ceil(seg * (phi1 - phi0) / TAU)), N = [0, 1, 0];
    const V = (r, f) => { const x = r * Math.sin(f), z = r * Math.cos(f); return { p: [x, y, z], n: N, t: [0.5 + x / (2 * rf), 0.5 - z / (2 * rf)] }; };
    for (let i = 0; i < rings; i++) for (let k = 0; k < na; k++) {
      const r0 = rf * i / rings, r1 = rf * (i + 1) / rings, f0 = phi0 + (phi1 - phi0) * k / na, f1 = phi0 + (phi1 - phi0) * (k + 1) / na;
      S.tri(V(r0, f0), V(r1, f0), V(r1, f1), N);
      if (i > 0) S.tri(V(r0, f0), V(r1, f1), V(r0, f1), N);
    }
    return S.geo();
  }
  const v3 = new THREE.Vector3();
  const projL = (obj, x, y, z) => { v3.set(x, y, z); obj.localToWorld(v3); return WX.project(v3, {}); };

  // ───────────── textures ─────────────
  const RF = 4.58;   // radius of the flat can face
  const faceTex = WX.canvasTex(1024, 1024, (c, N) => {
    const P = WX.painter(c, N, RF);
    const g = c.createRadialGradient(N * 0.4, N * 0.36, N * 0.04, N / 2, N / 2, N * 0.52);
    g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.7, '#d3d8dd'); g.addColorStop(1, '#aab1b8');
    c.fillStyle = g; c.fillRect(0, 0, N, N);
    c.strokeStyle = 'rgba(80,88,96,0.10)'; c.lineWidth = 1;   // fine turning marks
    for (let r = 6; r < N / 2; r += 5) { c.beginPath(); c.arc(N / 2, N / 2, r, 0, TAU); c.stroke(); }
    P.text('+', 0, 2.75, 1.35, { weight: 500, color: '#2f343a' });
    P.text('SR936SW', 0, 0.75, 1.32, { weight: 600, color: '#23272c', spacing: 0.04 });
    P.text('1.55 V', 0, -0.95, 0.95, { weight: 500, color: '#2f343a', family: WX.MONO });
    P.text('SILVER OXIDE', 0, -2.35, 0.48, { weight: 500, color: '#4a5058', spacing: 0.08 });
  });
  const grainTex = WX.canvasTex(256, 256, (c, w, h) => {
    const r = rng(11);
    c.fillStyle = '#bdbdbd'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) { const v = 120 + r() * 135 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(r() * w, r() * h, 1.5 + r() * 2.5, 1.5 + r() * 2.5); }
  });
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  const zincTex = WX.canvasTex(256, 256, (c, w, h) => {
    const r = rng(23);
    c.fillStyle = '#5d636a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, s = 5 + r() * 9, v = 125 + r() * 95 | 0;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        c.fillStyle = `rgb(${v},${v + 4},${v + 9})`; c.beginPath(); c.arc(x + dx, y + dy, s, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x + dx - s * 0.3, y + dy - s * 0.3, s * 0.35, 0, TAU); c.fill();
      }
    }
  });
  zincTex.wrapS = zincTex.wrapT = THREE.RepeatWrapping;

  // ───────────── materials ─────────────
  const Std = o => new THREE.MeshStandardMaterial(o);
  const C_OX = new THREE.Color(0x2c2826), C_AG = new THREE.Color(0xeef0f2);
  const MAT = {
    canOut: Std({ color: 0xdfe3e7, metalness: 1, roughness: 0.3 }),
    canCut: Std({ color: 0xc6cdd4, metalness: 0.55, roughness: 0.3 }),
    face: Std({ map: faceTex, metalness: 0.8, roughness: 0.3 }),
    cathode: Std({ color: C_OX.clone(), map: grainTex, metalness: 0.15, roughness: 0.85 }),
    separator: Std({ color: 0xf0ece2, metalness: 0, roughness: 0.92 }),
    anode: Std({ color: 0xffffff, map: zincTex, metalness: 0.3, roughness: 0.72 }),
    gasket: Std({ color: 0x4a5566, metalness: 0.05, roughness: 0.45 }),
  };
  const PARTS = {
    can: { prof: [[0, H], [RF, H], [4.70, H - 0.04], [4.75, H - 0.16], [4.75, 0.36], [4.70, 0.23], [4.58, 0.18], [4.02, 0.18], [4.02, 0.40], [4.5, 0.40], [4.5, 3.38], [0, 3.38]], mats: [MAT.canOut, MAT.canCut], skip: (a, b) => a[1] === H && b[1] === H },
    // inner parts: only their cut faces are ever seen; their revolved surfaces sit against neighbours, so they get
    // the can's metal (a stray rasterisation crack in the can wall then shows metal, not a dark speck)
    cathode: { prof: [[0, 2.12], [4.5, 2.12], [4.5, 3.38], [0, 3.38]], mats: [MAT.canOut, MAT.cathode] },
    separator: { prof: [[0, 1.94], [4.5, 1.94], [4.5, 2.12], [0, 2.12]], mats: [MAT.canOut, MAT.separator] },
    anode: { prof: [[0, 0.15], [3.40, 0.15], [3.40, 1.82], [3.98, 1.82], [3.98, 1.94], [0, 1.94]], mats: [MAT.canOut, MAT.anode] },
    gasket: { prof: [[3.55, 0.12], [4.02, 0.12], [4.02, 0.40], [4.5, 0.40], [4.5, 1.94], [3.98, 1.94], [3.98, 1.66], [3.55, 1.66]], mats: [MAT.canOut, MAT.gasket] },
    cap: { prof: [[0, 0], [3.42, 0], [3.52, 0.03], [3.55, 0.09], [3.55, 1.66], [3.98, 1.66], [3.98, 1.82], [3.40, 1.82], [3.40, 0.15], [0, 0.15]], mats: [MAT.canOut, MAT.canCut] },
  };

  // ───────────── the cell ─────────────
  const cell = new THREE.Group(); group.add(cell);
  const full = new THREE.Group(), body = new THREE.Group(), wedge = new THREE.Group();   // closed cell (no seams) | cut cell + its quarter
  cell.add(full, body, wedge);
  const wedgeMats = [];
  const wmat = m => { const c = m.clone(); c.transparent = true; wedgeMats.push([c, m]); return c; };
  for (const k in PARTS) {
    const P = PARTS[k];
    body.add(new THREE.Mesh(sectorGeo(P.prof, CUT, TAU - CUT, 96, P.skip), P.mats));
    wedge.add(new THREE.Mesh(sectorGeo(P.prof, -CUT, CUT, 96, P.skip), P.mats.map(wmat)));
    if (k === 'can' || k === 'cap' || k === 'gasket') full.add(new THREE.Mesh(sectorGeo(P.prof, 0, TAU, 128, P.skip, false), k === 'gasket' ? MAT.gasket : P.mats[0]));
  }
  body.add(new THREE.Mesh(faceGeo(RF, H, CUT, TAU - CUT, 96), MAT.face));
  full.add(new THREE.Mesh(faceGeo(RF, H, 0, TAU, 128), MAT.face));
  wedge.add(new THREE.Mesh(faceGeo(RF, H, -CUT, CUT, 96), wmat(MAT.face)));

  // points on the two cut faces: face +1 = plane φ = +45° (right of the notch), −1 = φ = −45° (left)
  const FN = { 1: [-S2, 0, S2], '-1': [S2, 0, S2] };
  const fp = (face, r, y, off = 0.13) => new THREE.Vector3(face * r * S2 + FN[face][0] * off, y, r * S2 + FN[face][2] * off);

  // label anchors on the left cut face
  const ANCH = { can: [3.3, 3.49], cathode: [2.7, 2.78], separator: [2.7, 2.03], anode: [2.0, 1.05], gasket: [4.05, 1.0], cap: [2.0, 0.075] };
  for (const k in ANCH) { const q = fp(-1, ANCH[k][0], ANCH[k][1], 0.02); ctx.anchor(k, cell, q.x, q.y, q.z); }

  // ───────────── external circuit (reaction) ─────────────
  const circuit = new THREE.Group(); cell.add(circuit);
  const LOAD = new THREE.Vector3(9.8, 1.8, 0.6);
  const mainPts = [fp(1, 2.5, 0.09), new THREE.Vector3(1.95, -0.6, 1.95), new THREE.Vector3(3.6, -1.55, 1.85), new THREE.Vector3(6.8, -1.8, 1.25),
    new THREE.Vector3(9.15, -0.95, 0.8), new THREE.Vector3(9.8, 0.55, 0.6), LOAD.clone(), new THREE.Vector3(9.8, 3.05, 0.6), new THREE.Vector3(9.15, 4.55, 0.8),
    new THREE.Vector3(6.8, 5.4, 1.25), new THREE.Vector3(3.6, 5.15, 1.85), new THREE.Vector3(1.95, 4.2, 1.95), fp(1, 2.5, 3.5)];
  const mainCurve = new THREE.CatmullRomCurve3(mainPts, false, 'centripetal');
  const wireMat = WX.mat('copper', { transparent: true });
  circuit.add(new THREE.Mesh(new THREE.TubeGeometry(mainCurve, 240, 0.075, 8, false), wireMat));
  const chipMat = WX.mat('chip', { transparent: true }), padMat = WX.mat('gold', { transparent: true });
  // the load: a small dark block standing for the watch movement, with a watch-face icon on its front
  const iconTex = WX.canvasTex(256, 360, (c, w, h) => {
    c.fillStyle = '#16191d'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(205,218,232,0.35)'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.strokeStyle = '#c9d0d7'; c.lineWidth = 9; c.beginPath(); c.arc(w / 2, h / 2, 82, 0, TAU); c.stroke();
    c.lineCap = 'round'; c.lineWidth = 9; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2, h / 2 - 58); c.stroke();
    c.lineWidth = 7; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 40, h / 2 + 22); c.stroke();
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2 + 66 * Math.sin(a), h / 2 - 66 * Math.cos(a)); c.lineTo(w / 2 + 74 * Math.sin(a), h / 2 - 74 * Math.cos(a)); c.stroke(); }
  });
  const iconMat = new THREE.MeshStandardMaterial({ map: iconTex, metalness: 0.2, roughness: 0.5, transparent: true, emissive: 0xffffff, emissiveMap: iconTex, emissiveIntensity: 0.35 });
  const chip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.55), [chipMat, chipMat, chipMat, chipMat, iconMat, chipMat]); chip.position.copy(LOAD); circuit.add(chip);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.6), padMat);
  [[0, -1.12], [0, 1.12]].forEach(([dx, dy]) => { const m = pad.clone(); m.position.set(LOAD.x + dx, LOAD.y + dy, LOAD.z); circuit.add(m); });
  ctx.anchor('load', circuit, LOAD.x + 0.8, LOAD.y, LOAD.z);
  const termMinus = new THREE.Object3D(); termMinus.position.set(2.15, -0.75, 2.1); circuit.add(termMinus);
  const termPlus = new THREE.Object3D(); termPlus.position.set(2.2, 4.35, 2.1); circuit.add(termPlus);

  // instanced beads travelling along curves (one draw call per set, plus an additive halo)
  function flowSet(paths, o) {
    const items = [], rnd = rng(o.seed || 1);
    paths.forEach(pth => {
      const L = pth.c.getLength(), n = Math.max(1, Math.round(L / o.spacing));
      for (let i = 0; i < n; i++) items.push({ pth, L, off: (i + (o.jitter ? (rnd() - 0.5) * o.jitter : 0)) * L / n + (pth.off || 0) });
    });
    const geo = new THREE.SphereGeometry(1, 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: o.color, transparent: true, depthWrite: false, toneMapped: false });
    const core = new THREE.InstancedMesh(geo, mat, items.length); core.frustumCulled = false; core.renderOrder = 6;
    const hmat = new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const halo = new THREE.InstancedMesh(geo, hmat, items.length); halo.frustumCulled = false; halo.renderOrder = 7;
    const g = new THREE.Group(); g.add(core, halo);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    g.userData.update = (t, alpha) => {
      g.visible = alpha > 0.01; if (!g.visible) return;
      mat.opacity = alpha; hmat.opacity = 0.22 * alpha;
      items.forEach((it, i) => {
        const a = ((it.off + o.speed * t) % it.L + it.L) % it.L, s = a / it.L;
        it.pth.c.getPointAt(s, p);
        const f = Math.max(1e-4, (it.pth.fin ? smooth(a / o.fade) : 1) * (it.pth.fout ? smooth((it.L - a) / o.fade) : 1));
        sc.setScalar(o.size * f); m4.compose(p, q, sc); core.setMatrixAt(i, m4);
        sc.setScalar(o.size * (o.halo || 1.9) * f); m4.compose(p, q, sc); halo.setMatrixAt(i, m4);
      });
      core.instanceMatrix.needsUpdate = true; halo.instanceMatrix.needsUpdate = true;
    };
    return g;
  }
  const cr = pts => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const E_SPEED = 2.6;
  const electrons = flowSet([
    { c: cr([fp(1, 0.7, 1.7), fp(1, 1.5, 1.15), fp(1, 2.2, 0.5), fp(1, 2.5, 0.09)]), fin: 1 },
    { c: cr([fp(1, 3.1, 1.75), fp(1, 2.9, 1.05), fp(1, 2.6, 0.45), fp(1, 2.5, 0.09)]), fin: 1, off: 0.35 },
    { c: cr([fp(1, 1.9, 1.8), fp(1, 2.2, 1.2), fp(1, 2.45, 0.6), fp(1, 2.5, 0.09)]), fin: 1, off: 0.7 },
    { c: mainCurve },
    { c: cr([fp(1, 2.5, 3.5), fp(1, 2.0, 3.0), fp(1, 1.1, 2.55)]), fout: 1 },
    { c: cr([fp(1, 2.5, 3.5), fp(1, 3.1, 3.0), fp(1, 3.9, 2.6)]), fout: 1, off: 0.3 },
    { c: cr([fp(1, 2.5, 3.5), fp(1, 2.6, 2.95), fp(1, 2.4, 2.35)]), fout: 1, off: 0.55 },
  ], { spacing: 0.72, size: 0.12, color: 0x78c3ff, speed: E_SPEED, fade: 0.45 });
  circuit.add(electrons);
  const ionPaths = [];
  [[-1, 1.0, 0], [-1, 2.0, 0.5], [-1, 3.0, 0.2], [-1, 3.9, 0.75], [1, 0.4, 0.4], [1, 3.6, 0.1]].forEach(([f, r, off]) => {
    ionPaths.push({ c: new THREE.LineCurve3(fp(f, r, 2.75, 0.11), fp(f, r, 1.3, 0.11)), fin: 1, fout: 1, off });
  });
  const ions = flowSet(ionPaths, { spacing: 0.72, size: 0.1, color: 0xe39a5c, speed: 0.38, fade: 0.35 });
  circuit.add(ions);

  // ───────────── 2D overlay ─────────────
  const LABELS = {
    can: 'Steel can  (+)', cathode: 'Silver oxide pellet, Ag₂O', separator: 'Separator', anode: 'Zinc gel', gasket: 'Nylon gasket', cap: 'Cap  (−)',
  };
  const LABELS_RX = { cathode: 'Silver oxide  (+ side)', separator: 'Separator', anode: 'Zinc  (− side)', can: 'Steel can  (+)', cap: 'Cap  (−)', gasket: 'Nylon gasket' };
  const mono = "font-family:'IBM Plex Mono',monospace";
  // chart geometry (curve mode)
  const CW = 664, CH = 368, X0 = 56, X1 = 640, Y0 = 14, Y1 = 318, VMIN = 0.9, VMAX = 1.7;
  const cxp = x => X0 + (X1 - X0) * x, cyp = v => Y1 - (Y1 - Y0) * (v - VMIN) / (VMAX - VMIN);
  const vAg = x => 1.565 - 0.035 * x - 0.33 * Math.exp((x - 1) / 0.02);
  const vAlk = x => 1.52 - 0.30 * x - 0.12 * x * x - 0.1 * Math.exp((x - 1) / 0.04);
  let chartStatic = `<line x1="${X0}" y1="${Y1}" x2="${X1}" y2="${Y1}" stroke="rgba(205,218,232,0.45)" stroke-width="1"/>
    <line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y1}" stroke="rgba(205,218,232,0.45)" stroke-width="1"/>`;
  [1.0, 1.2, 1.4, 1.6].forEach(v => {
    chartStatic += `<line x1="${X0}" y1="${cyp(v)}" x2="${X1}" y2="${cyp(v)}" stroke="rgba(205,218,232,0.09)" stroke-width="1"/>
      <text x="${X0 - 8}" y="${cyp(v) + 4}" font-size="11.5" text-anchor="end" style="fill:${MUT}">${v.toFixed(1)}</text>`;
  });
  [0, 0.25, 0.5, 0.75, 1].forEach(x => {
    chartStatic += `<line x1="${cxp(x)}" y1="${Y1}" x2="${cxp(x)}" y2="${Y1 + 5}" stroke="rgba(205,218,232,0.45)"/>
      <text x="${cxp(x)}" y="${Y1 + 19}" font-size="11.5" text-anchor="middle" style="fill:${MUT}">${Math.round(x * 100)}${x === 1 ? ' %' : ''}</text>`;
  });
  chartStatic += `<text x="${(X0 + X1) / 2}" y="${Y1 + 42}" font-size="12" text-anchor="middle" style="fill:${MUT}">capacity used →</text>
    <text x="${X0 - 8}" y="${Y0 - 2}" font-size="11.5" text-anchor="end" style="fill:${MUT}">V</text>
    <line x1="${X0}" y1="${cyp(1.55)}" x2="${X1}" y2="${cyp(1.55)}" stroke="${COP}" stroke-opacity="0.35" stroke-dasharray="4 4" stroke-width="1"/>`;

  overlay.innerHTML = `
    <svg class="bt-g" width="1280" height="720" style="left:0;top:0"></svg>
    <div class="bt-labs"></div>
    <div class="ov-card bt-id" style="left:56px;top:446px;width:286px;opacity:0">
      <div class="ov-k">Button cell</div>
      <div class="ov-big" style="margin-top:4px">SR936SW</div>
      <div style="font-size:13.5px;line-height:1.5;margin-top:4px">Silver oxide · <span class="ov-accent">1.55 V</span> nominal</div>
      <div class="ov-muted" style="font-size:12px;line-height:1.45;margin-top:2px">also called SB-A4 (Seiko), SR45 (IEC), 394</div>
    </div>
    <div class="ov-card bt-eq" style="left:640px;top:18px;transform:translateX(-50%);white-space:nowrap;opacity:0">
      <div class="ov-k">Inside the cell</div>
      <div class="ov-big" style="margin-top:4px;font-size:24px">Zn + Ag₂O <span class="ov-accent">→</span> ZnO + 2 Ag</div>
      <div style="display:flex;gap:22px;font-size:12.5px;margin-top:4px">
        <div><span class="ov-pulse">zinc</span> gives up electrons</div>
        <div><span class="ov-pulse">silver oxide</span> takes them and becomes silver</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px;${mono};font-size:11.5px">
        <span class="ov-muted">USED</span>
        <div style="flex:1;height:7px;border-radius:4px;background:rgba(205,218,232,0.12);overflow:hidden"><div class="bt-used" style="height:100%;width:0;background:${COP}"></div></div>
        <span class="bt-usedtxt" style="width:42px;text-align:right">0 %</span>
      </div>
    </div>
    <div class="ov-card bt-leg" style="left:968px;top:452px;width:262px;opacity:0">
      <div style="display:flex;gap:9px;align-items:center;font-size:13px"><span style="width:10px;height:10px;border-radius:50%;background:${PUL};box-shadow:0 0 6px ${PUL};flex:none"></span><span><span class="ov-pulse">e⁻</span> electrons, out through the watch</span></div>
      <div style="display:flex;gap:9px;align-items:center;font-size:13px;margin-top:6px"><span style="width:10px;height:10px;border-radius:50%;background:${COP};flex:none"></span><span><span class="ov-accent">OH⁻</span> ions, across the separator</span></div>
      <div class="ov-muted" style="font-size:11.5px;margin-top:7px">Alkaline electrolyte (NaOH) inside. Years of discharge shown in seconds.</div>
    </div>
    <div class="bt-load" style="position:absolute;left:0;top:0;opacity:0;white-space:nowrap">
      <div style="position:absolute;left:14px;top:-22px;font-size:13px;padding:4px 8px;border-radius:4px;background:rgba(9,12,16,0.82);border:1px solid rgba(205,218,232,0.14)">the watch<div class="ov-muted" style="${mono};font-size:11px">&lt; 2.7 µA</div></div>
    </div>
    <div class="bt-term" data-t="-" style="position:absolute;left:0;top:0;opacity:0"><div style="position:absolute;left:-12px;top:-12px;width:22px;height:22px;border-radius:50%;border:1.5px solid ${PUL};color:${PUL};${mono};font-size:17px;line-height:21px;text-align:center;background:rgba(9,12,16,0.75)">−</div></div>
    <div class="bt-term" data-t="+" style="position:absolute;left:0;top:0;opacity:0"><div style="position:absolute;left:-12px;top:-12px;width:22px;height:22px;border-radius:50%;border:1.5px solid ${COP};color:${COP};${mono};font-size:17px;line-height:21px;text-align:center;background:rgba(9,12,16,0.75)">+</div></div>
    <div class="ov-card bt-chart" style="left:52px;top:84px;width:${CW}px;opacity:0">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="ov-k">Voltage as the cell is used up</div>
          <div style="display:flex;gap:18px;font-size:12.5px;margin-top:6px">
            <span><span style="display:inline-block;width:18px;height:3px;background:${COP};vertical-align:middle;margin-right:6px"></span>silver oxide (SR936SW)</span>
            <span class="ov-muted"><span style="display:inline-block;width:18px;border-top:2px dashed ${MUT};vertical-align:middle;margin-right:6px"></span>alkaline cell, for comparison</span>
          </div>
        </div>
        <div style="text-align:right"><div class="ov-k">silver oxide now</div><div class="ov-big bt-vread ov-accent">1.57 V</div></div>
      </div>
      <svg class="bt-csvg" width="${CW}" height="${CH}" style="position:relative;display:block;margin-top:4px">
        ${chartStatic}
        <text x="${X0 + 6}" y="${cyp(1.55) - 6}" font-size="11.5" style="fill:${COP}">1.55 V</text>
        <path class="bt-alk" d="" fill="none" stroke="${MUT}" stroke-width="1.8" stroke-dasharray="6 4"/>
        <path class="bt-ag" d="" fill="none" stroke="${COP}" stroke-width="2.6" stroke-linejoin="round"/>
        <line class="bt-pen" x1="0" y1="${Y0}" x2="0" y2="${Y1}" stroke="rgba(236,235,230,0.25)" stroke-width="1"/>
        <circle class="bt-dalk" r="3.5" style="fill:${MUT}"/>
        <circle class="bt-dag" r="5" style="fill:${COP}"/>
        <g class="bt-a1" opacity="0"><text x="${cxp(0.13)}" y="${cyp(1.645)}" font-size="13.5" style="fill:#ecebe6">stays close to 1.55 V for most of its life</text></g>
        <g class="bt-a2" opacity="0">
          <text x="${cxp(0.945)}" y="${cyp(1.455)}" font-size="13.5" text-anchor="end" style="fill:#ecebe6">then drops sharply</text>
          <text x="${cxp(0.945)}" y="${cyp(1.455) + 17}" font-size="13.5" text-anchor="end" style="fill:#ecebe6">at the very end</text>
          <path d="M${cxp(0.952)},${cyp(1.44)} L${cxp(0.972)},${cyp(1.44)}" stroke="#ecebe6" stroke-width="1.2"/>
          <path d="M${cxp(0.972)},${cyp(1.44) - 3.5} L${cxp(0.972) + 6},${cyp(1.44)} L${cxp(0.972)},${cyp(1.44) + 3.5} Z" style="fill:#ecebe6"/>
        </g>
        <g class="bt-a3" opacity="0"><text x="${cxp(0.2)}" y="${cyp(1.2)}" font-size="12.5" style="fill:${MUT}">alkaline cell: slides from</text><text x="${cxp(0.2)}" y="${cyp(1.2) + 16}" font-size="12.5" style="fill:${MUT}">1.5 V down towards 1.0 V</text></g>
      </svg>
      <div class="ov-muted" style="font-size:11.5px;margin-top:2px">Curve shapes are illustrative.</div>
    </div>
    <div class="ov-card bt-bud" style="left:52px;top:84px;width:560px;opacity:0">
      <div class="ov-k">Energy budget</div>
      <div class="bt-r" data-i="0" style="display:flex;align-items:baseline;gap:14px;margin-top:10px">
        <div style="${mono};font-size:13px;width:150px" class="ov-muted">Capacity</div>
        <div class="ov-big" style="font-size:21px">85 mAh</div>
        <div class="ov-muted" style="font-size:11.5px">Seiko Instruments figure<br>(other makers 71–84 mAh)</div>
      </div>
      <div class="bt-r" data-i="1" style="display:flex;align-items:baseline;gap:14px;margin-top:8px">
        <div style="${mono};font-size:13px;width:150px" class="ov-muted">Movement draws</div>
        <div class="ov-big" style="font-size:21px">&lt; 2.70 µA</div>
        <div class="ov-muted" style="font-size:11.5px">whole 8T63, at 1.55 V<br>(circuit block &lt; 0.70 µA)</div>
      </div>
      <div class="bt-r" data-i="2" style="margin-top:14px;padding:10px 12px;border-radius:6px;background:rgba(227,154,92,0.09);border:1px solid rgba(227,154,92,0.28)">
        <div class="ov-eq" style="font-size:17px;white-space:nowrap">85 mAh ÷ <span class="ov-accent">~3.2 µA</span> ≈ 26,600 h ≈ <span class="ov-accent">3.0 years</span></div>
        <div class="ov-muted" style="font-size:11.5px;margin-top:2px">~3.2 µA: the average draw that 3 years implies, stopwatch use included</div>
      </div>
      <div class="bt-r" data-i="3" style="font-size:13.5px;margin-top:10px">Seiko: <span class="ov-accent">about 3 years</span>, with the stopwatch used 1 hour a day</div>
      <div class="bt-r" data-i="4" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;${mono};font-size:11.5px"><span class="ov-muted">CHARGE LEFT</span><span class="bt-yr">year 0.0</span></div>
        <div style="height:12px;border-radius:6px;background:rgba(205,218,232,0.12);overflow:hidden;margin-top:5px"><div class="bt-chg" style="height:100%;width:100%;background:${COP}"></div></div>
        <div class="ov-muted" style="font-size:11px;margin-top:4px">3 years compressed into seconds</div>
      </div>
    </div>
    <div class="ov-card bt-sub" style="left:640px;top:84px;width:292px;opacity:0">
      <div class="ov-k">Small seconds hand</div>
      <svg class="bt-dial" width="268" height="190" viewBox="-134 -95 268 190" style="position:relative;display:block;margin-top:6px"></svg>
      <svg class="bt-strip" width="268" height="40" style="position:relative;display:block;margin-top:4px"></svg>
      <div class="bt-cap1" style="font-size:13px;margin-top:4px">steps once a second: normal</div>
      <div class="bt-cap2" style="font-size:13px;margin-top:2px;opacity:0"><span class="ov-accent">jumps 2 seconds at a time:</span><br>battery nearly empty</div>
      <div class="bt-cap3 ov-muted" style="font-size:11.5px;margin-top:4px;opacity:0">The watch still keeps correct time.</div>
    </div>
    <div class="ov-card bt-ely" style="left:944px;top:292px;width:270px;opacity:0">
      <div class="ov-k">Electrolyte</div>
      <div style="font-size:13.5px;line-height:1.45;margin-top:5px">An alkaline solution, sodium hydroxide (NaOH) in this low-drain 'SW' type, soaks the pellet, the separator and the zinc gel.</div>
      <div class="ov-muted" style="font-size:12px;line-height:1.45;margin-top:6px">The gasket seals it in and keeps the cap (−) from touching the can (+).</div>
    </div>
    <div class="bt-tag ov-muted" style="position:absolute;right:24px;top:580px;${mono};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0"></div>`;
  const $ = s => overlay.querySelector(s), $$ = s => overlay.querySelectorAll(s);
  const svgG = $('.bt-g'), labLayer = $('.bt-labs');
  const el = {
    id: $('.bt-id'), ely: $('.bt-ely'), eq: $('.bt-eq'), leg: $('.bt-leg'), load: $('.bt-load'), tag: $('.bt-tag'),
    used: $('.bt-used'), usedTxt: $('.bt-usedtxt'),
    chart: $('.bt-chart'), ag: $('.bt-ag'), alk: $('.bt-alk'), pen: $('.bt-pen'), dag: $('.bt-dag'), dalk: $('.bt-dalk'), vread: $('.bt-vread'),
    a1: $('.bt-a1'), a2: $('.bt-a2'), a3: $('.bt-a3'),
    bud: $('.bt-bud'), rows: $$('.bt-r'), yr: $('.bt-yr'), chg: $('.bt-chg'),
    sub: $('.bt-sub'), dial: $('.bt-dial'), strip: $('.bt-strip'), cap1: $('.bt-cap1'), cap2: $('.bt-cap2'), cap3: $('.bt-cap3'),
    terms: { '-': $('.bt-term[data-t="-"]'), '+': $('.bt-term[data-t="+"]') },
  };
  // small-seconds subdial (static part)
  (function () {
    let s = `<circle r="84" fill="rgba(255,255,255,0.03)" stroke="rgba(205,218,232,0.4)" stroke-width="1.2"/>`;
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * Math.PI / 180, r0 = i % 5 ? 76 : 69, sx = Math.sin(a), cy = -Math.cos(a);
      s += `<line x1="${(r0 * sx).toFixed(2)}" y1="${(r0 * cy).toFixed(2)}" x2="${(82 * sx).toFixed(2)}" y2="${(82 * cy).toFixed(2)}" stroke="rgba(236,235,230,${i % 5 ? 0.45 : 0.85})" stroke-width="${i % 5 ? 1 : 1.6}"/>`;
    }
    [[0, '60'], [20, '20'], [40, '40']].forEach(([sec, t]) => { const a = sec * 6 * Math.PI / 180; s += `<text x="${(55 * Math.sin(a)).toFixed(1)}" y="${(-55 * Math.cos(a) + 5).toFixed(1)}" font-size="14" text-anchor="middle">${t}</text>`; });
    s += `<g class="bt-hand"><line x1="0" y1="14" x2="0" y2="-74" stroke="${COP}" stroke-width="2.6" stroke-linecap="round"/><circle r="5.5" style="fill:${COP}"/><circle r="2" style="fill:#0b0e13"/></g>`;
    el.dial.innerHTML = s;
  })();
  const hand = overlay.querySelector('.bt-hand');

  // ───────────── timing per mode ─────────────
  const isNum = x => typeof x === 'number' && isFinite(x);
  function plan(p, dur) {
    const mode = p.mode || 'cell';
    const q = { mode };
    if (mode === 'cutaway') { q.o0 = (isNum(p.openAt) ? p.openAt : 0.04) * dur; q.o1 = (isNum(p.openEnd) ? p.openEnd : 0.30) * dur; }
    if (mode === 'reaction') {
      const o1 = p.open === false ? 0 : Math.min((isNum(p.openEnd) ? p.openEnd : 0.12) * dur, 2.2);
      q.o0 = 0; q.o1 = o1; q.c0 = o1 * 0.7; q.c1 = q.c0 + 0.8;
    }
    return q;
  }
  const openAt = (u, a, b) => (b <= a ? 1 : ease((u - a) / (b - a)));
  function progressOf(p, u, dur) {
    if (isNum(p.progress)) return clamp(p.progress);
    const p0 = isNum(p.p0) ? p.p0 : 0, p1 = isNum(p.p1) ? p.p1 : 0.6;
    return lerp(p0, p1, smooth((u - 0.15 * dur) / (0.8 * dur)));
  }
  const closeIn = 1.3;
  function sideYaw(mode, u, T) { return 0.32 * Math.sin(0.33 * T) * (mode === 'curve' ? smooth(u / 2.5) : 1); }
  // budget timeline
  function budgetPlan(p, dur) {
    const ts = Math.max(2, Math.round((isNum(p.switchAt) ? p.switchAt : 0.6) * dur));
    return { ts, d0: 0.1 * dur, d1: ts };
  }
  function subdialAngle(u, ts) {   // seconds shown on the subdial (float), steps at integer seconds, then 2 s jumps
    const st = (t, w) => Math.floor(t) + ease(clamp((t - Math.floor(t)) / w));
    if (u <= ts) return st(Math.max(0, u), 0.09 / 1);
    return ts + 2 * st((u - ts) / 2, 0.06);
  }

  // ───────────── pose ─────────────
  function setOpen(s) {
    full.visible = s < 1e-4; body.visible = !full.visible;
    wedge.visible = body.visible && s < 0.999;
    const k = smooth(s);
    wedge.position.set(0, 8 * k, 1.5 * k);
    wedge.rotation.x = -0.12 * k;
    const op = 1 - smooth((s - 0.5) / 0.45);
    for (const [m] of wedgeMats) { m.opacity = op; m.depthWrite = op > 0.98; }
  }
  function setShade(k) {
    k = 1 - (1 - clamp(k)) * (1 - clamp(k));
    MAT.cathode.color.copy(C_OX).lerp(C_AG, k);
    MAT.cathode.metalness = lerp(0.15, 0.6, k); MAT.cathode.roughness = lerp(0.85, 0.4, k);
    for (const [m, src] of wedgeMats) if (src === MAT.cathode) { m.color.copy(src.color); m.metalness = src.metalness; m.roughness = src.roughness; }
  }
  function setCircuit(a, t, flow) {
    circuit.visible = a > 0.01;
    wireMat.opacity = a; chipMat.opacity = a; padMat.opacity = a; iconMat.opacity = a;
    wireMat.depthWrite = chipMat.depthWrite = padMat.depthWrite = iconMat.depthWrite = a > 0.98;
    electrons.userData.update(t * flow, a);
    ions.userData.update(t * flow, a);
  }

  // ───────────── overlay helpers ─────────────
  const f1 = x => x.toFixed(1);
  function arrowLine(a, b, col, w = 1.3) {
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, s = 7, hw = 3.2;
    const head = (p, sg) => `<path d="M${f1(p.x)},${f1(p.y)} L${f1(p.x - sg * ux * s - uy * hw)},${f1(p.y - sg * uy * s + ux * hw)} L${f1(p.x - sg * ux * s + uy * hw)},${f1(p.y - sg * uy * s - ux * hw)} Z" style="fill:${col}"/>`;
    return `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="${col}" stroke-width="${w}"/>` + head(b, 1) + head(a, -1);
  }
  const ext = (a, b, op) => `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="rgba(236,235,230,${(0.5 * op).toFixed(3)})" stroke-width="1"/>`;
  function tagText(x, y, text, op, anchor = 'middle') {
    const w = text.length * 8.6 + 14;
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    return `<g opacity="${op.toFixed(3)}"><rect x="${f1(x0)}" y="${f1(y - 13)}" width="${f1(w)}" height="24" rx="4" style="fill:rgba(9,12,16,0.82)" stroke="rgba(205,218,232,0.16)"/>
      <text x="${f1(x0 + w / 2)}" y="${f1(y + 4.5)}" font-size="14.5" text-anchor="middle" style="fill:#ecebe6">${text}</text></g>`;
  }
  function dimsSvg(u, dur) {
    const a1 = smooth((u - 0.08 * dur) / 0.6), a2 = smooth((u - 0.16 * dur) / 0.6);
    if (a1 < 0.01 && a2 < 0.01) return '';
    let s = '';
    // diameter, measured in the plane of the can face, drawn behind the cell
    const zb = -(R + 1.7);
    const L = projL(group, -R, H, 0), Rr = projL(group, R, H, 0), Lb = projL(group, -R, H, zb - 0.6), Rb = projL(group, R, H, zb - 0.6);
    const DL = projL(group, -R, H, zb), DR = projL(group, R, H, zb);
    if (a1 > 0.01) {
      s += `<g opacity="${a1.toFixed(3)}">` + ext(L, Lb, 1) + ext(Rr, Rb, 1) + arrowLine(DL, DR, '#ecebe6') + '</g>';
      s += tagText((DL.x + DR.x) / 2, (DL.y + DR.y) / 2 - 20, 'Ø 9.5 mm', a1);
    }
    // height, at the right-hand silhouette
    const xr = R + 1.6, B0 = projL(group, 3.6, 0, 0), B1 = projL(group, xr + 0.6, 0, 0), T0 = projL(group, R, H, 0), T1 = projL(group, xr + 0.6, H, 0);
    const HB = projL(group, xr, 0, 0), HT = projL(group, xr, H, 0);
    if (a2 > 0.01) {
      s += `<g opacity="${a2.toFixed(3)}">` + ext(B0, B1, 1) + ext(T0, T1, 1) + arrowLine(HB, HT, '#ecebe6') + '</g>';
      s += tagText(HB.x + 16, (HB.y + HT.y) / 2, '3.6 mm', a2, 'start');
    }
    return s;
  }
  let labKey = '';
  function drawLabels(keys, texts, op, stagger0, u) {
    const key = keys.join(',') + '|' + keys.map(k => texts[k]).join(',');
    if (key !== labKey) {
      labKey = key;
      labLayer.innerHTML = keys.map(k => `<div data-k="${k}" style="position:absolute;left:0;top:0;white-space:nowrap;font-size:13px;padding:4px 8px;border-radius:4px;background:rgba(9,12,16,0.82);border:1px solid rgba(205,218,232,0.16);transform:translate(-100%,-50%)">${texts[k]}</div>`).join('');
    }
    if (!keys.length) return '';
    // anchors → screen; labels in a column left of the leftmost anchor, spread vertically
    const items = keys.map((k, i) => { const q = WX.project(WX.anchors['battery:' + k], {}); return { k, i, ax: q.x, ay: q.y, op: op * smooth((u - stagger0 - i * 0.35) / 0.4) }; });
    const colX = Math.max(250, Math.min(...items.map(it => it.ax)) - 70);
    const sorted = items.slice().sort((a, b) => a.ay - b.ay), gap = 42;
    sorted.forEach((it, j) => { it.ly = it.ay; if (j > 0) it.ly = Math.max(it.ly, sorted[j - 1].ly + gap); });
    const shift = (sorted.reduce((s, it) => s + it.ay - it.ly, 0)) / sorted.length;
    sorted.forEach(it => { it.ly = clamp(it.ly + shift, 120, 585); });
    for (let j = sorted.length - 2; j >= 0; j--) sorted[j].ly = Math.min(sorted[j].ly, sorted[j + 1].ly - gap);
    let s = '';
    labLayer.querySelectorAll('[data-k]').forEach(d => {
      const it = items.find(x => x.k === d.dataset.k);
      d.style.left = f1(colX) + 'px'; d.style.top = f1(it.ly) + 'px'; d.style.opacity = it.op.toFixed(3);
      if (it.op > 0.01) {
        s += `<g opacity="${it.op.toFixed(3)}"><polyline points="${f1(colX + 2)},${f1(it.ly)} ${f1(colX + 18)},${f1(it.ly)} ${f1(it.ax)},${f1(it.ay)}" fill="none" stroke="rgba(236,235,230,0.62)" stroke-width="1"/>
          <circle cx="${f1(it.ax)}" cy="${f1(it.ay)}" r="3.4" style="fill:${COP}"/><circle cx="${f1(it.ax)}" cy="${f1(it.ay)}" r="6" fill="none" stroke="${COP}" stroke-opacity="0.35" stroke-width="2"/></g>`;
      }
    });
    return s;
  }
  function chartPath(f, x1) {
    if (x1 <= 0) return '';
    const n = Math.max(2, Math.ceil(x1 * 360));
    let d = '';
    for (let i = 0; i <= n; i++) { const x = x1 * i / n; d += (i ? ' L' : 'M') + f1(cxp(x)) + ',' + f1(cyp(Math.max(VMIN, f(x)))); }
    return d;
  }
  function penOf(p, u, dur) {
    const a = (isNum(p.plotStart) ? p.plotStart : 0.06) * dur, b = (isNum(p.plotEnd) ? p.plotEnd : 0.8) * dur, m = a + 0.62 * (b - a);
    if (u <= a) return 0;
    if (u <= m) return 0.88 * (u - a) / (m - a);                  // steady through the flat part
    return 0.88 + 0.12 * easeOut(clamp((u - m) / (b - m)));       // slow down through the knee
  }

  return {
    cameras: {
      cell: { t: [0, 1.5, 0], yaw: 0, pitch: 0.72, dist: 30 },
      cutaway: { t: [1.9, 1.65, 0], yaw: 0.0, pitch: 0.32, dist: 32 },
      closeup: { t: [-1.6, 1.75, 0], yaw: 0.0, pitch: 0.36, dist: 25 },
      reaction: { t: [2.6, 1.6, 0], yaw: 0.16, pitch: 0.3, dist: 33 },
      side: { t: [-20.5, 4.6, 0], yaw: 0.12, pitch: 0.42, dist: 64 },
    },
    update(u, p, T, dur) {
      const q = plan(p, dur), mode = q.mode;
      let yaw = 0, open = 0, circ = 0, shade = 0;
      if (mode === 'cell') {
        const turn = isNum(p.turn) ? p.turn : 0.75;
        yaw = turn * Math.pow(1 - clamp(u / dur), 2);
      } else if (mode === 'cutaway') {
        open = openAt(u, q.o0, q.o1);
        if (p.turn !== false) yaw = 0.14 * Math.sin(Math.PI * clamp((u - q.o1) / Math.max(1, dur - q.o1)));   // slow sway, back to 0 at the end
      } else if (mode === 'reaction') {
        open = openAt(u, q.o0, q.o1);
        circ = smooth((u - q.c0) / (q.c1 - q.c0));
        shade = progressOf(p, u, dur);
      } else {   // curve, budget
        yaw = sideYaw(mode, u, T);
        const closing = mode === 'curve' && p.close !== false;
        open = closing ? 1 - ease(u / closeIn) : 0;
        circ = closing ? 1 - smooth(u / 0.8) : 0;
        shade = isNum(p.progress) ? p.progress : 0.6;
      }
      cell.rotation.y = yaw;
      setOpen(open);
      setShade(shade);
      setCircuit(circ, u, isNum(p.flow) ? p.flow : 1);
    },
    overlay(u, p, T, dur) {
      const q = plan(p, dur), mode = q.mode;
      let svg = '';
      // cell: dimensions + ID card
      const cellMode = mode === 'cell';
      if (cellMode && p.dims !== false) svg += dimsSvg(u, dur);
      el.id.style.opacity = cellMode && p.card !== false ? smooth((u - 0.22 * dur) / 0.6).toFixed(3) : '0';
      const showEly = mode === 'cutaway' && p.card !== false;
      el.ely.style.opacity = showEly ? smooth((u - q.o1 - 2.4) / 0.6).toFixed(3) : '0';
      if (showEly) {   // beside the cell when there is room, otherwise in the free top-left corner (below the brand)
        const xr = projL(group, R, H / 2, 0).x, side = xr + 36 <= 958;
        el.ely.style.left = (side ? f1(Math.max(xr + 36, 760)) : '40') + 'px';
        el.ely.style.top = (side ? '292' : '84') + 'px';
      }
      // part labels
      let keys = [], texts = LABELS, lop = 0, l0 = 0;
      if (mode === 'cutaway' || mode === 'reaction') {
        const def = mode === 'cutaway' ? ['can', 'cathode', 'separator', 'anode', 'gasket', 'cap'] : ['cathode', 'separator', 'anode'];
        keys = p.labels === false ? [] : Array.isArray(p.labels) ? p.labels.filter(k => LABELS[k]) : def;
        texts = mode === 'cutaway' ? LABELS : LABELS_RX;
        l0 = mode === 'cutaway' ? q.o1 + 0.1 : q.o1 + 0.5;
        lop = 1;
      }
      svg += drawLabels(keys, texts, lop, l0, u);
      // reaction extras
      const rx = mode === 'reaction';
      const eqOp = rx ? smooth((u - Math.max(q.c1, 0.2 * dur)) / 0.6) : 0;
      el.eq.style.opacity = eqOp.toFixed(3);
      el.leg.style.opacity = rx ? smooth((u - q.c1 - 0.3) / 0.6).toFixed(3) : '0';
      if (rx) {
        const pr = progressOf(p, u, dur);
        el.used.style.width = (pr * 100).toFixed(1) + '%'; el.usedTxt.textContent = Math.round(pr * 100) + ' %';
        const lp = WX.project(WX.anchors['battery:load'], {});
        el.load.style.transform = `translate(${f1(lp.x)}px, ${f1(lp.y)}px)`;
        el.load.style.opacity = smooth((u - q.c1) / 0.5).toFixed(3);
        for (const [k, o] of [['-', termMinus], ['+', termPlus]]) {
          const tp = WX.project(o, {});
          el.terms[k].style.transform = `translate(${f1(tp.x)}px, ${f1(tp.y)}px)`;
          el.terms[k].style.opacity = smooth((u - q.c1 + 0.2) / 0.5).toFixed(3);
        }
      } else {
        el.load.style.opacity = '0'; el.terms['-'].style.opacity = '0'; el.terms['+'].style.opacity = '0';
      }
      // curve chart
      const cv = mode === 'curve';
      el.chart.style.opacity = cv ? smooth((u + 0.25) / 0.55).toFixed(3) : '0';
      if (cv) {
        const x = penOf(p, u, dur);
        el.ag.setAttribute('d', chartPath(vAg, x));
        el.alk.setAttribute('d', chartPath(vAlk, x));
        const px = cxp(x);
        el.pen.setAttribute('x1', f1(px)); el.pen.setAttribute('x2', f1(px));
        el.dag.setAttribute('cx', f1(px)); el.dag.setAttribute('cy', f1(cyp(Math.max(VMIN, vAg(x)))));
        el.dalk.setAttribute('cx', f1(px)); el.dalk.setAttribute('cy', f1(cyp(Math.max(VMIN, vAlk(x)))));
        el.vread.textContent = vAg(x).toFixed(2) + ' V';
        el.a1.setAttribute('opacity', smooth((x - 0.3) / 0.12).toFixed(3));
        el.a3.setAttribute('opacity', smooth((x - 0.62) / 0.12).toFixed(3));
        el.a2.setAttribute('opacity', smooth((x - 0.975) / 0.02).toFixed(3));
      }
      // budget
      const bd = mode === 'budget';
      el.bud.style.opacity = bd ? '1' : '0';
      el.sub.style.opacity = bd ? smooth((u + 0.25) / 0.55).toFixed(3) : '0';
      if (bd) {
        const bp = budgetPlan(p, dur);
        const at = [-1, -1, 0.14 * dur, 0.28 * dur, -1];
        el.rows.forEach((r, i) => { r.style.opacity = smooth((u - at[i]) / 0.5).toFixed(3); });
        const k = smooth((u - bp.d0) / (bp.d1 - bp.d0));
        const left = lerp(1, 0.035, k);
        el.chg.style.width = (left * 100).toFixed(1) + '%';
        el.chg.style.background = left < 0.12 ? '#e0614f' : COP;
        el.yr.textContent = 'year ' + (3.0 * (1 - left) / 0.965).toFixed(1);
        // subdial
        const sec = subdialAngle(u, bp.ts);
        hand.setAttribute('transform', `rotate(${(sec * 6).toFixed(2)})`);
        const sw = u > bp.ts + 0.05;
        el.cap1.style.opacity = sw ? '0.4' : '1';
        el.cap2.style.opacity = smooth((u - bp.ts - 0.2) / 0.5).toFixed(3);
        el.cap3.style.opacity = smooth((u - bp.ts - 2.2) / 0.5).toFixed(3);
        // step strip: one mark per step, height = size of the step
        const W = 268, x0 = 8, x1 = W - 8, base = 34;
        const X = t => x0 + (x1 - x0) * clamp(t / dur);
        let s = `<line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="rgba(205,218,232,0.25)" stroke-width="1"/>`;
        for (let t = 1; t <= bp.ts && t <= u; t++) s += `<rect x="${f1(X(t) - 1.5)}" y="${base - 11}" width="3" height="11" style="fill:#ecebe6" opacity="0.8"/>`;
        for (let t = bp.ts + 2; t <= u; t += 2) s += `<rect x="${f1(X(t) - 1.5)}" y="${base - 22}" width="3" height="22" style="fill:${COP}"/>`;
        s += `<line x1="${f1(X(u))}" y1="6" x2="${f1(X(u))}" y2="${base + 4}" stroke="${COP}" stroke-opacity="0.6" stroke-width="1"/>`;
        s += `<text x="${x0}" y="10" font-size="10.5" style="fill:${MUT}">steps</text>`;
        el.strip.innerHTML = s;
      }
      // corner note
      const tag = mode === 'cutaway' ? 'Layers not to scale' : mode === 'reaction' ? 'Schematic · not to scale' : '';
      el.tag.textContent = tag;
      el.tag.style.opacity = tag ? '1' : '0';
      svgG.innerHTML = svg;
    },
  };
});
