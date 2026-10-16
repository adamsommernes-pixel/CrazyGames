// Close-up stage: the C-MOS IC. One chip runs the whole 8T63: it keeps the crystal ringing, divides
// its 32,768 Hz down to one pulse a second, drives both stepping motors and runs the stopwatch logic.
// Figures used (Seiko / generic watch-IC practice): one C-MOS IC, 32,768 Hz = 2^15 (15 divide-by-two
// stages), circuit block under 0.70 µA at 1.55 V, motor pulses a few milliseconds long with the
// direction reversed each time, stopwatch motor 5 pulses/s. Board shape, die layout, block sizes and
// pad assignments are illustrative.
//
// Modes (p.mode):
//   'board'     amber flex-circuit section with gold traces, the black IC package and the crystal can.
//               p.reveal 0..1 (default eased over 0.3..0.7·dur) lifts and fades the package to show the
//               bare die (cell rows, 15 identical flip-flop cells, bond pads, bond wires).
//               p.labels (default true) draws part labels; die-block labels appear when the die is big on screen.
//   'divider'   the 15-stage ripple counter as a row of blocks with LEDs, frequency labels and the binary
//               count, slowed down. Input runs at p.rate0 (8 pulses/s), then (p.ff, default on) speeds up
//               from p.ffAt and slows down again so the count rolls over 32,767 -> 0 at p.hitAt: one output
//               pulse = one second. Optional rate-trim events (p.trimAt, p.trimEvery, p.trimN) delete input
//               pulses; on by default for shots of 18 s or more.
//   'driver'    H-bridge: four switches round the motor coil; diagonal pairs close on alternate pulses.
//               p.period (1 s), p.pw (shown pulse length, 0.42 s), p.firstAt (0.5 s).
//   'stopwatch' block diagram: divider -> time motor (1 pulse/s); 5-per-second counter -> gate -> stopwatch
//               motor; contacts for pusher A, pusher B and the crown. p.pressAt (0.3·dur) starts, p.stopAt
//               (0.75·dur) stops; optional p.resetAt (pusher B), p.crownAt / p.crownEnd (seconds stopped).
WX.registerStage('chip', function (ctx) {
  const { THREE, WX, group, overlay } = ctx;
  const { TAU, clamp, smooth, lerp, ease } = WX;
  const FULL = 32768;
  const C_PULSE = new THREE.Color(0x78c3ff), C_COPPER = new THREE.Color(0xe39a5c);
  const C_LED_OFF = new THREE.Color(0x1d2733), C_LED_ON = new THREE.Color(0x9ad6ff);

  // ───────────────────────── small local helpers ─────────────────────────
  function mkRng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // concatenate geometries (position / normal / uv) into one non-indexed geometry: one draw call
  function mergeGeos(list) {
    const parts = list.map(g => (g.index ? g.toNonIndexed() : g));
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of parts) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += c;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    return out;
  }
  // shape drawn in (x, -z) extruded upwards from y0 to y1: flat parts lying on the XZ plane
  const flatGeo = (shape, y0, y1, curve = 12, bevel = 0) => WX.extrude(shape, y0, y1, curve, bevel).rotateX(-Math.PI / 2);
  const boxAt = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  // flat strip (trace, rail) along an XZ polyline, as boxes with round joints
  function stripParts(pts, w, y0, h) {
    const parts = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-6) continue;
      parts.push(new THREE.BoxGeometry(len, h, w).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, y0 + h / 2, (az + bz) / 2));
    }
    for (let i = 0; i < pts.length; i++) parts.push(new THREE.CylinderGeometry(w / 2, w / 2, h, 14).translate(pts[i][0], y0 + h / 2, pts[i][1]));
    return parts;
  }
  // constant-speed position along a 3D polyline
  function polyPath(pts) {
    const P = pts.map(q => (q.isVector3 ? q.clone() : new THREE.Vector3(q[0], q[1], q[2])));
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
    const len = cum[cum.length - 1];
    return {
      len,
      at(t, out) {
        const d = clamp(t) * len; let lo = 0, hi = cum.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
        return out.copy(P[lo]).lerp(P[hi], (d - cum[lo]) / ((cum[hi] - cum[lo]) || 1));
      },
    };
  }
  const marker = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const mesh = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const glowTex = WX.canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.5)'); g.addColorStop(0.55, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  function sprite(color, parent, x, y, z) {
    const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const s = new THREE.Sprite(m); s.position.set(x, y, z); s.renderOrder = 8; s.visible = false; parent.add(s);
    s.userData.set = (size, k) => { s.visible = k > 0.01; s.scale.set(size, size, 1); m.opacity = clamp(k); };
    return s;
  }
  const _m4 = new THREE.Matrix4(), _v = new THREE.Vector3(), _c = new THREE.Color();
  // instanced copies of one geometry with per-instance colour (LEDs, glow strips, blocks)
  function instanced(geo, mat, positions, parent) {
    const im = new THREE.InstancedMesh(geo, mat, positions.length);
    positions.forEach((q, i) => { _m4.makeTranslation(q[0], q[1], q[2]); im.setMatrixAt(i, _m4); im.setColorAt(i, _c.set(0xffffff)); });
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; parent.add(im);
    return im;
  }
  // a pool of glowing beads, rebuilt from scratch every frame (begin / put / end)
  function pool(n, r, parent) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 12, 8), mat, n);
    im.frustumCulled = false; im.renderOrder = 7; parent.add(im);
    for (let i = 0; i < n; i++) im.setColorAt(i, _c.set(0xffffff));
    let k = 0;
    const api = {
      begin() { k = 0; },
      put(v, s = 1, col = C_PULSE, a = 1) { if (k >= n || s <= 0.001) return; _m4.makeScale(s, s, s); _m4.setPosition(v); im.setMatrixAt(k, _m4); im.setColorAt(k, _c.copy(col).multiplyScalar(a)); k++; },
      end() { _m4.makeScale(0, 0, 0); for (let i = k; i < n; i++) im.setMatrixAt(i, _m4); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.visible = k > 0; },
    };
    api.begin(); api.end();
    return api;
  }
  const ledGeo = r => new THREE.SphereGeometry(r, 22, 10, 0, TAU, 0, Math.PI / 2);
  const ledMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const glowMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const roundBox = (w, d, h, r = 0.35, bev = 0.1) => flatGeo(WX.roundRect(w, d, r), 0, h, 6, bev);
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // shared materials
  const MAT = {
    chip: WX.mat('chip'), gold: WX.mat('gold'), steel: WX.mat('steel'), brushed: WX.mat('brushed'), nickel: WX.mat('nickel'),
    silicon: WX.mat('silicon'), plastic: WX.mat('plastic'), copper: WX.mat('copper'), magN: WX.mat('magN'), magS: WX.mat('magS'),
  };
  // dark silicon slab under the diagrams (faint cell rows)
  const slabTex = WX.canvasTex(1024, 256, (c, w, h) => {
    const R = mkRng(77);
    c.fillStyle = '#1b212c'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      c.fillStyle = 'rgba(150,170,200,0.07)'; c.fillRect(0, y, w, 2);
      for (let x = 0; x < w;) { const cw = 6 + Math.floor(R() * 6) * 6; c.fillStyle = `rgba(150,170,205,${0.015 + 0.03 * R()})`; c.fillRect(x + 1, y + 4, cw - 2, 9); x += cw; }
    }
    c.fillStyle = 'rgba(214,180,110,0.06)';
    for (let i = 0; i < 70; i++) c.fillRect(Math.floor(R() * w), 0, 2, h);
  });
  slabTex.wrapS = slabTex.wrapT = THREE.RepeatWrapping; slabTex.repeat.set(1 / 40, 1 / 10);
  const slabMat = new THREE.MeshStandardMaterial({ map: slabTex, metalness: 0.35, roughness: 0.55, envMapIntensity: 0.7 });
  const slabEdge = new THREE.MeshStandardMaterial({ color: 0x232a35, metalness: 0.4, roughness: 0.5 });
  function slab(parent, x0, x1, z0, z1) {
    const g = flatGeo(WX.roundRect(x1 - x0, z1 - z0, 2.2), -1.2, 0, 10);
    return mesh(parent, g, [slabMat, slabEdge], (x0 + x1) / 2, 0, (z0 + z1) / 2);
  }

  // ═══════════════════════════ 1 · BOARD ═══════════════════════════
  // flex circuit section lying in the XZ plane (top at y = 0), IC centre at (IC_X, IC_Z)
  const boardG = new THREE.Group(); group.add(boardG);
  const IC_X = 3, IC_Z = -0.5;
  const DW = 2.8, DY0 = 0.03, DH = 0.24, DTOP = DY0 + DH;  // die (illustrative size)
  const PK = 5.2, PKH = 0.85;                              // package
  const BRD = 17;                                          // board texture covers [-17, 17]² mm
  const OUTLINE = [[-15, 7], [-6, 9.5], [13, 9], [16, 5], [16, -6], [11, -9.5], [-10, -9.5], [-15, -4]]; // (x, z)
  const HOLES = [[-12.6, -6.2], [-1.4, 8.0]];
  // die pads and lead fingers: 5 per side; (dx, dz) pad, (fx, fz) finger, relative to the IC centre
  const PADS = [];
  for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) for (let s = -2; s <= 2; s++) {
    const tx = sz ? 1 : 0, tz = sx ? 1 : 0;
    PADS.push({ sx, sz, dx: sx * 1.2 + tx * s * 0.5, dz: sz * 1.2 + tz * s * 0.5, fx: sx * 2.1 + tx * s * 0.68, fz: sz * 2.1 + tz * s * 0.68 });
  }
  // traces (world x, z), each starting at a lead finger under the package
  const ROUTES = [
    { pts: [[0.9, -1.86], [-6.0, -1.86]], end: 'xpad' },                                   // crystal
    { pts: [[0.9, -1.18], [-6.0, -1.18]], end: 'xpad' },
    { pts: [[0.9, -0.5], [-1.3, -0.5]], end: 'via' },
    { pts: [[0.9, 0.18], [-3.0, 0.18], [-10.2, 7.38], [-10.8, 7.38]], end: 'pad' },          // coil A
    { pts: [[0.9, 0.86], [-1.6, 0.86], [-8.6, 7.86]], end: 'pad' },
    { pts: [[1.64, -2.6], [1.64, -4.2], [-2.46, -8.3], [-4.0, -8.3]], end: 'pad' },          // crown contact
    { pts: [[2.32, -2.6], [2.32, -4.5]], end: 'via' },
    { pts: [[3.0, -2.6], [3.0, -5.6]], end: 'via' },
    { pts: [[3.68, -2.6], [3.68, -4.0], [7.88, -8.2]], end: 'pad' },                         // pusher contacts
    { pts: [[4.36, -2.6], [4.36, -3.4], [9.16, -8.2], [11.2, -8.2]], end: 'pad' },
    { pts: [[5.1, -1.86], [8.4, -1.86], [9.74, -3.2], [13.6, -3.2]], end: 'pad', w: 0.34 }, // battery
    { pts: [[5.1, -1.18], [7.0, -1.18]], end: 'via' },
    { pts: [[5.1, -0.5], [13.6, -0.5]], end: 'pad', w: 0.34 },
    { pts: [[5.1, 0.18], [7.2, 0.18], [12.72, 5.7], [12.72, 6.6]], end: 'pad' },             // coil B
    { pts: [[5.1, 0.86], [6.4, 0.86], [10.4, 4.86], [10.4, 7.3]], end: 'pad' },
    { pts: [[1.64, 1.6], [1.64, 3.4]], end: 'via' },
    { pts: [[2.32, 1.6], [2.32, 2.8]], end: 'via' },
    { pts: [[3.0, 1.6], [3.0, 5.6]], end: 'pad' },
    { pts: [[3.68, 1.6], [3.68, 4.3]], end: 'via' },
    { pts: [[4.36, 1.6], [4.36, 3.0]], end: 'via' },
  ];
  ROUTES.forEach(r => { r.pts = r.pts.map(q => q.slice()); r.pts[0][0] = IC_X + (r.pts[0][0] - 3); r.pts[0][1] = IC_Z + (r.pts[0][1] + 0.5); });
  function paintBoard(c, N, mask) {
    const P = WX.painter(c, N, BRD), R = mkRng(31);
    if (mask) { c.fillStyle = '#262626'; c.fillRect(0, 0, N, N); }
    else {
      const g = c.createLinearGradient(0, 0, N, N); g.addColorStop(0, '#b06a24'); g.addColorStop(0.55, '#94521a'); g.addColorStop(1, '#7a4313');
      c.fillStyle = g; c.fillRect(0, 0, N, N);
      for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,214,150' : '60,24,4'},${0.012 + 0.022 * R()})`; const r = 1 + R() * 3.5; c.beginPath(); c.arc(R() * N, R() * N, r, 0, TAU); c.fill(); }
      for (let i = 0; i < 14; i++) { const x = R() * N, y = R() * N, r = 120 + R() * 260, gg = c.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(${R() < 0.5 ? '255,200,120' : '70,30,6'},0.06)`); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
    }
    P.mm(); c.lineCap = 'round'; c.lineJoin = 'round';
    const line = (pts, w) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], -q[1]) : c.moveTo(q[0], -q[1]))); c.lineWidth = w; c.stroke(); };
    const disc = (x, z, r) => { c.beginPath(); c.arc(x, -z, r, 0, TAU); c.fill(); };
    // traces under the amber coverlay: a dark edge, then the gold
    if (!mask) { c.strokeStyle = 'rgba(70,34,8,0.55)'; ROUTES.forEach(r => line(r.pts, (r.w || 0.22) + 0.09)); }
    c.strokeStyle = mask ? '#8c8c8c' : '#cf9443';
    ROUTES.forEach(r => line(r.pts, r.w || 0.22));
    // a ground loop along the edge
    c.strokeStyle = mask ? '#707070' : 'rgba(205,146,66,0.8)';
    line([[-13.8, 4.6], [-13.8, -3.4], [-9.6, -8.6], [-5.6, -8.6]], 0.3);
    line([[14.9, -4.6], [14.9, 4.2], [12.4, 8.0], [6.6, 8.2]], 0.3);
    // coverlay openings round the pads, then the bright gold pads, vias and fingers
    const holeCol = mask ? '#000' : '#2a1405';
    for (const r of ROUTES) {
      const [x, z] = r.pts[r.pts.length - 1];
      if (!mask) { c.fillStyle = 'rgba(80,40,10,0.45)'; disc(x, z, r.end === 'via' ? 0.42 : 0.86); }
      c.fillStyle = mask ? '#fff' : '#f2c66a';
      if (r.end === 'via') { disc(x, z, 0.3); c.fillStyle = holeCol; disc(x, z, 0.12); }
      else if (r.end === 'xpad') { c.fillRect(x - 0.45, -z - 0.24, 0.9, 0.48); }
      else { disc(x, z, 0.64); c.fillStyle = holeCol; disc(x, z, 0.22); }
    }
    c.fillStyle = mask ? '#fff' : '#e8bb5c';
    for (const [x, z] of HOLES) disc(x, z, 1.25);
    c.fillStyle = mask ? '#e0e0e0' : '#f0c468';
    c.fillRect(IC_X - 1.65, -IC_Z - 1.65, 3.3, 3.3);   // die-attach pad
  }
  const boardTex = WX.canvasTex(2048, 2048, (c, N) => paintBoard(c, N, false));
  const boardMask = WX.canvasTex(2048, 2048, (c, N) => paintBoard(c, N, true), { linear: true });
  for (const t of [boardTex, boardMask]) { t.repeat.set(1 / (2 * BRD), 1 / (2 * BRD)); t.offset.set(0.5, 0.5); }
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, metalnessMap: boardMask, metalness: 1, roughness: 0.36, envMapIntensity: 1.1 });
  const boardSide = new THREE.MeshStandardMaterial({ color: 0x8a4c17, metalness: 0.1, roughness: 0.5 });
  {
    const shape = WX.polyShape(OUTLINE.map(([x, z]) => [x, -z]));
    for (const [x, z] of HOLES) { const h = new THREE.Path(); h.absarc(x, -z, 0.7, 0, TAU, true); shape.holes.push(h); }
    mesh(boardG, flatGeo(shape, -0.16, 0, 24), [boardMat, boardSide]);
  }
  // lead fingers (3D, for the close-up), die-attach pad
  {
    const parts = [];
    for (const q of PADS) parts.push(boxAt(q.sx ? 0.46 : 0.24, 0.03, q.sx ? 0.24 : 0.46, IC_X + q.fx, 0.02, IC_Z + q.fz));
    parts.push(boxAt(3.3, 0.03, 3.3, IC_X, 0.015, IC_Z));
    mesh(boardG, mergeGeos(parts), MAT.gold);
  }
  // the die: procedural top (pads, power rings, cell rows, 15 identical flip-flop cells, drivers)
  const DIE_N = 2048;
  const DIE_BLK = {
    osc: [330, 330, 860, 790], div: [905, 330, 1718, 868], trim: [330, 830, 545, 985],
    logic: [585, 912, 1463, 1500], drvA: [330, 1020, 545, 1718], drvB: [1503, 1020, 1718, 1718], io: [585, 1545, 1463, 1718],
  };
  function cellRows(c, R, x0, y0, x1, y1, rowH) {
    for (let y = y0; y + rowH <= y1 + 0.5; y += rowH) {
      c.fillStyle = '#8f9ab0'; c.fillRect(x0, y, x1 - x0, 4);
      let x = x0;
      while (x < x1 - 8) {
        const w = Math.min(x1 - x, 12 + 8 * Math.floor(R() * 8));
        c.fillStyle = ['#29324a', '#2f3952', '#252d42', '#323a50'][Math.floor(R() * 4)];
        c.fillRect(x + 2, y + 7, w - 4, rowH - 11);
        c.fillStyle = 'rgba(176,104,140,0.75)';
        for (let fx = x + 6; fx < x + w - 5; fx += 8) c.fillRect(fx, y + 11, 3, rowH - 19);
        if (R() < 0.65) { c.fillStyle = 'rgba(176,190,214,0.85)'; c.fillRect(x + 3, y + rowH * (0.3 + 0.4 * R()), w - 6, 4); }
        x += w;
      }
    }
    c.fillStyle = 'rgba(214,186,118,0.6)';
    for (let x = x0 + 6; x < x1 - 4; x += 14) {
      if (R() < 0.5) continue;
      const a = y0 + R() * (y1 - y0), b = Math.min(y1, a + 30 + R() * (y1 - y0) * 0.55);
      c.fillRect(x, a, 4, b - a);
    }
  }
  function flipFlopCell(c, x, y, w, h) {
    const R = mkRng(1515);   // same seed: all fifteen cells are identical
    c.fillStyle = '#222a3d'; c.fillRect(x, y, w, h);
    c.strokeStyle = '#7f8ba3'; c.lineWidth = 5; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
    cellRows(c, R, x + 10, y + 12, x + w - 10, y + h - 40, 34);
    c.fillStyle = '#3a3150'; c.fillRect(x + 12, y + h - 36, w - 24, 24);
    c.fillStyle = 'rgba(176,104,140,0.9)'; for (let fx = x + 16; fx < x + w - 16; fx += 7) c.fillRect(fx, y + h - 34, 3, 20);
  }
  function paintDie(c, N) {
    const R = mkRng(8063);
    const B = DIE_BLK;
    c.fillStyle = '#1b2231'; c.fillRect(0, 0, N, N);
    c.fillStyle = '#5a6578'; c.fillRect(0, 0, N, 24); c.fillRect(0, N - 24, N, 24); c.fillRect(0, 0, 24, N); c.fillRect(N - 24, 0, 24, N);
    c.strokeStyle = '#808ba0'; c.lineWidth = 9; c.strokeRect(42, 42, N - 84, N - 84);
    // power rings
    c.strokeStyle = '#9ca7bb'; c.lineWidth = 30; c.strokeRect(258, 258, N - 516, N - 516);
    c.strokeStyle = '#c3a66a'; c.lineWidth = 26; c.strokeRect(298, 298, N - 596, N - 596);
    // bond pads + their straps into the ring
    for (const q of PADS) {
      const cx = (q.dx / DW + 0.5) * N, cy = (q.dz / DW + 0.5) * N;
      c.fillStyle = '#8e99ad'; c.fillRect(cx - 22 - Math.abs(q.sz) * 0, cy - 22, 44, 44);
      c.save(); c.translate(cx, cy);
      c.fillStyle = '#8e99ad'; c.fillRect(q.sx ? 0 : -24, q.sz ? 0 : -24, q.sx ? q.sx * 160 : 48, q.sz ? q.sz * 160 : 48);
      c.restore();
      c.fillStyle = '#5b6474'; c.fillRect(cx - 76, cy - 76, 152, 152);
      c.fillStyle = '#c4cbd5'; c.fillRect(cx - 68, cy - 68, 136, 136);
      c.fillStyle = '#a9b1bd'; c.fillRect(cx - 54, cy - 54, 108, 108);
      c.fillStyle = 'rgba(70,78,92,0.6)'; c.fillRect(cx - 18 + 30 * (R() - 0.5), cy - 6, 36, 12);
    }
    // oscillator: two big capacitors, a serpentine resistor, the amplifier transistors
    const o = B.osc;
    for (const [x0, x1] of [[o[0] + 20, o[0] + 255], [o[0] + 275, o[2] - 20]]) {
      c.fillStyle = '#2d2b52'; c.fillRect(x0, o[1] + 20, x1 - x0, 210);
      c.strokeStyle = 'rgba(176,156,236,0.4)'; c.lineWidth = 2;
      for (let x = x0 + 8; x < x1; x += 12) { c.beginPath(); c.moveTo(x, o[1] + 24); c.lineTo(x, o[1] + 226); c.stroke(); }
      c.strokeStyle = '#9ca7bb'; c.lineWidth = 6; c.strokeRect(x0, o[1] + 20, x1 - x0, 210);
    }
    c.strokeStyle = '#a06f8f'; c.lineWidth = 7; c.beginPath();
    for (let i = 0, x = o[0] + 24; x < o[2] - 24; i++, x += 18) { c.lineTo(x, o[1] + (i % 2 ? 252 : 318)); c.lineTo(x + 9, o[1] + (i % 2 ? 252 : 318)); }
    c.stroke();
    for (let i = 0; i < 3; i++) {
      const x0 = o[0] + 20 + i * 168, y0 = o[1] + 340;
      c.fillStyle = '#2b3550'; c.fillRect(x0, y0, 150, 105);
      c.fillStyle = 'rgba(176,104,140,0.9)'; for (let fx = x0 + 8; fx < x0 + 146; fx += 10) c.fillRect(fx, y0 + 6, 4, 93);
      c.fillStyle = 'rgba(176,190,214,0.9)'; c.fillRect(x0, y0 + 46, 150, 10);
    }
    // divider: fifteen identical flip-flop cells (5 × 3), chained by one metal line
    const d = B.div, fw = (d[2] - d[0] - 4 * 18) / 5, fh = (d[3] - d[1] - 2 * 26) / 3;
    const cellXY = i => { const row = Math.floor(i / 5), col = row % 2 ? 4 - (i % 5) : i % 5; return [d[0] + col * (fw + 18), d[1] + row * (fh + 26)]; };
    for (let i = 0; i < 15; i++) { const [x, y] = cellXY(i); flipFlopCell(c, x, y, fw, fh); }
    c.strokeStyle = '#d8b56c'; c.lineWidth = 7; c.lineJoin = 'round'; c.beginPath();
    for (let i = 0; i < 15; i++) { const [x, y] = cellXY(i); c.lineTo(x + fw / 2, y + fh * 0.18); }
    c.stroke();
    // trim memory (fuse grid)
    const t = B.trim;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const x = t[0] + 20 + i * 31, y = t[1] + 18 + j * 33;
      c.fillStyle = '#9ca7bb'; c.fillRect(x, y, 22, 10); c.fillRect(x, y + 18, 22, 6);
      c.fillStyle = (i * 7 + j * 3) % 5 ? '#c8a35a' : '#2a3044'; c.fillRect(x + 8, y + 10, 6, 8);
    }
    // stopwatch logic and input cells
    cellRows(c, R, B.logic[0], B.logic[1], B.logic[2], B.logic[3], 48);
    cellRows(c, R, B.io[0], B.io[1], B.io[2], B.io[3], 42);
    // motor drivers: wide interdigitated output transistors
    for (const k of ['drvA', 'drvB']) {
      const r = B[k];
      c.fillStyle = '#2a2f40'; c.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      for (let y = r[1] + 30, i = 0; y < r[3] - 40; y += 14, i++) { c.fillStyle = i % 2 ? '#a7b2c6' : '#c9ab6c'; c.fillRect(r[0] + 22, y, r[2] - r[0] - 44, 8); }
      c.fillStyle = '#a7b2c6'; c.fillRect(r[0], r[1], 18, r[3] - r[1]); c.fillStyle = '#c9ab6c'; c.fillRect(r[2] - 18, r[1], 18, r[3] - r[1]);
      c.strokeStyle = '#7f8ba3'; c.lineWidth = 6; c.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      c.fillStyle = 'rgba(70,80,100,0.5)'; c.fillRect(r[0] + 20, (r[1] + r[3]) / 2 - 10, r[2] - r[0] - 40, 20);
    }
    // routing channels
    c.fillStyle = 'rgba(214,186,118,0.7)';
    for (let i = 0; i < 6; i++) c.fillRect(B.logic[0], 872 + i * 6, B.logic[2] - B.logic[0], 3);
    c.fillStyle = 'rgba(176,190,214,0.7)';
    for (let i = 0; i < 6; i++) { c.fillRect(551 + i * 5, B.logic[1], 3, B.io[3] - B.logic[1]); c.fillRect(1470 + i * 5, B.logic[1], 3, B.io[3] - B.logic[1]); }
    for (let i = 0; i < 5; i++) c.fillRect(870 + i * 6, B.osc[1], 3, B.osc[3] - B.osc[1]);
    // block tints (thin-film colours), then an overall interference sheen
    const tint = (r, col) => { c.fillStyle = col; c.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); };
    tint(B.div, 'rgba(70,200,160,0.10)'); tint(B.logic, 'rgba(150,110,230,0.10)'); tint(B.osc, 'rgba(100,130,255,0.10)');
    tint(B.drvA, 'rgba(235,180,90,0.08)'); tint(B.drvB, 'rgba(235,180,90,0.08)'); tint(B.io, 'rgba(120,200,230,0.08)');
    c.globalCompositeOperation = 'soft-light';
    const g = c.createLinearGradient(0, 0, N, N);
    g.addColorStop(0, 'rgba(140,100,230,0.55)'); g.addColorStop(0.45, 'rgba(60,190,170,0.45)'); g.addColorStop(1, 'rgba(240,180,80,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, N, N);
    c.globalCompositeOperation = 'source-over';
  }
  const dieTex = WX.canvasTex(DIE_N, DIE_N, paintDie);
  const dieTop = new THREE.MeshStandardMaterial({ map: dieTex, metalness: 0.5, roughness: 0.3, emissive: 0xffffff, emissiveMap: dieTex, emissiveIntensity: 0.3 });
  const dieSide = MAT.silicon;
  mesh(boardG, new THREE.BoxGeometry(DW, DH, DW), [dieSide, dieSide, dieTop, dieSide, dieSide, dieSide], IC_X, DY0 + DH / 2, IC_Z);
  const dieBlockCentre = k => { const r = DIE_BLK[k]; return [IC_X + ((r[0] + r[2]) / 2 / DIE_N - 0.5) * DW, IC_Z + ((r[1] + r[3]) / 2 / DIE_N - 0.5) * DW]; };
  // bond wires (merged) and ball bonds
  {
    const wires = [], balls = [];
    for (const q of PADS) {
      const nx = q.sx, nz = q.sz;
      const a = new THREE.Vector3(IC_X + q.dx, DTOP + 0.015, IC_Z + q.dz), b = new THREE.Vector3(IC_X + q.fx - nx * 0.1, 0.05, IC_Z + q.fz - nz * 0.1);
      const p1 = a.clone().add(new THREE.Vector3(nx * 0.06, 0.3, nz * 0.06));
      const p2 = a.clone().lerp(b, 0.55); p2.y = DTOP + 0.3;
      const p3 = a.clone().lerp(b, 0.88); p3.y = 0.16;
      wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, p1, p2, p3, b]), 26, 0.016, 5, false));
      balls.push(new THREE.SphereGeometry(0.045, 10, 6).scale(1, 0.55, 1).translate(a.x, a.y, a.z));
      balls.push(new THREE.SphereGeometry(0.04, 8, 5).scale(1.6, 0.4, 1.6).translate(b.x, 0.05, b.z));
    }
    mesh(boardG, mergeGeos(wires.concat(balls)), MAT.gold);
  }
  // the package (lifts away)
  const pkgTex = WX.canvasTex(512, 512, (c, w, h) => {
    const R = mkRng(5);
    c.fillStyle = '#16181c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(255,255,255,${0.015 + 0.03 * R()})`; c.fillRect(R() * w, R() * h, 1.6, 1.6); }
    c.beginPath(); c.arc(78, 78, 30, 0, TAU); c.fillStyle = '#0b0c0e'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 3; c.stroke();
  });
  const pkgTop = new THREE.MeshStandardMaterial({ map: pkgTex, metalness: 0.15, roughness: 0.42 });
  const pkgSide = WX.mat('chip');
  const pkg = mesh(boardG, new THREE.BoxGeometry(PK, PKH, PK), [pkgSide, pkgSide, pkgTop, pkgSide, pkgSide, pkgSide], IC_X, PKH / 2, IC_Z);
  // the crystal can: lying on the board, both leads out of one end to two pads
  const xg = new THREE.Group(); xg.position.set(-9.4, 0.72, -1.52); boardG.add(xg);
  mesh(xg, new THREE.CylinderGeometry(0.7, 0.7, 5.0, 44).rotateZ(Math.PI / 2), MAT.steel, -0.25, 0, 0);
  mesh(xg, new THREE.SphereGeometry(0.7, 32, 12, 0, TAU, 0, Math.PI / 2).scale(1, 0.3, 1).rotateZ(Math.PI / 2), MAT.steel, -2.75, 0, 0);
  mesh(xg, new THREE.CylinderGeometry(0.74, 0.74, 0.45, 44).rotateZ(Math.PI / 2), MAT.brushed, 2.4, 0, 0);
  {
    const leads = [];
    for (const s of [-1, 1]) leads.push(WX.tubeGeo([[2.6, 0, s * 0.34], [3.0, 0, s * 0.34], [3.25, -0.36, s * 0.34], [3.42, -0.66, s * 0.34]], 0.05, 24));
    mesh(xg, mergeGeos(leads), MAT.nickel);
    const blobs = [-1.86, -1.18].map(z => new THREE.SphereGeometry(0.32, 18, 8).scale(1.2, 0.35, 0.8).translate(-6.0, 0.03, z));
    mesh(boardG, mergeGeos(blobs), MAT.nickel);
  }
  ctx.anchor('ic', boardG, IC_X, PKH + 0.05, IC_Z);
  ctx.anchor('die', boardG, IC_X, DTOP, IC_Z);
  ctx.anchor('crystal', boardG, -9.4, 1.45, -1.52);
  const bm = {
    die0: marker(boardG, IC_X - DW / 2, DTOP, IC_Z), die1: marker(boardG, IC_X + DW / 2, DTOP, IC_Z),
    coilA: marker(boardG, -9.7, 0, 7.6), coilB: marker(boardG, 11.6, 0, 7.0), battery: marker(boardG, 13.6, 0, -1.85),
    contacts: marker(boardG, 9.5, 0, -8.2), crown: marker(boardG, -4.0, 0, -8.3),
  };
  for (const k of ['osc', 'div', 'logic', 'drvA', 'drvB']) { const [x, z] = dieBlockCentre(k); bm['b_' + k] = marker(boardG, x, DTOP, z); }

  // ═══════════════════════════ 2 · DIVIDER ═══════════════════════════
  const divG = new THREE.Group(); divG.position.set(0, 0, -260); group.add(divG);
  const NP = 6.3, BW = 3.8, BD = 3.4, BH = 1.6;
  const DXk = k => (k === 0 ? -54.4 : -46 + (k - 1) * NP);   // node 0 = oscillator, 1..15 = flip-flops
  const OUT_X0 = DXk(15) + BW / 2, OUT_X1 = DXk(15) + 7.4;
  slab(divG, -59.5, 55.5, -6.2, 6.6);
  instanced(roundBox(BW, BD, BH), MAT.chip, Array.from({ length: 15 }, (_, i) => [DXk(i + 1), 0, 0]), divG);
  mesh(divG, roundBox(4.6, BD, BH), MAT.chip, DXk(0), 0, 0);
  mesh(divG, new THREE.CylinderGeometry(0.42, 0.42, 2.6, 28).rotateZ(Math.PI / 2), MAT.steel, DXk(0), BH + 0.42, 0.95);  // crystal icon
  // traces between stages and to the output
  {
    const parts = [];
    for (let k = 1; k <= 15; k++) parts.push(...stripParts([[DXk(k - 1) + (k === 1 ? 2.3 : BW / 2), 0.5], [DXk(k) - BW / 2, 0.5]], 0.5, 0, 0.06));
    parts.push(...stripParts([[OUT_X0, 0.5], [OUT_X1, 0.5]], 0.5, 0, 0.06));
    for (let k = 0; k <= 15; k++) parts.push(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 28).translate(DXk(k), BH, -0.45));  // LED bezels
    mesh(divG, mergeGeos(parts), MAT.gold);
  }
  const divLed = instanced(ledGeo(0.82), ledMat(), Array.from({ length: 16 }, (_, k) => [DXk(k), BH + 0.04, -0.45]), divG);
  const divHalo = Array.from({ length: 16 }, (_, k) => sprite(0x78c3ff, divG, DXk(k), BH + 0.7, -0.45));
  // glow over each link (link k feeds stage k; 16 = output)
  const linkGeo = new THREE.BoxGeometry(1, 0.1, 0.62);
  const divLink = instanced(linkGeo, glowMat(), Array.from({ length: 16 }, () => [0, 0, 0]), divG);
  for (let k = 1; k <= 16; k++) {
    const a = k <= 15 ? DXk(k - 1) + (k === 1 ? 2.3 : BW / 2) : OUT_X0, b = k <= 15 ? DXk(k) - BW / 2 : OUT_X1;
    _m4.makeScale(b - a, 1, 1); _m4.setPosition((a + b) / 2, 0.09, 0.5); divLink.setMatrixAt(k - 1, _m4);
  }
  divLink.renderOrder = 6;
  // output arrow and the copper frame round the last stage
  const copperFlat = new THREE.MeshBasicMaterial({ color: 0xe39a5c, toneMapped: false });
  mesh(divG, new THREE.ConeGeometry(0.95, 2.0, 24).rotateZ(-Math.PI / 2), copperFlat, OUT_X1 + 0.9, 0.45, 0.5);
  {
    const fw = BW + 1.3, fd = BD + 1.3, t = 0.18, x = DXk(15);
    const parts = [boxAt(fw, 0.05, t, x, 0.03, -fd / 2), boxAt(fw, 0.05, t, x, 0.03, fd / 2), boxAt(t, 0.05, fd, x - fw / 2, 0.03, 0), boxAt(t, 0.05, fd, x + fw / 2, 0.03, 0)];
    mesh(divG, mergeGeos(parts), copperFlat);
  }
  const outFlash = sprite(0xe39a5c, divG, OUT_X1 + 0.6, 1.0, 0.5);
  const st15Flash = sprite(0xe39a5c, divG, DXk(15), BH + 0.6, -0.45);
  // rate-trim gate on the first link
  const GATE_X = (DXk(0) + 2.3 + DXk(1) - BW / 2) / 2;
  const gateMat = WX.mat('chip'); gateMat.transparent = true;
  const gate = mesh(divG, roundBox(1.9, 1.7, 1.0, 0.25, 0.06), gateMat, GATE_X, 0, 0.5);
  const gateLedMat = new THREE.MeshBasicMaterial({ color: 0x3a2a20, toneMapped: false, transparent: true });
  const gateLed = mesh(divG, ledGeo(0.36), gateLedMat, GATE_X, 1.02, 0.5);
  const gateFlash = sprite(0xe39a5c, divG, GATE_X, 1.4, 0.5);
  const divPool = pool(8, 0.42, divG);
  ctx.anchor('stage1', divG, DXk(1), BH + 0.9, -0.45);
  ctx.anchor('stage15', divG, DXk(15), BH + 0.9, -0.45);
  const dm = {
    freq: Array.from({ length: 16 }, (_, k) => marker(divG, DXk(k), 0, BD / 2 + 0.5)),
    bit: Array.from({ length: 16 }, (_, k) => marker(divG, DXk(k), BH + 1.5, -BD / 2 - 0.2)),
    d2: Array.from({ length: 16 }, (_, k) => marker(divG, DXk(k), BH, 1.15)),
    out: marker(divG, OUT_X1 + 1.6, 0.3, 0.5), gate: marker(divG, GATE_X, 1.0, 0.5),
    osc: marker(divG, DXk(0), BH + 1.5, -BD / 2 - 0.2),
  };

  // rate plan: piecewise-exponential input rate, integrated in closed form (pure function of time)
  const seg = (a, b, ra, rb) => ({ a, b, ra, rb, L: Math.log(rb / ra), n0: 0 });
  const segCnt = (s, t) => { const D = s.b - s.a, x = t - s.a; return Math.abs(s.L) < 1e-9 ? s.ra * x : (s.ra * D / s.L) * (Math.exp(s.L * x / D) - 1); };
  const segRate = (s, t) => (Math.abs(s.L) < 1e-9 ? s.ra : s.ra * Math.exp(s.L * (t - s.a) / (s.b - s.a)));
  const segInv = (s, c) => { const D = s.b - s.a; return Math.abs(s.L) < 1e-9 ? s.a + c / s.ra : s.a + (D / s.L) * Math.log(1 + c * s.L / (s.ra * D)); };
  const planCache = new Map();
  function divPlan(p, dur) {
    const key = JSON.stringify([p.rate0, p.rate1, p.rate2, p.ff, p.ffAt, p.hitAt, p.approach, p.trimAt, p.trimEvery, p.trimN, dur]);
    if (planCache.has(key)) return planCache.get(key);
    const r0 = p.rate0 || 8, r1 = p.rate1 || 2, r2 = p.rate2 || 4, CAP = FULL;
    const ff = p.ff !== false;
    const trimOn = p.trimAt === false ? false : (typeof p.trimAt === 'number' || dur >= 18);
    const segs = [];
    let hit = null;
    if (!ff) segs.push(seg(0, 1e9, r0, r0));
    else {
      const ffAt = p.ffAt !== undefined ? p.ffAt : (trimOn ? 0.2 : 0.25) * dur;
      const hitAt = p.hitAt !== undefined ? p.hitAt : (trimOn ? 0.48 : 0.72) * dur;
      const appr = p.approach !== undefined ? p.approach : 2.25;
      const B = Math.max(0.6, hitAt - appr - ffAt), up = 0.34 * B, dn = 0.3 * B;
      const target = FULL - r1 * appr - r0 * ffAt;
      const full = s => segCnt(s, s.b);
      const cnt = (rM, k) => full(seg(0, up, r0, rM)) + rM * k + full(seg(0, dn, rM, r1));
      let rM, k = B - up - dn;
      if (cnt(CAP, k) < target) { rM = CAP; k = (target - full(seg(0, up, r0, CAP)) - full(seg(0, dn, CAP, r1))) / CAP; }
      else { let lo = r0 * 1.001, hi = CAP; for (let i = 0; i < 70; i++) { const m = Math.sqrt(lo * hi); if (cnt(m, k) < target) lo = m; else hi = m; } rM = hi; }
      let t = 0, n = 0;
      const push = s => { s.n0 = n; segs.push(s); n += full(s); t = s.b; };
      push(seg(0, ffAt, r0, r0));
      push(seg(t, t + up, r0, rM));
      push(seg(t, t + k, rM, rM));
      push(seg(t, t + dn, rM, r1));
      hit = t + Math.max(0.05, (FULL - n) / r1);
      push(seg(t, hit, r1, r1));
      push(seg(t, t + 1.2, r1, r2));
      const last = seg(t, 1e9, r2, r2); last.n0 = n; segs.push(last);
    }
    const find = u => { for (let i = segs.length - 1; i > 0; i--) if (u >= segs[i].a) return segs[i]; return segs[0]; };
    const nRaw = u => (u <= 0 ? 0 : (s => s.n0 + segCnt(s, u))(find(u)));
    const rateAt = u => segRate(find(Math.max(0, u)), Math.max(0, u));
    const tRaw = c => { let s = segs[0]; for (const q of segs) if (q.n0 <= c) s = q; return segInv(s, c - s.n0); };
    // rate trim: each event deletes trimN input pulses before they reach the first stage
    const dels = [], trims = [];
    if (trimOn) {
      const t0 = typeof p.trimAt === 'number' ? p.trimAt : 0.64 * dur, every = p.trimEvery || 5, nDel = p.trimN || 2;
      for (let te = t0; te < dur - 0.6 && trims.length < 8; te += every) { const m0 = Math.floor(nRaw(te)) + 1; trims.push({ t: te, m0, n: nDel }); for (let i = 0; i < nDel; i++) dels.push(m0 + i); }
    }
    const delUpTo = c => { let k = 0; for (const d of dels) if (d <= c) k++; return k; };
    const isDel = m => dels.indexOf(m) >= 0;
    const neff = u => { if (u <= 0) return 0; const c = Math.floor(nRaw(u)); return c - delUpTo(c); };
    const tEff = M => { let r = M; for (let i = 0; i < 6; i++) r = M + delUpTo(r); return tRaw(r); };
    const pl = { ff, trimOn, hit, segs, nRaw, rateAt, tRaw, neff, tEff, isDel, dels, trims, r0 };
    planCache.set(key, pl);
    return pl;
  }
  // per-frame divider state: stage outputs with an (exaggerated) ripple delay, blur for fast stages
  function divState(pl, u) {
    const rate = pl.rateAt(u), dl = Math.min(0.045, 0.18 / rate);
    const Q = [0], blur = [0];
    for (let k = 1; k <= 15; k++) {
      Q[k] = Math.floor(pl.neff(u - k * dl) / Math.pow(2, k - 1)) & 1;
      blur[k] = smooth((rate / Math.pow(2, k - 1) - 6) / 10);
    }
    const m = Math.floor(pl.nRaw(u));
    const inAge = m >= 1 ? u - pl.tRaw(m) : 9;
    const tOut = pl.hit !== null ? pl.tEff(FULL) + 16 * dl : null;
    return { rate, dl, Q, blur, m, inAge, inDel: pl.isDel(m), tOut, count: pl.neff(u) % FULL };
  }
  function linkGlow(pl, s, u, k) {
    if (k === 1) {
      let j = s.m; while (j > 0 && pl.isDel(j)) j--;
      return j < 1 ? 0 : Math.exp(-(u - pl.tRaw(j)) / 0.12);
    }
    const j = k - 1, P = Math.pow(2, j);
    const M = Math.floor(pl.neff(u - j * s.dl) / P) * P;
    if (M <= 0) return 0;
    return Math.exp(-Math.max(0, u - (pl.tEff(M) + j * s.dl)) / 0.2);
  }
  function poseDivider(u, p, dur) {
    const pl = divPlan(p, dur), s = divState(pl, u);
    // oscillator LED: a flash per input pulse, a steady glow once they blur together
    const inBlur = smooth((s.rate - 5) / 8);
    const inLed = lerp(Math.exp(-s.inAge / 0.07), 0.6, inBlur);
    for (let k = 0; k <= 15; k++) {
      const v = k === 0 ? inLed : lerp(s.Q[k], 0.5, s.blur[k]);
      divLed.setColorAt(k, _c.copy(C_LED_OFF).lerp(C_LED_ON, v));
      divHalo[k].userData.set(4.6, 0.85 * v);
    }
    divLed.instanceColor.needsUpdate = true;
    for (let k = 1; k <= 15; k++) divLink.setColorAt(k - 1, _c.copy(C_PULSE).multiplyScalar(0.12 + 0.85 * clamp(lerp(linkGlow(pl, s, u, k), 0.7, k === 1 ? inBlur : s.blur[k - 1]))));
    const outAge = s.tOut !== null ? u - s.tOut : -1;
    const outK = outAge >= 0 ? Math.exp(-outAge / 0.9) : 0;
    divLink.setColorAt(15, _c.copy(C_COPPER).multiplyScalar(0.1 + 0.9 * outK));
    divLink.instanceColor.needsUpdate = true;
    outFlash.userData.set(9 * (0.6 + 0.4 * outK), outK);
    st15Flash.userData.set(7, 0.8 * (outAge >= 0 ? Math.exp(-outAge / 0.5) : 0));
    divPool.begin();
    if (outAge >= 0 && outAge < 0.6) divPool.put(_v.set(lerp(OUT_X0, OUT_X1 + 0.6, outAge / 0.6), 0.45, 0.5), 1, C_COPPER, 1);
    divPool.end();
    // trim gate
    const gk = pl.trimOn ? smooth((u - (pl.trims.length ? pl.trims[0].t - 3.0 : 1e9)) / 0.8) : 0;
    gate.visible = gateLed.visible = gk > 0.01;
    gateMat.opacity = gk; gateMat.transparent = gk < 0.999; gateLedMat.opacity = gk;
    const delFlash = s.inDel ? Math.exp(-s.inAge / 0.35) : 0;
    gateLedMat.color.set(0x3a2a20).lerp(C_COPPER, delFlash);
    gateFlash.userData.set(5, delFlash * gk);
  }

  // ═══════════════════════════ 3 · DRIVER (H-bridge) ═══════════════════════════
  const drvG = new THREE.Group(); drvG.position.set(240, 0, -260); group.add(drvG);
  const LEG = 12, RZ = 15, SWZ = 7.5, CY = 3.0, CR = 2.3, CX = 6.6, BATX = -24;
  slab(drvG, -32, 22, -20, 20);
  {
    const parts = [];
    parts.push(...stripParts([[BATX, -7.2], [BATX, -RZ], [LEG, -RZ]], 1.2, 0, 0.12));   // + rail
    parts.push(...stripParts([[BATX, 4.6], [BATX, RZ], [LEG, RZ]], 1.2, 0, 0.12));      // 0 V rail
    for (const x of [-LEG, LEG]) parts.push(...stripParts([[x, -RZ], [x, RZ]], 0.8, 0, 0.08));
    for (const x of [-LEG, LEG]) parts.push(new THREE.CylinderGeometry(0.9, 0.9, 0.14, 24).translate(x, 0.07, 0));
    // the + tab from the cell's top to the rail
    parts.push(boxAt(1.2, 0.12, 2.6, BATX, 2.18, -4.1), boxAt(1.2, 0.12, 2.6, BATX, 1.1, -6.2).rotateX(0));
    mesh(drvG, mergeGeos(parts), MAT.gold);
  }
  // + tab bend (a short ramp)
  mesh(drvG, new THREE.BoxGeometry(1.2, 0.12, 2.7), MAT.gold, BATX, 1.1, -6.25).rotation.x = -0.72;
  // battery (coin cell, + can on top)
  mesh(drvG, new THREE.CylinderGeometry(4.6, 4.6, 2.1, 56), WX.mat('battery'), BATX, 1.05, 0);
  mesh(drvG, new THREE.CylinderGeometry(3.6, 3.6, 0.06, 48), MAT.brushed, BATX, 2.13, 0);
  // switches
  const swMats = [], swGlow = [];
  const swPos = [[-LEG, -SWZ], [LEG, -SWZ], [-LEG, SWZ], [LEG, SWZ]];   // S1 top-left, S2 top-right, S3 bottom-left, S4 bottom-right
  const swGeo = roundBox(4.4, 4.6, 1.8, 0.4, 0.1);
  for (const [x, z] of swPos) {
    const m = WX.mat('chip'); swMats.push(m);
    mesh(drvG, swGeo, m, x, 0, z);
    mesh(drvG, mergeGeos([boxAt(1.1, 0.08, 1.3, x, 1.82, z - 1.45), boxAt(1.1, 0.08, 1.3, x, 1.82, z + 1.45)]), MAT.gold);
    const gm = glowMat(); gm.color.set(0x78c3ff);
    const g = mesh(drvG, new THREE.BoxGeometry(0.75, 0.12, 2.0), gm, x, 1.84, z); g.renderOrder = 6; swGlow.push({ m: gm, o: g });
    mesh(drvG, new THREE.BoxGeometry(0.9, 0.06, 1.5), new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.8 }), x, 1.80, z);
  }
  // motor coil between the legs
  const coilTex = WX.TEX.coil.clone(); coilTex.needsUpdate = true; coilTex.repeat.set(1, 3.2);
  const coilMat = WX.mat('coil'); coilMat.map = coilTex;
  mesh(drvG, new THREE.CylinderGeometry(CR, CR, 2 * CX, 56, 1, true).rotateZ(Math.PI / 2), coilMat, 0, CY, 0);
  mesh(drvG, new THREE.CylinderGeometry(0.9, 0.9, 2 * CX + 1.4, 24).rotateZ(Math.PI / 2), WX.mat('softIron'), 0, CY, 0);
  for (const s of [-1, 1]) mesh(drvG, new THREE.CylinderGeometry(CR + 0.35, CR + 0.35, 0.3, 48).rotateZ(Math.PI / 2), MAT.plastic, s * (CX + 0.15), CY, 0);
  for (const s of [-1, 1]) mesh(drvG, mergeGeos([new THREE.BoxGeometry(1.0, 1.2, 1.4).translate(s * (CX + 0.9), 0.6, 0)]), MAT.plastic);
  {
    const leads = [];
    for (const s of [-1, 1]) leads.push(WX.tubeGeo([[s * (CX - 0.3), CY - CR + 0.05, 0], [s * (CX + 0.6), 1.5, 0], [s * (CX + 2.4), 0.5, 0], [s * LEG, 0.16, 0]], 0.13, 24));
    mesh(drvG, mergeGeos(leads), MAT.copper);
  }
  const coilShellMat = glowMat(); coilShellMat.color.set(0x78c3ff);
  const coilShell = mesh(drvG, new THREE.CylinderGeometry(CR + 0.18, CR + 0.18, 2 * CX - 0.1, 56, 1, true).rotateZ(Math.PI / 2), coilShellMat, 0, CY, 0); coilShell.renderOrder = 5;
  // current paths (battery + -> rail -> switch -> coil -> switch -> 0 V rail -> battery -)
  const TURNS = 8, HR = CR + 0.2;
  const helix = dir => { const pts = []; for (let i = 0; i <= 240; i++) { const f = i / 240, x = -CX + 0.35 + (2 * CX - 0.7) * f, ph = Math.PI + TAU * TURNS * f; pts.push([x, CY + HR * Math.cos(ph), HR * Math.sin(ph)]); } return dir > 0 ? pts : pts.reverse(); };
  const Y = 0.32, YS = 2.05;
  const down = x => [[x, Y, -RZ], [x, Y, -10.6], [x, YS, -9.6], [x, YS, -5.4], [x, Y, -4.4], [x, Y, 0]];
  const up2gnd = x => [[x, Y, 0], [x, Y, 4.4], [x, YS, 5.4], [x, YS, 9.6], [x, Y, 10.6], [x, Y, RZ]];
  const lead = (x, s) => [[x, Y, 0], [s * (CX + 2.4), 0.6, 0], [s * (CX + 0.6), 1.5, 0]];
  const start = [[BATX, 2.4, -2.4], [BATX, 2.4, -5.0], [BATX, Y, -7.6], [BATX, Y, -RZ]];
  const finish = x => [[x, Y, RZ], [BATX, Y, RZ], [BATX, Y, 5.0], [BATX, Y, 3.0]];
  const PATH = {
    pos: polyPath([...start, ...down(-LEG), ...lead(-LEG, -1), ...helix(1), ...lead(LEG, 1).reverse(), ...up2gnd(LEG), ...finish(LEG)].map(q => [q[0], q[1], q[2]])),
    neg: polyPath([...start, ...down(LEG), ...lead(LEG, 1), ...helix(-1), ...lead(-LEG, -1).reverse(), ...up2gnd(-LEG), ...finish(-LEG)].map(q => [q[0], q[1], q[2]])),
  };
  const drvPool = pool(150, 0.3, drvG);
  ctx.anchor('coil', drvG, 0, CY + CR + 0.2, 0);
  ctx.anchor('bridge', drvG, 0, 0.2, -RZ);
  const vm = {
    bat: marker(drvG, BATX, 2.2, 3.2), plus: marker(drvG, -2, 0.2, -RZ), zero: marker(drvG, -2, 0.2, RZ),
    coil: marker(drvG, 0, CY + CR + 0.4, 0), endL: marker(drvG, -CX - 0.3, CY, 0), endR: marker(drvG, CX + 0.3, CY, 0),
    sw: swPos.map(([x, z]) => marker(drvG, x + 2.4, 1.0, z)),
  };
  function drvPlan(p) { return { period: p.period || 1, pw: p.pw || 0.42, t0: p.firstAt !== undefined ? p.firstAt : 0.5 }; }
  function drvAt(pl, u) {
    const i = Math.floor((u - pl.t0) / pl.period), t = u - (pl.t0 + i * pl.period), pol = ((i % 2) + 2) % 2 ? -1 : 1;
    const env = smooth(t / 0.06) * (1 - smooth((t - pl.pw + 0.04) / 0.08));
    return { i, t, pol, env };
  }
  function poseDriver(u, p) {
    const pl = drvPlan(p), s = drvAt(pl, u), e = s.env;
    const on = [s.pol > 0 ? e : 0, s.pol < 0 ? e : 0, s.pol < 0 ? e : 0, s.pol > 0 ? e : 0];   // S1, S2, S3, S4
    on.forEach((k, j) => { swMats[j].emissive.setRGB(0.02 * k, 0.08 * k, 0.2 * k); swGlow[j].m.opacity = 0.15 + 0.85 * k; swGlow[j].m.color.set(0x2a4256).lerp(C_PULSE, k); });
    coilMat.emissive.setRGB(0.03 * e, 0.12 * e, 0.32 * e);
    coilShellMat.opacity = 0.14 * e; coilShell.visible = e > 0.01;
    drvPool.begin();
    if (e > 0.01) {
      const path = s.pol > 0 ? PATH.pos : PATH.neg, n = 120, ph = s.t * 52 / path.len;
      for (let i = 0; i < n; i++) {
        const f = ((i / n + ph) % 1 + 1) % 1, taper = smooth(f / 0.03) * smooth((1 - f) / 0.03);
        drvPool.put(path.at(f, _v), taper, C_PULSE, e);
      }
    }
    drvPool.end();
  }

  // ═══════════════════════════ 4 · STOPWATCH LOGIC ═══════════════════════════
  const logG = new THREE.Group(); logG.position.set(-240, 0, -260); group.add(logG);
  const LB = {
    osc: { x: -35, z: -15, w: 8, d: 6 }, div: { x: -19, z: -15, w: 11, d: 6 }, drvA: { x: 0, z: -15, w: 8, d: 6 },
    cnt5: { x: -9, z: 3, w: 11, d: 6 }, gate: { x: 6, z: 3, w: 6, d: 6 }, drvB: { x: 19, z: 3, w: 8, d: 6 },
    latch: { x: 6, z: 18, w: 11, d: 5.2 },
  };
  const MOT = { A: { x: 16.5, z: -15 }, B: { x: 35, z: 3 } };
  const CON = { crown: { x: -36, z: -3 }, A: { x: -36, z: 16 }, B: { x: -36, z: 25 } };
  slab(logG, -44, 46, -22, 30);
  const LH = 2.0;
  for (const k in LB) { const b = LB[k]; b.mat = WX.mat('chip'); mesh(logG, roundBox(b.w, b.d, LH, 0.5, 0.12), b.mat, b.x, 0, b.z); }
  // wires
  const W = {
    oscDiv: [[-31, -15], [-24.5, -15]], divA: [[-13.5, -15], [-4, -15]], aMot: [[4, -15], [12.6, -15]],
    divCnt: [[-15, -12], [-15, 3], [-14.5, 3]], cntGate: [[-3.5, 3], [3, 3]], gateB: [[9, 3], [15, 3]], bMot: [[23, 3], [31.1, 3]],
    latchGate: [[6, 15.4], [6, 6]], conA: [[-32.5, 16], [0.5, 16]], conB: [[-32.5, 25], [6, 25], [6, 20.6]], conCrown: [[-32.5, -3], [-22, -3], [-22, -12]],
  };
  {
    const parts = [];
    for (const k in W) parts.push(...stripParts(W[k], 0.55, 0, 0.07));
    for (const k in CON) { const c = CON[k]; parts.push(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 32).translate(c.x + 1.6, 0.05, c.z), new THREE.CylinderGeometry(0.6, 0.6, 1.0, 20).translate(c.x - 2.2, 0.5, c.z)); }
    mesh(logG, mergeGeos(parts), MAT.gold);
  }
  const wireY = 0.42;
  const WP = {};
  for (const k in W) WP[k] = polyPath(W[k].map(([x, z]) => [x, wireY, z]));
  // LEDs on the blocks
  const LED_KEYS = ['osc', 'div', 'drvA', 'cnt5', 'gate', 'drvB', 'latch'];
  const logLed = instanced(ledGeo(0.7), ledMat(), LED_KEYS.map(k => [LB[k].x + LB[k].w / 2 - 1.3, LH + 0.02, LB[k].z - LB[k].d / 2 + 1.3]), logG);
  const logHalo = LED_KEYS.map(k => sprite(0x78c3ff, logG, LB[k].x + LB[k].w / 2 - 1.3, LH + 0.6, LB[k].z - LB[k].d / 2 + 1.3));
  // gate top glows when open
  const gateTopMat = glowMat(); gateTopMat.color.set(0x78c3ff);
  const gateTop = mesh(logG, new THREE.BoxGeometry(LB.gate.w - 1.2, 0.08, LB.gate.d - 1.2), gateTopMat, LB.gate.x, LH + 0.05, LB.gate.z); gateTop.renderOrder = 6;
  // motors: coil + a two-pole rotor that turns half a turn per pulse
  const motor = {};
  for (const k of ['A', 'B']) {
    const m = MOT[k], cm = WX.mat('coil'); cm.map = coilTex;
    mesh(logG, new THREE.CylinderGeometry(1.7, 1.7, 6, 40, 1, true).rotateZ(Math.PI / 2), cm, m.x, 1.9, m.z);
    mesh(logG, new THREE.CylinderGeometry(0.7, 0.7, 7.2, 20).rotateZ(Math.PI / 2), WX.mat('softIron'), m.x, 1.9, m.z);
    for (const s of [-1, 1]) mesh(logG, new THREE.CylinderGeometry(2.0, 2.0, 0.24, 36).rotateZ(Math.PI / 2), MAT.plastic, m.x + s * 3.1, 1.9, m.z);
    const rot = new THREE.Group(); rot.position.set(m.x + 6.4, 0.9, m.z); logG.add(rot);
    const half = new THREE.CylinderGeometry(1.9, 1.9, 0.9, 40, 1, false, 0, Math.PI);
    mesh(rot, half, MAT.magN); mesh(rot, half, MAT.magS).rotation.y = Math.PI;
    mesh(rot, new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12), MAT.steel);
    motor[k] = { cm, rot };
  }
  // contacts: a spring blade over a gold pad; closes when its pusher / crown acts
  const contact = {};
  for (const k in CON) {
    const c = CON[k], piv = new THREE.Group(); piv.position.set(c.x - 2.2, 1.0, c.z); logG.add(piv);
    mesh(piv, new THREE.BoxGeometry(4.6, 0.22, 1.1).translate(2.3, 0, 0), MAT.nickel);
    contact[k] = { piv, flash: sprite(0x78c3ff, logG, c.x + 1.6, 0.6, c.z) };
  }
  const logPool = pool(40, 0.5, logG);
  const lm = { mot: {}, con: {}, blk: {} };
  for (const k in LB) lm.blk[k] = marker(logG, LB[k].x, LH, LB[k].z - LB[k].d / 2);
  for (const k of ['A', 'B']) lm.mot[k] = marker(logG, MOT[k].x + 3, 2.2, MOT[k].z + 3.3);
  for (const k in CON) lm.con[k] = marker(logG, CON[k].x - 3.4, 0.4, CON[k].z + 1.6);
  const logPlanCache = new Map();
  function logPlan(p, dur) {
    const pressAt = p.pressAt !== undefined ? p.pressAt : 0.3 * dur, stopAt = p.stopAt !== undefined ? p.stopAt : 0.75 * dur;
    const crownAt = typeof p.crownAt === 'number' ? p.crownAt : null, crownEnd = crownAt === null ? null : (p.crownEnd !== undefined ? p.crownEnd : crownAt + 0.25 * dur);
    const resetAt = typeof p.resetAt === 'number' ? p.resetAt : null, phase = p.tickPhase !== undefined ? p.tickPhase : 0.4;
    const key = JSON.stringify([pressAt, stopAt, crownAt, crownEnd, resetAt, phase, dur]);
    if (logPlanCache.has(key)) return logPlanCache.get(key);
    const end = dur + 2;
    const tA = [];   // time-motor pulses: once a second, none while the crown holds the divider in reset
    for (let t = phase; t < end; t += 1) { if (crownAt !== null && t >= crownAt && t < crownEnd) continue; if (crownAt !== null && t >= crownEnd) break; tA.push(t); }
    if (crownAt !== null) for (let t = crownEnd + 1; t < end; t += 1) tA.push(t);
    const tB = [];   // stopwatch pulses: 5 a second while running
    for (let j = 1; pressAt + 0.2 * j < Math.min(stopAt, end) - 1e-6; j++) tB.push(pressAt + 0.2 * j);
    const t5 = [];   // the 5-per-second counter's own ticks (always running)
    for (let j = Math.ceil(-pressAt / 0.2); pressAt + 0.2 * j < end; j++) if (pressAt + 0.2 * j >= -0.5) t5.push(pressAt + 0.2 * j);
    const pl = { pressAt, stopAt, crownAt, crownEnd, resetAt, tA, tB, t5 };
    logPlanCache.set(key, pl);
    return pl;
  }
  const lastBefore = (arr, u) => { let lo = -1; for (let i = 0; i < arr.length; i++) { if (arr[i] <= u) lo = i; else break; } return lo; };
  const press = t => (t < 0 ? 0 : smooth(t / 0.06) * (1 - smooth((t - 0.32) / 0.1)));
  function poseLogic(u, p, dur) {
    const pl = logPlan(p, dur);
    const running = u >= pl.pressAt && u < pl.stopAt;
    const age = (arr) => { const i = lastBefore(arr, u); return i < 0 ? 9 : u - arr[i]; };
    const flash = a => Math.exp(-a / 0.12);
    const crownIn = pl.crownAt !== null && u >= pl.crownAt && u < pl.crownEnd;
    const led = { osc: 0.75, div: flash(age(pl.tA)), drvA: flash(age(pl.tA) - 0.22 < 0 ? 9 : age(pl.tA) - 0.22), cnt5: flash(age(pl.t5)), gate: running ? 0.9 : 0.05, drvB: flash(age(pl.tB) - 0.1 < 0 ? 9 : age(pl.tB) - 0.1), latch: running ? 1 : 0 };
    if (crownIn) led.osc = 0.75;
    LED_KEYS.forEach((k, i) => { logLed.setColorAt(i, _c.copy(C_LED_OFF).lerp(C_LED_ON, led[k])); logHalo[i].userData.set(4.2, 0.85 * led[k]); });
    logLed.instanceColor.needsUpdate = true;
    LB.gate.mat.emissive.setRGB(0.02 * led.gate, 0.06 * led.gate, 0.15 * led.gate);
    gateTopMat.opacity = 0.12 + 0.6 * led.gate;
    // motors
    for (const k of ['A', 'B']) {
      const arr = k === 'A' ? pl.tA : pl.tB, i = lastBefore(arr, u), a = i < 0 ? 9 : u - arr[i] - (k === 'A' ? 0.42 : 0.2);
      const steps = i + 1 - (a < 0 ? 1 : 0), e = a >= 0 ? Math.exp(-a / 0.12) : 0;
      motor[k].cm.emissive.setRGB(0.03 * e, 0.12 * e, 0.32 * e);
      const sw = a >= 0 ? smooth(a / (k === 'A' ? 0.25 : 0.12)) : 1;
      motor[k].rot.rotation.y = -Math.PI * (Math.max(0, steps - 1) + (steps > 0 ? sw : 0));
    }
    // contacts
    const cA = Math.max(press(u - pl.pressAt), press(u - pl.stopAt));
    const cB = pl.resetAt !== null ? press(u - pl.resetAt) : 0;
    const cC = pl.crownAt !== null ? (u >= pl.crownAt && u < pl.crownEnd ? smooth((u - pl.crownAt) / 0.08) : 0) : 0;
    for (const [k, v] of [['A', cA], ['B', cB], ['crown', cC]]) { contact[k].piv.rotation.z = 0.2 * (1 - v); contact[k].flash.userData.set(6, v); }
    // pulses travelling along the wires
    logPool.begin();
    const send = (path, t0, T, col = C_PULSE) => { const a = u - t0; if (a >= 0 && a <= T) logPool.put(path.at(a / T, _v), 1, col, 1 - 0.3 * smooth((a / T - 0.8) / 0.2)); };
    for (let i = 0; i < 3; i++) logPool.put(WP.oscDiv.at(((u * 2.2 + i / 3) % 1), _v), 0.75, C_PULSE, 0.8);
    for (const t of pl.tA) { send(WP.divA, t, 0.22); send(WP.aMot, t + 0.22, 0.2); }
    for (const t of pl.t5) send(WP.divCnt, t - 0.2, 0.2), send(WP.cntGate, t, 0.1);
    for (const t of pl.tB) send(WP.gateB, t - 0.1, 0.1), send(WP.bMot, t, 0.2);
    for (const t of [pl.pressAt, pl.stopAt]) { send(WP.conA, t, 0.35); send(WP.latchGate, t + 0.35, 0.2); }
    if (pl.resetAt !== null) send(WP.conB, pl.resetAt, 0.4);
    if (pl.crownAt !== null) send(WP.conCrown, pl.crownAt, 0.35);
    logPool.end();
  }

  // ═══════════════════════════ 2D overlay ═══════════════════════════
  overlay.innerHTML = `<style>
    .stage-overlay[data-stage="chip"] .cp-mode { position:absolute; inset:0; display:none; }
    .stage-overlay[data-stage="chip"] .cp-l { position:absolute; left:0; top:0; white-space:nowrap; }
    .stage-overlay[data-stage="chip"] .cp-tag { font-size:12.5px; line-height:1.3; padding:3px 7px; border-radius:4px; background:rgba(9,12,16,0.8); border:1px solid rgba(205,218,232,0.14); }
    .stage-overlay[data-stage="chip"] .cp-tag small { display:block; font:11px 'IBM Plex Mono',monospace; color:#9aa3ad; }
    .stage-overlay[data-stage="chip"] .cp-dot { position:absolute; left:-3.5px; top:-3.5px; width:7px; height:7px; border-radius:50%; background:#e39a5c; box-shadow:0 0 0 3px rgba(227,154,92,0.22); }
    .stage-overlay[data-stage="chip"] .cp-mono { font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums; }
    .stage-overlay[data-stage="chip"] .cp-fq { font:500 12px 'IBM Plex Mono',monospace; color:#c9d0d8; text-align:center; }
    .stage-overlay[data-stage="chip"] .cp-bit { font:500 16px 'IBM Plex Mono',monospace; }
    .stage-overlay[data-stage="chip"] .cp-d2 { font:500 11px 'IBM Plex Mono',monospace; color:#e39a5c; }
    .stage-overlay[data-stage="chip"] .cp-note { font:11px 'IBM Plex Mono',monospace; color:#9aa3ad; letter-spacing:0.08em; text-transform:uppercase; }
    .stage-overlay[data-stage="chip"] .cp-hl { color:#e39a5c; }
    .stage-overlay[data-stage="chip"] .cp-pill { background:rgba(9,12,16,0.62); padding:3px 7px; border-radius:4px; }
  </style>
  <div class="cp-mode" data-m="board"></div><div class="cp-mode" data-m="divider"></div><div class="cp-mode" data-m="driver"></div><div class="cp-mode" data-m="stopwatch"></div>`;
  const modeEl = {}; overlay.querySelectorAll('.cp-mode').forEach(e => { modeEl[e.dataset.m] = e; });
  const pt = {};
  const proj = o => WX.project(o, pt);
  const el = (parent, cls, html, style = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; if (style) e.style.cssText = style; parent.appendChild(e); return e; };
  const place = (e, x, y, ax = 0.5, ay = 0.5) => { e.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(${-ax * 100}%,${-ay * 100}%)`; };
  const fade = (e, k) => { e.style.opacity = clamp(k).toFixed(3); e.style.visibility = k > 0.005 ? 'visible' : 'hidden'; };
  const keepY = y => Math.min(596, Math.max(78, y));
  // callout: dot on the anchor, leader to a tag
  function callout(parent, html, dx, dy) {
    const e = document.createElement('div'); e.className = 'cp-l';
    const box = dx >= 0 ? `left:${dx + 4}px` : `right:${-dx + 4}px`;
    e.innerHTML = `<svg width="1" height="1" style="position:absolute;left:0;top:0;overflow:visible"><line x1="0" y1="0" x2="${dx}" y2="${dy}" stroke="rgba(236,235,230,0.55)" stroke-width="1"/></svg><div class="cp-dot"></div><div class="cp-tag" style="position:absolute;${box};top:${dy}px;transform:translateY(-50%)">${html}</div>`;
    parent.appendChild(e);
    return e;
  }
  const at = (e, o) => { proj(o); e.style.transform = `translate(${pt.x.toFixed(1)}px,${keepY(pt.y).toFixed(1)}px)`; return pt; };

  // ── board overlay ──
  const OB = modeEl.board;
  const bCard = el(OB, 'ov-card', `<div class="ov-k">One C-MOS chip runs it all</div><div class="ov-big" style="margin-top:5px;white-space:nowrap">circuit block <span class="ov-accent">&lt; 0.70 µA</span></div><div class="ov-muted" style="font-size:12px;margin-top:5px;line-height:1.45">less than a millionth of an amp<br>Seiko spec, measured at 1.55 V</div>`, 'left:auto;right:28px;top:372px;width:330px');
  const bNote = el(OB, 'cp-l cp-note cp-pill', 'Board and die layout illustrative · not to scale', 'left:auto;right:28px;top:576px;transform:none');
  const bLab = {
    ic: callout(OB, 'C-MOS IC (package)', 70, -70), crystal: callout(OB, 'Quartz crystal<small>32,768 Hz</small>', -50, -74), die: callout(OB, 'Silicon die<small>bond wires to the board</small>', 80, -84),
    coilA: callout(OB, 'to motor A', -30, 36), coilB: callout(OB, 'to motor B', 34, -34), battery: callout(OB, 'battery', 40, 30),
    contacts: callout(OB, 'pusher contacts', 40, -36), crown: callout(OB, 'crown contact', -40, -36),
  };
  const dLab = {
    b_osc: callout(OB, 'Oscillator', -60, -60), b_div: callout(OB, 'Divider<small>15 identical flip-flops</small>', 70, -70), b_logic: callout(OB, 'Stopwatch logic', -30, 150),
    b_drvA: callout(OB, 'Motor driver A', -70, 50), b_drvB: callout(OB, 'Motor driver B', 70, 60),
  };
  function overlayBoard(u, p, dur) {
    const rv = boardReveal(u, p, dur), labels = p.labels !== false;
    proj(bm.die0); const x0 = pt.x, y0 = pt.y; proj(bm.die1);
    const dieSize = Math.hypot(pt.x - x0, pt.y - y0);
    const close = smooth((dieSize - 260) / 140), far = 1 - smooth((dieSize - 120) / 90);
    fade(bLab.ic, labels ? (1 - smooth(rv / 0.35)) * far : 0); at(bLab.ic, WX.anchors['chip:ic']);
    fade(bLab.crystal, labels ? far : 0); at(bLab.crystal, WX.anchors['chip:crystal']);
    fade(bLab.die, labels ? smooth((rv - 0.6) / 0.3) * (1 - close) : 0); at(bLab.die, WX.anchors['chip:die']);
    for (const k of ['coilA', 'coilB', 'battery', 'contacts', 'crown']) { fade(bLab[k], labels ? 0.85 * far : 0); at(bLab[k], bm[k]); }
    for (const k in dLab) { fade(dLab[k], labels ? close * smooth((rv - 0.75) / 0.2) : 0); at(dLab[k], bm[k]); }
    fade(bCard, 1 - close);
    fade(bNote, 1);
  }

  // ── divider overlay ──
  const OD = modeEl.divider;
  const dCard = el(OD, 'ov-card', `<div class="ov-k">Frequency divider · binary counter</div>
    <div class="ov-eq" style="margin-top:4px">pulses counted <span class="cp-cnt ov-big" style="font-size:20px">0</span> <span class="ov-muted">of 32,768</span></div>
    <div class="cp-slow ov-muted cp-mono" style="font-size:12px;margin-top:3px"></div>
    <div class="cp-tick ov-accent cp-mono" style="font-size:13px;margin-top:5px">32,768 pulses in → 1 pulse out = 1 second</div>`, 'left:50%;top:78px;transform:translateX(-50%);min-width:420px;text-align:center');
  const dCnt = dCard.querySelector('.cp-cnt'), dSlow = dCard.querySelector('.cp-slow'), dTick = dCard.querySelector('.cp-tick');
  const dFq = [], dBit = [], dD2 = [];
  const FQ = k => fmt(FULL / Math.pow(2, k));
  for (let k = 0; k <= 15; k++) {
    dFq.push(el(OD, 'cp-l cp-fq', k === 0 ? '32,768<br><span class="ov-muted" style="font-size:10.5px">Hz in</span>' : k === 15 ? '<span class="cp-hl" style="font-size:14px">1 Hz</span><br><span class="ov-muted" style="font-size:10.5px">out</span>' : FQ(k)));
    dBit.push(k ? el(OD, 'cp-l cp-bit', '0') : el(OD, 'cp-l cp-note', 'oscillator'));
    dD2.push(k ? el(OD, 'cp-l cp-d2', '÷2') : null);
  }
  const dLsb = el(OD, 'cp-l cp-note', 'bit 1 · LSB'), dMsb = el(OD, 'cp-l cp-note', 'bit 15 · MSB');
  const dBits = el(OD, 'cp-l cp-note', 'LEDs = the count in binary (lowest bit first)');
  const dHz = el(OD, 'cp-l cp-note', 'Hz');
  const dOut = el(OD, 'cp-l', '<div class="cp-tag" style="border-color:rgba(227,154,92,0.5)"><span class="cp-hl">1 pulse per second</span><small>to the motor driver</small></div>');
  const dNote = el(OD, 'cp-l cp-note', 'Not to scale · carry delay exaggerated', 'left:auto;right:28px;top:578px;transform:none');
  const tW = 380, tH = 46, TWIN = 3.0;
  const dTrim = el(OD, 'ov-card', `<div class="ov-k">Rate trim · pulses into the divider</div><svg width="${tW}" height="${tH}" style="position:relative;display:block;margin-top:6px"></svg>
    <div class="ov-muted" style="font-size:12px;margin-top:3px">every few seconds the chip deletes a few input pulses <span class="cp-hl">(✕)</span></div>`, 'left:40px;top:470px;');
  const dTrimSvg = dTrim.querySelector('svg');
  const dGate = callout(OD, 'rate trim', -24, -46);
  function trimStrip(pl, u) {
    const base = tH - 10, amp = 26, ncol = Math.round(tW / 1.5);
    let s = `<line x1="0" y1="${base}" x2="${tW}" y2="${base}" stroke="rgba(205,218,232,0.28)" stroke-width="1"/>`;
    let prev = Math.floor(pl.nRaw(u - TWIN)), dense = '';
    for (let i = 1; i <= ncol; i++) {
      const t = u - TWIN * (1 - i / ncol), c = Math.floor(pl.nRaw(t)), x = (i / ncol) * tW;
      if (c - prev > 1) dense += `<rect x="${(x - 1.5).toFixed(1)}" y="${base - amp}" width="1.6" height="${amp}" style="fill:#78c3ff" opacity="0.5"/>`;
      else if (c > prev) {
        if (pl.isDel(c)) s += `<line x1="${x.toFixed(1)}" y1="${base}" x2="${x.toFixed(1)}" y2="${base - amp}" stroke="#9aa3ad" stroke-width="1.2" stroke-dasharray="3 2"/><path d="M${(x - 6).toFixed(1)},${base - amp - 4 - 6} l12,12 M${(x + 6).toFixed(1)},${base - amp - 4 - 6} l-12,12" stroke="#e39a5c" stroke-width="2"/>`;
        else s += `<line x1="${x.toFixed(1)}" y1="${base}" x2="${x.toFixed(1)}" y2="${base - amp}" stroke="#78c3ff" stroke-width="2"/>`;
      }
      prev = c;
    }
    s += dense + `<line x1="${tW}" y1="2" x2="${tW}" y2="${tH}" stroke="#e39a5c" stroke-width="1.2"/>`;
    dTrimSvg.innerHTML = s;
  }
  function overlayDivider(u, p, dur) {
    const pl = divPlan(p, dur), s = divState(pl, u);
    for (let k = 0; k <= 15; k++) {
      proj(dm.freq[k]); place(dFq[k], pt.x, pt.y + 4, 0.5, 0);
      proj(dm.bit[k]); place(dBit[k], pt.x, pt.y, 0.5, 1);
      if (k) {
        const v = lerp(s.Q[k], 0.5, s.blur[k]);
        dBit[k].textContent = s.Q[k] ? '1' : '0';
        dBit[k].style.color = s.Q[k] ? '#9ad6ff' : '#69737e';
        dBit[k].style.opacity = (1 - 0.55 * s.blur[k]).toFixed(2);
        proj(dm.d2[k]); place(dD2[k], pt.x, pt.y, 0.5, 0.5);
        void v;
      }
    }
    proj(dm.bit[1]); place(dLsb, pt.x, pt.y - 22, 0.5, 1);
    proj(dm.bit[15]); place(dMsb, pt.x, pt.y - 22, 0.5, 1);
    proj(dm.bit[8]); place(dBits, pt.x, pt.y - 22, 0.5, 1);
    proj(dm.freq[0]); place(dHz, pt.x - 34, pt.y + 4, 1, 0); dHz.style.display = 'none';
    // count, slow-motion factor, the one-second tick
    dCnt.textContent = fmt(s.count);
    const f = FULL / s.rate;
    dSlow.innerHTML = `slowed down · real input 32,768 Hz · now shown <span class="ov-pulse">${f >= 10 ? fmt(f) : f.toFixed(1)}× slower</span>`;
    const outAge = s.tOut !== null ? u - s.tOut : -1;
    const tk = outAge >= -0.7 ? smooth((outAge + 0.7) / 0.3) : 0;
    dTick.style.opacity = tk.toFixed(3);
    proj(dm.out); place(dOut, pt.x + 4, pt.y + 62, 1, 0);
    fade(dOut, s.tOut !== null ? 0.5 + 0.5 * smooth((outAge + 0.2) / 0.3) * (1 - 0.5 * smooth((outAge - 3.5) / 1)) : 0.5);
    dOut.querySelector('.cp-tag').style.boxShadow = outAge >= 0 ? `0 0 ${(24 * Math.exp(-outAge / 0.8)).toFixed(1)}px rgba(227,154,92,0.7)` : 'none';
    // trim strip
    const tOn = pl.trimOn && pl.trims.length;
    const tk2 = tOn ? smooth((u - (pl.trims[0].t - 2.5)) / 0.6) : 0;
    fade(dTrim, tk2); if (tk2 > 0.005) trimStrip(pl, u);
    fade(dGate, tk2); at(dGate, dm.gate);
    fade(dNote, 1);
  }

  // ── driver overlay ──
  const OV = modeEl.driver;
  const SC = { W: 330, H: 120, x0: 22, x1: 322, base: 58, amp: 32, win: 4.2 };
  const vScope = el(OV, 'ov-card', `<div class="ov-k">Coil current · motor A</div><svg width="${SC.W}" height="${SC.H}" style="position:relative;display:block;margin-top:6px"></svg>
    <div style="font-size:12.5px;margin-top:2px">each pulse lasts <span class="ov-pulse">a few milliseconds</span></div>
    <div class="ov-muted" style="font-size:12px;margin-top:2px">and its direction reverses every time</div>`, 'left:auto;right:28px;top:292px;');
  const vSvg = vScope.querySelector('svg');
  const vNote = el(OV, 'cp-l cp-note', '3D view: each pulse stretched to be visible', 'left:auto;right:28px;top:578px;transform:none');
  const vLab = {
    bat: callout(OV, 'Battery<small>1.55 V</small>', -40, 46), plus: callout(OV, '+1.55 V', 0, -26), zero: callout(OV, '0 V', 0, 26),
    coil: callout(OV, 'Motor A coil', 0, -58),
  };
  const vSw = vm.sw.map(() => el(OV, 'cp-l cp-tag cp-mono', 'off', 'font-size:11.5px;padding:2px 6px'));
  const vPole = [el(OV, 'cp-l cp-mono', 'S', 'font-size:18px;font-weight:600'), el(OV, 'cp-l cp-mono', 'N', 'font-size:18px;font-weight:600')];
  const vArrow = el(OV, 'cp-l cp-mono ov-pulse', '', 'font-size:14px');
  function overlayDriver(u, p) {
    const pl = drvPlan(p), s = drvAt(pl, u), e = s.env;
    // scope: scrolling window, spikes about as narrow as the real pulses
    const X = t => SC.x1 - (SC.x1 - SC.x0) * (u - t) / SC.win;
    let h = `<line x1="${SC.x0}" y1="${SC.base}" x2="${SC.x1}" y2="${SC.base}" stroke="rgba(205,218,232,0.28)" stroke-width="1"/>`;
    h += `<text x="4" y="${SC.base - SC.amp + 9}" font-size="13" style="fill:#9aa3ad">+</text><text x="4" y="${SC.base + SC.amp + 2}" font-size="13" style="fill:#9aa3ad">−</text><text x="5" y="${SC.base + 4}" font-size="10" style="fill:#6f7882">0</text>`;
    const iMax = Math.floor((u - pl.t0) / pl.period), shown = [];
    for (let i = iMax; i >= 0; i--) {
      const t = pl.t0 + i * pl.period; if (u - t > SC.win) break;
      const x = X(t), pol = i % 2 ? -1 : 1, hot = u - t < pl.pw + 0.1;
      h += `<rect x="${(x - 1.2).toFixed(1)}" y="${pol > 0 ? SC.base - SC.amp : SC.base}" width="2.4" height="${SC.amp}" style="fill:#78c3ff" opacity="${hot ? 1 : 0.7}"/>`;
      h += `<text x="${(x + 6).toFixed(1)}" y="${pol > 0 ? SC.base - SC.amp + 10 : SC.base + SC.amp - 2}" font-size="12" style="fill:#78c3ff">${pol > 0 ? '+' : '−'}</text>`;
      shown.push(x);
    }
    if (shown.length >= 2) {
      const xa = shown[1], xb = shown[0], y = SC.base + SC.amp + 14;
      h += `<path d="M${xa.toFixed(1)},${y - 4} v8 M${xa.toFixed(1)},${y} H${xb.toFixed(1)} M${xb.toFixed(1)},${y - 4} v8" stroke="#e39a5c" stroke-width="1.2" fill="none"/>`;
      h += `<text x="${((xa + xb) / 2).toFixed(1)}" y="${y + 15}" font-size="12" text-anchor="middle" style="fill:#e39a5c">1 s</text>`;
    }
    h += `<line x1="${SC.x1}" y1="4" x2="${SC.x1}" y2="${SC.H - 22}" stroke="#e39a5c" stroke-width="1.2"/><text x="${SC.x1}" y="${SC.H - 2}" font-size="10" text-anchor="end" style="fill:#6f7882">now</text>`;
    vSvg.innerHTML = h;
    // labels on the bridge
    for (const k in vLab) at(vLab[k], vm[k]);
    const on = [s.pol > 0, s.pol < 0, s.pol < 0, s.pol > 0];
    vm.sw.forEach((m, j) => {
      proj(m); place(vSw[j], pt.x + 6, pt.y, 0, 0.5);
      const k = on[j] ? e : 0;
      vSw[j].textContent = k > 0.5 ? 'on' : 'off';
      vSw[j].style.color = k > 0.5 ? '#78c3ff' : '#8a939d';
      vSw[j].style.borderColor = k > 0.5 ? 'rgba(120,195,255,0.6)' : 'rgba(205,218,232,0.14)';
    });
    // poles at the coil ends and the current direction
    const n = s.pol > 0 ? ['S', 'N'] : ['N', 'S'];
    [vm.endL, vm.endR].forEach((m, j) => {
      proj(m); place(vPole[j], pt.x + (j ? 20 : -20), pt.y, 0.5, 0.5);
      vPole[j].textContent = n[j]; vPole[j].style.color = n[j] === 'N' ? '#ff7a6c' : '#7fa8ff'; fade(vPole[j], e);
    });
    proj(vm.coil); place(vArrow, pt.x, pt.y - 92, 0.5, 0.5);
    vArrow.textContent = s.pol > 0 ? 'current  →' : '←  current';
    fade(vArrow, e);
    fade(vNote, 1);
  }

  // ── stopwatch (logic) overlay ──
  const OL = modeEl.stopwatch;
  const LTXT = {
    osc: 'Oscillator<small>32,768 Hz</small>', div: 'Divider<small>÷ 32,768</small>', drvA: 'Driver A', cnt5: 'Counter<small>5 per second</small>',
    gate: 'Gate', drvB: 'Driver B', latch: 'Start / stop memory',
  };
  const lBlk = {};
  for (const k in LTXT) lBlk[k] = el(OL, 'cp-l cp-tag', LTXT[k]);
  const lCon = {
    A: el(OL, 'cp-l cp-tag', 'Pusher A<small>start / stop</small>'), B: el(OL, 'cp-l cp-tag', 'Pusher B<small>reset</small>'),
    crown: el(OL, 'cp-l cp-tag', 'Crown, 2nd click<small>stop seconds</small>'),
  };
  const STW = 200, STH = 30, SWIN = 3.0;
  const lMot = {
    A: el(OL, 'cp-l cp-tag', `Time motor · <span class="ov-pulse">1 pulse/s</span><svg width="${STW}" height="${STH}" style="position:relative;display:block;margin-top:4px"></svg><small class="cp-st">always running</small>`),
    B: el(OL, 'cp-l cp-tag', `Stopwatch motor · <span class="ov-pulse">5 pulses/s</span><svg width="${STW}" height="${STH}" style="position:relative;display:block;margin-top:4px"></svg><small class="cp-st"></small>`),
  };
  const lNote = el(OL, 'cp-l cp-note', 'Pulse rates at real speed · diagram simplified', 'left:auto;right:28px;top:578px;transform:none');
  function strip(svg, arr, u, firstPol) {
    const base = STH / 2, amp = 11;
    let s = `<line x1="0" y1="${base}" x2="${STW}" y2="${base}" stroke="rgba(205,218,232,0.25)" stroke-width="1"/>`;
    const i0 = lastBefore(arr, u);
    for (let i = i0; i >= 0; i--) {
      const age = u - arr[i]; if (age > SWIN) break;
      const x = STW * (1 - age / SWIN) - 3, pol = (i + firstPol) % 2 ? -1 : 1;
      s += `<rect x="${x.toFixed(1)}" y="${pol > 0 ? base - amp : base}" width="3" height="${amp}" style="fill:#78c3ff" opacity="${age < 0.15 ? 1 : 0.6}"/>`;
    }
    s += `<line x1="${STW}" y1="1" x2="${STW}" y2="${STH - 1}" stroke="#e39a5c" stroke-width="1.2"/>`;
    svg.innerHTML = s;
  }
  function overlayLogic(u, p, dur) {
    const pl = logPlan(p, dur);
    for (const k in lBlk) { proj(lm.blk[k]); place(lBlk[k], pt.x, keepY(pt.y - 8), 0.5, 1); }
    for (const k in lCon) { proj(lm.con[k]); place(lCon[k], pt.x, keepY(pt.y + 8), 0, 0); }
    for (const k of ['A', 'B']) { proj(lm.mot[k]); place(lMot[k], pt.x, keepY(pt.y + 10), 0.5, 0); }
    strip(lMot.A.querySelector('svg'), pl.tA, u, 0);
    strip(lMot.B.querySelector('svg'), pl.tB, u, 0);
    const running = u >= pl.pressAt && u < pl.stopAt;
    const steps = lastBefore(pl.tB, u) + 1;
    const reset = pl.resetAt !== null && u >= pl.resetAt && u >= pl.stopAt;
    const el2 = (reset ? 0 : steps) * 0.2;
    lMot.B.querySelector('.cp-st').innerHTML = (running ? '<span class="ov-pulse">running</span>' : u < pl.pressAt ? 'waiting for pusher A' : 'stopped') + ` · ${el2.toFixed(1)} s on the stopwatch`;
    const crownIn = pl.crownAt !== null && u >= pl.crownAt && u < pl.crownEnd;
    lMot.A.querySelector('.cp-st').innerHTML = crownIn ? '<span class="cp-hl">held: crown pulled out</span>' : 'always running';
    lBlk.latch.innerHTML = `Start / stop memory<small>${running ? '<span class="ov-pulse">RUN</span>' : 'STOP'}</small>`;
    for (const [k, t] of [['A', [pl.pressAt, pl.stopAt]], ['B', [pl.resetAt]], ['crown', [pl.crownAt]]]) {
      const hot = t.some(x => x !== null && u >= x && u < x + 0.6);
      lCon[k].style.borderColor = hot ? 'rgba(120,195,255,0.8)' : 'rgba(205,218,232,0.14)';
      lCon[k].style.boxShadow = hot ? '0 0 14px rgba(120,195,255,0.45)' : 'none';
    }
    fade(lNote, 1);
  }

  // ═══════════════════════════ shared timing / API ═══════════════════════════
  function boardReveal(u, p, dur) { return p.reveal !== undefined ? clamp(p.reveal) : ease((u - 0.3 * dur) / (0.4 * dur)); }
  function poseBoard(u, p, dur) {
    const rv = boardReveal(u, p, dur);
    const lift = ease(rv);
    pkg.position.set(IC_X - 0.6 * lift, PKH / 2 + 7.5 * lift, IC_Z - 1.0 * lift);
    pkg.rotation.set(-0.35 * lift, 0, 0.12 * lift);
    const op = 1 - smooth((rv - 0.25) / 0.6);
    for (const m of [pkgTop, pkgSide]) { m.opacity = op; m.transparent = op < 0.999; m.depthWrite = op > 0.5; }
    pkg.visible = op > 0.01;
    dieTop.emissiveIntensity = 0.22 + 0.12 * smooth((rv - 0.5) / 0.4);
  }

  return {
    cameras: {
      board: { t: [0.6, 0, 0.6], yaw: 0.32, pitch: 0.82, dist: 46 },
      die: { t: [IC_X, 0.2, IC_Z + 0.1], yaw: 0.22, pitch: 1.0, dist: 9.5 },
      divider: { t: [-1.5, 0, -258.6], yaw: 0, pitch: 0.55, dist: 126 },
      driver: { t: [244, 0, -259], yaw: 0, pitch: 0.95, dist: 84 },
      logic: { t: [-237, 0, -258], yaw: 0, pitch: 0.92, dist: 121 },
    },
    update(u, p, T, dur) {
      const mode = p.mode || 'board';
      boardG.visible = mode === 'board'; divG.visible = mode === 'divider'; drvG.visible = mode === 'driver'; logG.visible = mode === 'stopwatch';
      if (mode === 'board') poseBoard(u, p, dur);
      else if (mode === 'divider') poseDivider(u, p, dur);
      else if (mode === 'driver') poseDriver(u, p, dur);
      else if (mode === 'stopwatch') poseLogic(u, p, dur);
    },
    overlay(u, p, T, dur) {
      const mode = p.mode || 'board';
      for (const k in modeEl) modeEl[k].style.display = k === mode ? 'block' : 'none';
      if (mode === 'board') overlayBoard(u, p, dur);
      else if (mode === 'divider') overlayDivider(u, p, dur);
      else if (mode === 'driver') overlayDriver(u, p, dur);
      else if (mode === 'stopwatch') overlayLogic(u, p, dur);
    },
  };
});
