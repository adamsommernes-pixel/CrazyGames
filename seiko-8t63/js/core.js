// Shared 3D core: renderer, lighting, palette materials, geometry helpers, gear builder,
// canvas textures, label anchors and the registry for close-up "stages".
// Everything hangs off window.WX so the watch model, the stages and the director can share it.
(function () {
'use strict';
const WX = (window.WX = window.WX || {});

// ── maths ──
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const ease = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const easeIn = t => { t = clamp(t); return t * t * t; };
const deg = d => d * Math.PI / 180;
const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
// window(u, a, b, fadeIn, fadeOut): 0 outside [a, b], ramps up/down at the edges
const win = (u, a, b, fi = 0.4, fo = 0.4) => smooth((u - a) / fi) * (1 - smooth((u - (b - fo)) / fo));
Object.assign(WX, { TAU, clamp, lerp, smooth, ease, easeOut, easeIn, deg, wrapPi, win });

// ── renderer ──
WX.init = function (canvas, opts = {}) {
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.capture, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.physicallyCorrectLights = true;
  WX.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 6000);
  // studio environment: dark room with soft boxes, prefiltered for reflections
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x1a1e24, side: THREE.BackSide })));
  const panel = (w, h, pos, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(11, 3.2, [0, 10, 4], 0xffffff, 5.0);
  panel(3, 9, [-10.5, 1, 3], 0xdfe9ff, 3.0);
  panel(3, 9, [10.5, 0, -2], 0xffecd9, 2.4);
  panel(9, 1.8, [0, -7, 9], 0xffffff, 1.5);
  panel(7, 7, [0, 2, -11], 0x8a98ad, 0.7);
  panel(4, 2, [7, -8, 6], 0xffffff, 1.2);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  const key = new THREE.DirectionalLight(0xfff1e3, 2.2); key.position.set(40, 70, 90); scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1); rim.position.set(-70, -30, -50); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x101215, 0.35));
  Object.assign(WX, { renderer, scene, camera, keyLight: key, rimLight: rim });
  return WX;
};

// ── canvas textures ──
WX.PLEX = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
WX.MICRO = 'Michroma, "Eurostile", "Arial Black", sans-serif';
WX.MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
WX.textures = [];
WX.canvasTex = function (w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  if (!opts.linear) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = WX.maxAniso || 8;
  t.userData.redraw = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); draw(ctx, w, h); t.needsUpdate = true; };
  t.userData.redraw();
  WX.textures.push(t);
  return t;
};
// mm-space painter for a square canvas covering [-R, R]²
WX.painter = function (ctx, N, R) {
  const s = N / (2 * R), c = N / 2;
  return {
    s,
    mm() { ctx.setTransform(s, 0, 0, -s, c, c); },
    px() { ctx.setTransform(1, 0, 0, 1, 0, 0); },
    text(str, x, y, size, o = {}) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(c + x * s, c - y * s); if (o.rot) ctx.rotate(-o.rot);
      ctx.font = `${o.weight || 500} ${size * s}px ${o.family || WX.PLEX}`;
      ctx.fillStyle = o.color || '#e9e9e4'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
      if (o.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = (o.spacing * s) + 'px';
      ctx.fillText(str, 0, 0); ctx.restore();
    },
    circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); },
  };
};
// a flat text label living in 3D (e.g. "N" on a magnet, a tooth count on a wheel)
WX.textPlane = function (text, opts = {}) {
  const size = opts.size || 1, color = opts.color || '#ecebe6', font = opts.font || WX.PLEX, weight = opts.weight || 600;
  const pxH = 128, padX = 24;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `${weight} ${pxH * 0.72}px ${font}`;
  const wpx = Math.ceil(meas.measureText(text).width + padX * 2);
  const tex = WX.canvasTex(wpx, pxH, ctx => {
    if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, wpx, pxH); }
    ctx.font = `${weight} ${pxH * 0.72}px ${font}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, wpx / 2, pxH / 2 + 4);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * wpx / pxH, size), mat);
  m.renderOrder = opts.renderOrder || 5;
  return m;
};

// ── palette materials (new instance per call; callers may cache) ──
WX.TEX = WX.TEX || {};
WX.TEX.coil = WX.canvasTex(64, 256, (ctx, w, h) => {
  ctx.fillStyle = '#b86a38'; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { ctx.fillStyle = 'rgba(255,214,170,0.35)'; ctx.fillRect(0, y, w, 1.4); ctx.fillStyle = 'rgba(60,24,6,0.45)'; ctx.fillRect(0, y + 2.6, w, 1.2); }
});
WX.TEX.coil.wrapS = WX.TEX.coil.wrapT = THREE.RepeatWrapping; WX.TEX.coil.repeat.set(1, 5);
const S = o => new THREE.MeshStandardMaterial(o);
WX.MATS = {
  steel: () => S({ color: 0xe3e7eb, metalness: 1, roughness: 0.15 }),
  brushed: () => S({ color: 0xc7cdd4, metalness: 1, roughness: 0.34 }),
  dark: () => S({ color: 0x17191c, metalness: 0.5, roughness: 0.4 }),
  brass: () => S({ color: 0xf2cf86, metalness: 1, roughness: 0.3 }),
  nickel: () => S({ color: 0xe9eef3, metalness: 0.85, roughness: 0.34 }),
  blued: () => S({ color: 0x4f78c8, metalness: 0.85, roughness: 0.28 }),
  plate: () => S({ color: 0x2c3138, metalness: 0.3, roughness: 0.66, envMapIntensity: 0.6 }),
  pin: () => S({ color: 0xbfc5cb, metalness: 1, roughness: 0.22 }),
  stator: () => S({ color: 0x8e959c, metalness: 0.9, roughness: 0.36, emissive: 0x000000 }),
  softIron: () => S({ color: 0x9aa2aa, metalness: 0.75, roughness: 0.45, emissive: 0x000000 }),
  coil: () => S({ color: 0xffffff, map: WX.TEX.coil, metalness: 0.9, roughness: 0.32, emissive: 0x000000 }),
  copper: () => S({ color: 0xd08348, metalness: 1, roughness: 0.3, emissive: 0x000000 }),
  magN: () => S({ color: 0xc4473d, metalness: 0.3, roughness: 0.45 }),
  magS: () => S({ color: 0x3d6fc4, metalness: 0.3, roughness: 0.45 }),
  chip: () => S({ color: 0x15171a, metalness: 0.2, roughness: 0.38, emissive: 0x000000 }),
  silicon: () => S({ color: 0x3a4152, metalness: 0.6, roughness: 0.25, emissive: 0x000000 }),
  gold: () => S({ color: 0xe6c06a, metalness: 1, roughness: 0.26, emissive: 0x000000 }),
  battery: () => S({ color: 0xdfe3e7, metalness: 1, roughness: 0.18 }),
  zinc: () => S({ color: 0x9da4ab, metalness: 0.4, roughness: 0.75 }),
  silverOxide: () => S({ color: 0x2b2a2a, metalness: 0.1, roughness: 0.85 }),
  separator: () => S({ color: 0xe8e4d8, metalness: 0, roughness: 0.9 }),
  plastic: () => S({ color: 0x23262b, metalness: 0, roughness: 0.6 }),
  ruby: () => new THREE.MeshPhysicalMaterial({ color: 0xc0283c, metalness: 0, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 }),
  quartz: () => new THREE.MeshPhysicalMaterial({ color: 0xe8f0f4, metalness: 0, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.88 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xf4f8ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.13, clearcoat: 1, clearcoatRoughness: 0.04, depthWrite: false, envMapIntensity: 1.6 }),
  ghost: () => new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.3, roughness: 0.5, transparent: true, opacity: 0.18, depthWrite: false }),
  glow: () => new THREE.MeshBasicMaterial({ color: 0x78c3ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  glowWarm: () => new THREE.MeshBasicMaterial({ color: 0xe39a5c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  flat: () => new THREE.MeshBasicMaterial({ color: 0xecebe6, toneMapped: false }),
  line: () => new THREE.LineBasicMaterial({ color: 0xecebe6, transparent: true, opacity: 0.85 }),
  leader: () => new THREE.LineDashedMaterial({ color: 0xe39a5c, dashSize: 0.9, gapSize: 0.6, transparent: true }),
};
WX.mat = (kind, extra) => { const m = WX.MATS[kind](); if (extra) Object.assign(m, extra); return m; };
// semantic colours shared with the page CSS
WX.COL = { copper: 0xe39a5c, pulse: 0x78c3ff, text: 0xecebe6, muted: 0x9aa3ad, north: 0xc4473d, south: 0x3d6fc4, brass: 0xf2cf86 };

// ── geometry ──
WX.cylGeo = (r, z0, z1, seg = 28) => { const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg); g.rotateX(Math.PI / 2); g.translate(0, 0, (z0 + z1) / 2); return g; };
WX.cylY = (r, y0, y1, seg = 32) => { const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg); g.translate(0, (y0 + y1) / 2, 0); return g; };
WX.ringShape = (rIn, rOut) => { const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, TAU, false); const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, TAU, true); s.holes.push(h); return s; };
WX.extrude = (shape, z0, z1, curve = 48, bevel = 0) => {
  const depth = Math.max(0.001, z1 - z0 - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  g.translate(0, 0, z0 + bevel); return g;
};
WX.polyShape = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
// polyline with width w (mitred joins) as a Shape
WX.barShape = (pts, w) => {
  const left = [], right = [], n = pts.length;
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
    left.push([pts[i][0] + nx * w / 2 * k, pts[i][1] + ny * w / 2 * k]);
    right.push([pts[i][0] - nx * w / 2 * k, pts[i][1] - ny * w / 2 * k]);
  }
  return WX.polyShape(left.concat(right.reverse()));
};
WX.roundRect = (w, h, r) => {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
};
// heart cam outline: radius grows linearly from rmin (notch, local +Y) to rmax (point, local -Y)
WX.heartShape = (rmin, rmax, hole = 0.14, n = 96) => {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const phi = -Math.PI + TAU * i / n, r = rmin + (rmax - rmin) * Math.abs(phi) / Math.PI;
    const x = -r * Math.sin(phi), y = r * Math.cos(phi);
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  if (hole) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); s.holes.push(h); }
  return s;
};
WX.polar = (c, d, aDeg) => [c[0] + d * Math.cos(deg(aDeg)), c[1] + d * Math.sin(deg(aDeg))];
WX.inter = (c1, r1, c2, r2, pick) => {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d;
  const p1 = [mx - h * dy / d, my + h * dx / d], p2 = [mx + h * dy / d, my - h * dx / d];
  return pick(p1) ? p1 : p2;
};
WX.lineGeo = pts => new THREE.BufferGeometry().setFromPoints(pts.map(p => p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2] || 0)));
WX.tubeGeo = (pts, r = 0.05, seg = 64, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2] || 0)), closed), seg, r, 8, closed);
// beads that travel along a curve (current flow, magnetic flux): update(phase) moves them
WX.beads = function (points, n, opts = {}) {
  const curve = points.isCurve ? points : new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2] || 0)), !!opts.closed);
  const g = new THREE.Group();
  const mat = opts.material || WX.mat(opts.warm ? 'glowWarm' : 'glow');
  if (opts.color) mat.color.set(opts.color);
  const geo = new THREE.SphereGeometry(opts.size || 0.15, 10, 6);
  const items = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); g.add(m); items.push(m); }
  g.userData.update = (phase, dir = 1) => {
    for (let i = 0; i < n; i++) {
      let u = ((i / n + phase * dir) % 1 + 1) % 1;
      items[i].position.copy(curve.getPointAt(u));
    }
  };
  g.userData.update(0);
  g.userData.material = mat; g.userData.curve = curve;
  return g;
};

// ── gears (module 0.12 mm by default, as in the watch) ──
WX.MOD = 0.12;
WX.pr = (z, mod = WX.MOD) => mod * z / 2;
const gearCache = {};
// teeth: tooth tips centred at (i + 0.40) * 2π/z, gaps at (i + 0.90) * 2π/z
WX.gearGeo = function (z, thick, spokes = 0, mod = WX.MOD) {
  const key = `${z}|${thick}|${spokes}|${mod}`;
  if (gearCache[key]) return gearCache[key];
  const r = mod * z / 2, ra = r + mod * 0.9, rf = r - mod * 1.15, st = TAU / z, s = new THREE.Shape();
  const P = (rad, a) => [rad * Math.cos(a), rad * Math.sin(a)];
  for (let i = 0; i < z; i++) {
    const a = i * st;
    const pts = [P(rf, a), P(rf, a + st * 0.14), P(ra, a + st * 0.31), P(ra, a + st * 0.49), P(rf, a + st * 0.66)];
    pts.forEach((p, j) => (i === 0 && j === 0) ? s.moveTo(p[0], p[1]) : s.lineTo(p[0], p[1]));
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, Math.min(0.11 * mod / WX.MOD, rf * 0.3), 0, TAU, true); s.holes.push(hole);
  if (spokes && rf > 1.4 * mod / WX.MOD) {
    const k = mod / WX.MOD;
    const rim = Math.max(0.3 * k, rf * 0.13), rin = Math.max(0.5 * k, rf * 0.27), rout = rf - rim, sw = 0.34 * k;
    for (let q = 0; q < spokes; q++) {
      const a0 = q * TAU / spokes + 0.3, a1 = a0 + TAU / spokes;
      const wi = (sw / 2) / rin, wo = (sw / 2) / rout;
      const p = new THREE.Path();
      p.moveTo(rout * Math.cos(a0 + wo), rout * Math.sin(a0 + wo));
      p.absarc(0, 0, rout, a0 + wo, a1 - wo, false);
      p.lineTo(rin * Math.cos(a1 - wi), rin * Math.sin(a1 - wi));
      p.absarc(0, 0, rin, a1 - wi, a0 + wi, true);
      p.closePath(); s.holes.push(p);
    }
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -thick / 2);
  return (gearCache[key] = g);
};
// visual meshing: driven angle = -driver angle * z1/z2 + phase, so teeth interleave on the line of centres
WX.meshPhase = (ax, ay, z1, bx, by, z2) => { const beta = Math.atan2(by - ay, bx - ax); return beta * (1 + z1 / z2) + Math.PI - 1.3 * TAU / z2; };

// ── label anchors (projected to DOM labels by the director) ──
WX.anchors = WX.anchors || {};
WX.anchor = function (key, parent, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); WX.anchors[key] = o; return o; };
const pv = new THREE.Vector3();
// world point → CSS pixel position on the stage element (after the camera has been placed)
WX.project = function (obj, out = {}) {
  if (obj.isObject3D) obj.getWorldPosition(pv); else pv.set(obj.x, obj.y, obj.z);
  pv.project(WX.camera);
  out.x = (pv.x * 0.5 + 0.5) * WX.viewW; out.y = (-pv.y * 0.5 + 0.5) * WX.viewH; out.visible = pv.z < 1;
  return out;
};

// ── camera framing (shared by the director and the stage test page) ──
// The bottom of the frame is reserved for subtitles; the image centre is shifted into the free area
// and distances are scaled so a shot framed for 1280×720 reads the same at any size.
WX.frameK = 1;
WX.applyFraming = function (viewW, viewH, reserveBottom = 0, reserveLeft = 0) {
  WX.viewW = viewW; WX.viewH = viewH;
  const x0 = reserveLeft, x1 = viewW, y0 = 0, y1 = viewH - reserveBottom;
  const fw = Math.max(160, x1 - x0), fh = Math.max(160, y1 - y0);
  const cx = (x0 + x1) / 2 - viewW / 2, cy = (y0 + y1) / 2 - viewH / 2;
  WX.frameK = Math.max(viewH * 0.8 / fh, viewH * 1.12 / fw, 0.85);
  WX.camera.aspect = viewW / viewH;
  WX.camera.setViewOffset(viewW, viewH, -cx, -cy, viewW, viewH);
  WX.camera.updateProjectionMatrix();
  return WX.frameK;
};
// c = { t:[x,y,z], yaw, pitch, dist, roll? } in the frame of `origin` (a Vector3 or [x,y,z]); user = orbit offsets
WX.placeCam = function (c, origin, user) {
  const o = origin ? (origin.isVector3 ? origin : new THREE.Vector3(origin[0], origin[1], origin[2])) : new THREE.Vector3();
  const u = user || { yaw: 0, pitch: 0, zoom: 0 };
  const yaw = c.yaw + u.yaw, pitch = clamp(c.pitch + u.pitch, -1.45, 1.45), dist = c.dist * WX.frameK * Math.exp(u.zoom || 0);
  const tx = c.t[0] + o.x, ty = c.t[1] + o.y, tz = c.t[2] + o.z;
  WX.camera.position.set(tx + dist * Math.cos(pitch) * Math.sin(yaw), ty + dist * Math.sin(pitch), tz + dist * Math.cos(pitch) * Math.cos(yaw));
  WX.camera.up.set(0, 1, 0);
  WX.camera.lookAt(tx, ty, tz);
  if (c.roll) WX.camera.rotateZ(c.roll);
  WX.camera.updateMatrixWorld();
};
WX.mixCam = (a, b, k) => ({ t: [lerp(a.t[0], b.t[0], k), lerp(a.t[1], b.t[1], k), lerp(a.t[2], b.t[2], k)], yaw: lerp(a.yaw, b.yaw, k), pitch: lerp(a.pitch, b.pitch, k), dist: lerp(a.dist, b.dist, k), roll: lerp(a.roll || 0, b.roll || 0, k) });
// keyframed camera path: keys [{at: seconds, t, yaw, pitch, dist}], eased between keys
WX.camPath = (keys, u) => {
  if (u <= keys[0].at) return keys[0];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i].at) return WX.mixCam(keys[i - 1], keys[i], ease((u - keys[i - 1].at) / (keys[i].at - keys[i - 1].at)));
  return keys[keys.length - 1];
};
WX.SUB_RESERVE = 112;   // px kept clear at the bottom for subtitles at 720p

// ── close-up stages ──
// WX.registerStage(name, build). build(ctx) creates meshes under ctx.group (stage-local mm units)
// and returns { cameras: { name: { t:[x,y,z], yaw, pitch, dist } }, update(u, p, T), overlay?(u, p, T) }.
WX.stageBuilders = WX.stageBuilders || {};
WX.registerStage = (name, build) => { WX.stageBuilders[name] = build; };
WX.stages = {};
WX.buildStages = function (overlayRoot) {
  let i = 0;
  for (const name of Object.keys(WX.stageBuilders)) {
    i++;
    const group = new THREE.Group(); group.name = 'stage:' + name;
    group.position.set(2000 * i, 0, 0); group.visible = false; WX.scene.add(group);
    const overlay = document.createElement('div'); overlay.className = 'stage-overlay'; overlay.dataset.stage = name; overlay.hidden = true;
    if (overlayRoot) overlayRoot.appendChild(overlay);
    const ctx = { THREE, WX, group, overlay, name, anchor: (key, parent, x, y, z) => WX.anchor(name + ':' + key, parent || group, x, y, z) };
    const api = WX.stageBuilders[name](ctx) || {};
    WX.stages[name] = { name, group, overlay, origin: group.position.clone(), api };
  }
  return WX.stages;
};
})();
