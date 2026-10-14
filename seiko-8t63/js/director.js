// Director: turns window.SHOTS + window.NARRATION into a timeline, plays it (tour mode) or lets the
// viewer drive the watch (explore mode). Handles stage cuts, cameras, layer ghosting, labels,
// subtitles, chapter cards, HUD readouts and narration audio sync. Deterministic: seek(T) rebuilds
// the exact state at any time, which the video renderer relies on (?capture=1).
(function () {
'use strict';
const WX = window.WX, W = window.WATCH;
const { TAU, clamp, lerp, smooth, ease, wrapPi } = WX;
const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const CAPTURE = qs.has('capture');
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = W.S;

WX.buildStages($('overlays'));

// ───────────── timeline ─────────────
const NAR = (window.NARRATION && window.NARRATION.lines) || {};
const LEAD = 0.45, GAP = 0.32, TAIL = 0.75;
const estDur = text => Math.max(1.2, text.split(/\s+/).length / 2.55);
const SHOTS = window.SHOTS; SHOTS.forEach(s => { if (!s.stage) s.stage = 'watch'; });
let TOTAL = 0;
const LINES = [];   // {id, text, t0, t1, shot}
const CHAPTERS = [];
for (const s of SHOTS) {
  s.start = TOTAL;
  let t = s.start + (s.lead !== undefined ? s.lead : LEAD);
  s.lineTimes = [];
  for (const id of s.lines || []) {
    const n = NAR[id] || { text: (window.SCRIPT_TEXT || {})[id] || id };
    const d = n.dur || estDur(n.text || '');
    const L = { id, text: n.text || '', t0: t, t1: t + d, shot: s };
    LINES.push(L); s.lineTimes.push(L); t += d + GAP;
  }
  const spoken = (s.lines || []).length ? t - GAP + (s.tail !== undefined ? s.tail : TAIL) - s.start : 0;
  s.dur = Math.max(s.minDur || 0, spoken) + (s.extra || 0);
  if (s.chapter) CHAPTERS.push({ title: s.chapter, start: s.start, shot: s });
  TOTAL += s.dur;
}
SHOTS.forEach((s, i) => { s.prev = SHOTS[i - 1] || null; s.next = SHOTS[i + 1] || null; s.index = i; });
const LINE_BY_ID = {}; LINES.forEach(L => { LINE_BY_ID[L.id] = L; });
// resolve a time reference to seconds into shot s: number, negative number (from the end), or 'nID', 'nID+1.2', 'nID.end-0.5'
function tref(s, x) {
  if (typeof x === 'number') return x < 0 ? s.dur + x : x;
  const m = /^(\w+?)(\.end)?([+-][\d.]+)?$/.exec(x);
  const L = m && LINE_BY_ID[m[1]];
  if (!L) { console.warn('bad time ref', x); return 0; }
  return (m[2] ? L.t1 : L.t0) - s.start + (m[3] ? parseFloat(m[3]) : 0);
}
SHOTS.forEach(s => { s.t = x => tref(s, x); });
CHAPTERS.forEach((c, i) => { c.end = (CHAPTERS[i + 1] || { start: TOTAL }).start; c.n = i + 1; });
function shotAt(T) { let lo = 0, hi = SHOTS.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SHOTS[m].start <= T) lo = m; else hi = m - 1; } return SHOTS[lo]; }
function ctlAt(T) { const s = shotAt(T); return Object.assign({ rate: 1, slow: 1, spin: 0, badge: null }, s.ctl ? s.ctl(T - s.start, s.dur, s) : {}); }
function chapterAt(T) { let c = CHAPTERS[0]; for (const k of CHAPTERS) if (k.start <= T + 1e-6) c = k; return c; }

// ───────────── simulation over tour time ─────────────
const tour = { T: 0, playing: false };
function advance(dtReal, T) {
  while (dtReal > 1e-9) {
    const h = Math.min(dtReal, 1 / 60), c = ctlAt(T + h / 2);
    W.simStep(h * c.slow, c); T += h; dtReal -= h;
  }
}
const EVENTS = [];
for (const s of SHOTS) for (const [u, fn] of s.events || []) EVENTS.push([s.start + tref(s, u), fn]);
EVENTS.sort((a, b) => a[0] - b[0]);
function tourStep(dt) {
  const T0 = tour.T, T1 = Math.min(TOTAL, T0 + dt);
  let t = T0;
  for (const [te, fn] of EVENTS) { if (te > T0 && te <= T1) { advance(te - t, t); fn(W); t = te; } }
  advance(T1 - t, t);
  tour.T = T1;
}
function seek(T) { W.resetSim(); if (window.SIM_INIT) window.SIM_INIT(W); tour.T = 0; tourStep(clamp(T, 0, TOTAL)); syncAudio(true); }

// ───────────── layout + camera ─────────────
const stageEl = $('stage');
const user = { yaw: 0, pitch: 0, zoom: 0 };
let lastInteract = -1e9, viewW = 1, viewH = 1;
function measure() {
  viewW = stageEl.clientWidth; viewH = stageEl.clientHeight;
  WX.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CAPTURE ? 1 : 2));
  WX.renderer.setSize(viewW, viewH, false);
  const bar = $('bar'), barH = bar && !bar.hidden && mode === 'tour' ? bar.offsetHeight : 0;
  const ex = $('exploreUI'), exH = ex && !ex.hidden ? ex.offsetHeight + 12 : 0;
  const reserve = mode === 'tour' ? Math.max(WX.SUB_RESERVE * viewH / 720, 70) + barH : exH;
  WX.applyFraming(viewW, viewH, reserve);
  document.documentElement.style.setProperty('--subs-bottom', (barH + 14) + 'px');
}
window.addEventListener('resize', measure);

// ───────────── UI elements ─────────────
const ui = {
  subs: $('subs'), chapter: $('chapterCard'), chN: $('chN'), chTitle: $('chTitle'), fade: $('fade'), rail: $('rail'), clock: $('clock'),
  play: $('play'), playIcon: $('playIcon'), big: $('bigPlay'), badge: $('badge'), sw: $('swCard'), swTime: $('swTime'), swState: $('swState'),
  scopeCard: $('scopeCard'), scope: $('scope'), specs: $('specs'), toast: $('toast'), vo: $('vo'), mute: $('mute'), card: $('shotCard'),
};
const fmt = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const segFills = CHAPTERS.map(c => {
  const b = document.createElement('button'); b.className = 'seg'; b.style.setProperty('--w', (c.end - c.start).toFixed(1));
  b.setAttribute('aria-label', `Chapter ${c.n}: ${c.title}`); b.title = `${c.n}. ${c.title}`;
  const f = document.createElement('i'); b.appendChild(f);
  b.addEventListener('click', () => { if (mode !== 'tour') setMode('tour'); seek(c.start + 0.001); play(true); });
  ui.rail.appendChild(b); return f;
});
function syncPlay() {
  const ended = tour.T >= TOTAL - 1e-6;
  ui.play.setAttribute('aria-label', tour.playing ? 'Pause' : ended ? 'Replay' : 'Play');
  ui.playIcon.innerHTML = tour.playing ? '<rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/>'
    : ended ? '<path d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7l1.6.6A3.8 3.8 0 1 0 8 4.2V6L4.8 3.4 8 .8z"/>' : '<path d="M4 2.2v11.6c0 .6.7 1 1.2.7l9-5.8c.5-.3.5-1 0-1.3l-9-5.8C4.7 1.2 4 1.6 4 2.2z"/>';
  ui.big.hidden = tour.playing || CAPTURE || mode !== 'tour';
  ui.big.querySelector('span').textContent = ended ? 'Watch again' : tour.T > 0.5 ? 'Resume' : 'Play the film';
}
function play(on) {
  if (on && tour.T >= TOTAL - 1e-6) seek(0);
  tour.playing = on; syncPlay(); syncAudio(true);
}
ui.play.addEventListener('click', () => { if (mode !== 'tour') setMode('tour'); play(!tour.playing); });
ui.big.addEventListener('click', () => { if (mode !== 'tour') setMode('tour'); play(true); });
let muted = false;
ui.mute.addEventListener('click', () => { muted = !muted; ui.vo.muted = muted; ui.mute.setAttribute('aria-pressed', muted); ui.mute.setAttribute('aria-label', muted ? 'Unmute narration' : 'Mute narration'); ui.mute.classList.toggle('off', muted); });
function syncAudio(force) {
  const a = ui.vo; if (!a || CAPTURE || !a.src) return;
  if (tour.playing && mode === 'tour') {
    if (force || Math.abs(a.currentTime - tour.T) > 0.3) { try { a.currentTime = tour.T; } catch (e) {} }
    if (a.paused) a.play().catch(() => {});
  } else if (!a.paused) a.pause();
}
let toastUntil = 0;
function toast(msg) { ui.toast.textContent = msg; ui.toast.style.opacity = 1; toastUntil = performance.now() + 2400; }

// scope (motor pulses)
const sctx = ui.scope.getContext('2d');
function drawScope() {
  const w = ui.scope.width, h = ui.scope.height, win = 3.0;
  sctx.clearRect(0, 0, w, h);
  sctx.font = `500 ${Math.round(h * 0.15)}px "IBM Plex Mono", monospace`; sctx.textBaseline = 'middle';
  const rows = [['A', h * 0.3, 'Time motor · 1/s'], ['B', h * 0.76, 'Stopwatch motor · 5/s']];
  for (const [m, y, name] of rows) {
    sctx.strokeStyle = 'rgba(205,218,232,0.22)'; sctx.lineWidth = 1; sctx.beginPath(); sctx.moveTo(0, y); sctx.lineTo(w, y); sctx.stroke();
    sctx.fillStyle = 'rgba(154,163,173,0.95)'; sctx.fillText(name, 4, y - h * 0.15);
    sctx.fillStyle = '#78c3ff';
    for (const p of S.pulses) {
      if (p.motor !== m) continue; const age = S.t - p.t; if (age > win || age < 0) continue;
      const x = w * (1 - age / win), pw = Math.max(3, w * 0.025 / win), amp = h * 0.12;
      sctx.fillRect(x - pw, p.pol ? y - amp : y, pw, amp);
    }
  }
}

// labels
const labelLayer = $('labels'), labelEls = {};
const pt = {};
function labelEl(k) {
  if (labelEls[k]) return labelEls[k];
  const el = document.createElement('div'); el.className = 'lab';
  el.innerHTML = '<span class="lead"></span><span class="dot"></span><span class="txt"></span>';
  labelLayer.appendChild(el);
  return (labelEls[k] = { el, txt: el.querySelector('.txt'), text: '', w: 0 });
}
function updateLabels(list) {
  const seen = new Set();
  for (const it of list) {
    const a = WX.anchors[it.k]; if (!a || it.op <= 0.01) continue;
    WX.project(a, pt);
    if (!pt.visible || pt.x < -20 || pt.x > viewW + 20 || pt.y < -20 || pt.y > viewH + 20) continue;
    const e = labelEl(it.k); seen.add(it.k);
    if (e.text !== it.text) { e.text = it.text; e.txt.textContent = it.text; e.w = e.txt.offsetWidth || it.text.length * 7; }
    let side = it.side || (pt.x > viewW * 0.5 ? 'r' : 'l');
    if (side === 'r' && pt.x + e.w + 30 > viewW) side = 'l';
    else if (side === 'l' && pt.x - e.w - 30 < 0) side = 'r';
    const cls = 'lab ' + side + (it.d ? ' d' : '') + (it.minor ? ' minor' : '');
    if (e.el.className !== cls) e.el.className = cls;
    e.el.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
    e.el.style.opacity = it.op.toFixed(3);
  }
  for (const k in labelEls) if (!seen.has(k)) labelEls[k].el.style.opacity = 0;
}

// ───────────── per-shot evaluation ─────────────
const DEFAULT_VIS = { flow: 0, fork: 0 };
const visOf = (s, n) => { const v = (s && s.vis) || {}; return n in v ? v[n] : (n in DEFAULT_VIS ? DEFAULT_VIS[n] : 1); };
const paramsOf = (s, u) => typeof s.p === 'function' ? s.p(u, s.dur, s) : (s.p || {});
function namedCam(s, name) {
  const st = WX.stages[s.stage], cams = (st && st.api.cameras) || {};
  return cams[name] || cams[Object.keys(cams)[0]] || { t: [0, 0, 0], yaw: 0, pitch: 0.2, dist: 80 };
}
function camOf(s, u) {
  if (typeof s.cam === 'function') return s.cam(u, s.dur);
  if (typeof s.cam === 'string') {
    const c = namedCam(s, s.cam), d = s.drift || {};
    return { t: c.t, yaw: c.yaw + (d.yaw || 0) * u, pitch: c.pitch + (d.pitch || 0) * u, dist: c.dist * (1 + (d.zoom || 0) * u / s.dur), roll: 0 };
  }
  if (Array.isArray(s.cam) && typeof s.cam[0] === 'string') {
    // move between named cameras: [name0, name1, ...] spread evenly, or {at} fractions via s.camAt
    const at = s.camAt || s.cam.map((_, i) => i / (s.cam.length - 1));
    return WX.camPath(s.cam.map((n, i) => Object.assign({}, namedCam(s, n), { at: at[i] * s.dur })), u);
  }
  if (Array.isArray(s.cam)) return WX.camPath(s.cam.map(k => Object.assign({}, k, { at: k.at <= 1 && s.camFrac ? k.at * s.dur : k.at })), u);
  const c = s.cam || { t: [0, 0, 0], yaw: 0, pitch: 0.3, dist: 120 };
  return { t: c.t, yaw: c.yaw + (c.drift || 0) * u, pitch: c.pitch + (c.pdrift || 0) * u, dist: c.dist * (1 + (c.zoom || 0) * u / s.dur), roll: c.roll || 0 };
}
const sameStage = (a, b) => a && b && a.stage === b.stage && !b.cut;
let shownShot = null, chapterShown = null;
let currentCam = null, currentVis = {}, currentEx = 0, currentStage = 'watch';

function setStageVisible(name) {
  if (currentStage === name && W.root.visible === (name === 'watch')) return;
  currentStage = name;
  W.root.visible = name === 'watch';
  for (const k in WX.stages) { const st = WX.stages[k]; st.group.visible = k === name; st.overlay.hidden = k !== name; }
}

function evalTour(T, dt) {
  const s = shotAt(T), u = T - s.start, prev = s.prev;
  const blendPrev = sameStage(prev, s);
  const k = blendPrev ? ease(u / (s.trans !== undefined ? s.trans : 2.2)) : 1;
  setStageVisible(s.stage);
  // camera
  const camNow = camOf(s, u);
  currentCam = blendPrev && k < 1 ? WX.mixCam(camOf(prev, prev.dur), camNow, k) : camNow;
  // watch layers
  if (s.stage === 'watch') {
    const exOf = (q, uu) => typeof q.ex === 'function' ? q.ex(uu, q.dur) : (q.ex || 0);
    const pe = blendPrev ? exOf(prev, prev.dur) : exOf(s, u);
    currentEx = lerp(pe, exOf(s, u), k);
    for (const n of W.LAYER_NAMES) currentVis[n] = lerp(blendPrev ? visOf(prev, n) : visOf(s, n), visOf(s, n), k);
  }
  // cut fades
  let fade = 0;
  const fi = s.fadeIn !== undefined ? s.fadeIn : (prev && !sameStage(prev, s) ? 0.38 : 0);
  const fo = s.fadeOut !== undefined ? s.fadeOut : (s.next && !sameStage(s, s.next) ? 0.38 : 0);
  if (fi > 0) fade = Math.max(fade, 1 - smooth(u / fi));
  if (fo > 0) fade = Math.max(fade, smooth((u - (s.dur - fo)) / fo));
  if (T < 0.6) fade = Math.max(fade, 1 - smooth(T / 0.6));
  ui.fade.style.opacity = fade.toFixed(3);
  // labels
  const labels = (s.labels || []).map(l => Object.assign({}, l, { op: smooth((u - (l.at !== undefined ? tref(s, l.at) : 0.9)) / 0.45) * (1 - smooth((u - (l.until !== undefined ? tref(s, l.until) : s.dur - 0.5)) / 0.4)) }));
  // subtitles
  let line = null; for (const L of s.lineTimes) if (T >= L.t0 - 0.05 && T <= L.t1 + 0.25) line = L;
  if (ui.subs.dataset.id !== (line ? line.id : '')) { ui.subs.dataset.id = line ? line.id : ''; ui.subs.firstChild.textContent = line ? line.text : ''; }
  ui.subs.style.opacity = line ? '1' : '0';
  // chapter card
  const ch = chapterAt(T);
  if (ch) {
    const cu = T - ch.start, op = smooth((cu - 0.3) / 0.5) * (1 - smooth((cu - 4.6) / 0.6));
    if (chapterShown !== ch) { chapterShown = ch; ui.chN.textContent = String(ch.n).padStart(2, '0') + ' / ' + String(CHAPTERS.length).padStart(2, '0'); ui.chTitle.textContent = ch.title; }
    ui.chapter.style.opacity = op.toFixed(3);
    CHAPTERS.forEach((c, j) => { segFills[j].style.width = (T >= c.end ? 100 : T <= c.start ? 0 : 100 * (T - c.start) / (c.end - c.start)) + '%'; });
  }
  ui.clock.textContent = `${fmt(T)} / ${fmt(TOTAL)}`;
  // stage animation
  if (s.stage !== 'watch') {
    const st = WX.stages[s.stage];
    if (st && st.api.update) st.api.update(u, paramsOf(s, u), T, s.dur);
  }
  // info card (watch shots and any stage): { html, at, until, side }
  const card = s.card ? (typeof s.card === 'function' ? s.card(u, s.dur) : s.card) : null;
  if (card) {
    if (ui.card.dataset.id !== s.id + (card.key || '')) { ui.card.dataset.id = s.id + (card.key || ''); ui.card.innerHTML = card.html; ui.card.className = 'shotcard ' + (card.side || 'left'); }
    const a0 = card.at !== undefined ? tref(s, card.at) : 1.0, a1 = card.until !== undefined ? tref(s, card.until) : s.dur - 0.6;
    ui.card.style.opacity = (smooth((u - a0) / 0.5) * (1 - smooth((u - a1) / 0.45))).toFixed(3);
    if (card.update) card.update(ui.card, u, s.dur, W);
  } else ui.card.style.opacity = 0;
  if (s.onFrame) s.onFrame(u, W, s.dur);
  return { s, u, labels, hud: s.hud || {}, badge: ctlAt(T).badge };
}

// ───────────── explore mode ─────────────
let mode = 'tour';
const ex = { explode: 0, xray: false, rate: 1, spin: 0, preset: 'front3q', camFrom: null, camT: 1 };
const PRESETS = {
  front3q: { t: [0, 0, 2], yaw: -0.45, pitch: 0.3, dist: 118 },
  front: { t: [0, 0, 3], yaw: 0, pitch: 0.03, dist: 90 },
  back: { t: [0, 0, -2], yaw: Math.PI, pitch: 0.05, dist: 90 },
  side: { t: [0, 0, 3], yaw: 1.15, pitch: 0.3, dist: 160 },
};
function setMode(m) {
  if (m === mode) return;
  mode = m;
  $('modeTour').setAttribute('aria-selected', m === 'tour'); $('modeExplore').setAttribute('aria-selected', m === 'explore');
  $('bar').hidden = m !== 'tour'; $('exploreUI').hidden = m !== 'explore';
  ui.subs.hidden = m !== 'tour'; ui.chapter.hidden = m !== 'tour';
  if (m === 'explore') {
    tour.playing = false; syncPlay(); syncAudio();
    setStageVisible('watch'); ui.fade.style.opacity = 0;
    ex.camFrom = currentStage === 'watch' && currentCam ? currentCam : PRESETS.front3q; ex.camT = 0; ex.preset = 'front3q';
    user.yaw = user.pitch = user.zoom = 0; ex.explode = 0; $('explode').value = 0; ex.xray = false; $('xray').setAttribute('aria-pressed', 'false');
  } else user.yaw = user.pitch = user.zoom = 0;
  syncPlay(); measure();
}
$('modeTour').addEventListener('click', () => setMode('tour'));
$('modeExplore').addEventListener('click', () => setMode('explore'));
$('btnA').addEventListener('click', () => W.pressA());
$('btnB').addEventListener('click', () => { W.pressB(); if (S.toastMsg) { toast(S.toastMsg); S.toastMsg = null; } });
const crownBtns = [0, 1, 2].map(i => $('crown' + i));
crownBtns.forEach((b, i) => b.addEventListener('click', () => { S.crownPos = i; crownBtns.forEach((c, j) => c.setAttribute('aria-pressed', i === j)); }));
const turn = $('crownTurn');
const spinOn = e => { e.preventDefault(); ex.spin = 3.2; if (S.crownPos === 0) toast('Pull the crown out first: 1st click sets the date, 2nd click the time'); };
const spinOff = () => { ex.spin = 0; };
turn.addEventListener('pointerdown', spinOn); turn.addEventListener('pointerup', spinOff); turn.addEventListener('pointerleave', spinOff); turn.addEventListener('pointercancel', spinOff);
turn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') ex.spin = 3.2; });
turn.addEventListener('keyup', spinOff);
$('explode').addEventListener('input', e => { ex.explode = e.target.value / 100; });
$('xray').addEventListener('click', e => { ex.xray = !ex.xray; e.currentTarget.setAttribute('aria-pressed', ex.xray); });
for (const [id, p] of [['vFront', 'front'], ['vBack', 'back'], ['vSide', 'side']]) $(id).addEventListener('click', () => { ex.camFrom = currentCam; ex.camT = 0; ex.preset = p; user.yaw = user.pitch = user.zoom = 0; });
const speedBtns = [['sp1', 1], ['sp60', 60], ['sp600', 600]];
speedBtns.forEach(([id, r]) => $(id).addEventListener('click', () => { ex.rate = r; speedBtns.forEach(([j]) => $(j).setAttribute('aria-pressed', j === id)); }));
function evalExplore(dt) {
  ex.camT = Math.min(1, ex.camT + (dt || 0) / 1.6);
  const target = PRESETS[ex.preset];
  currentCam = ex.camFrom ? WX.mixCam(ex.camFrom, target, ease(ex.camT)) : target;
  const xr = ex.xray ? { bracelet: 0.5, case: 0.35, crystal: 0, bezel: 0.5, dial: 0.12, date: 0.25, motion: 0.7 } : {};
  const tgt = {}; for (const n of W.LAYER_NAMES) tgt[n] = n in xr ? xr[n] : (n in DEFAULT_VIS ? DEFAULT_VIS[n] : 1);
  if (ex.explode > 0.5) { tgt.bracelet = Math.min(tgt.bracelet, 0.15); tgt.case = Math.min(tgt.case, 0.2); }
  const kk = 1 - Math.exp(-(dt || 0.016) / 0.2);
  for (const n of W.LAYER_NAMES) currentVis[n] = lerp(currentVis[n] === undefined ? tgt[n] : currentVis[n], tgt[n], kk);
  currentEx = lerp(currentEx, ex.explode, kk);
  const labels = [{ k: 'pusherA', text: 'A · start / stop', op: 1 }, { k: 'pusherB', text: 'B · reset', d: 1, op: 1 }, { k: 'crown', text: ['Crown · in', 'Crown · date', 'Crown · time'][S.crownPos], op: 1 }];
  if (ex.xray) labels.push({ k: 'hammer', text: 'Hammer', op: 1 }, { k: 'heartCS', text: 'Heart cam', d: 1, op: 1 });
  return { labels, hud: { stopwatch: 1, scope: 1 }, badge: ex.rate > 1 ? `Time-lapse ×${ex.rate}` : null };
}

// pointer orbit
const canvas = $('gl');
const pointers = new Map(); let pinch = 0;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.classList.add('dragging'); lastInteract = performance.now(); });
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) { user.yaw -= dx * 0.006; user.pitch = clamp(user.pitch + dy * 0.005, -1.6, 1.6); }
  else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) user.zoom = clamp(user.zoom - Math.log(d / pinch), -1.2, 1.3); pinch = d; }
  lastInteract = performance.now();
});
const endPtr = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; if (!pointers.size) canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); user.zoom = clamp(user.zoom + e.deltaY * 0.0012, -1.2, 1.3); lastInteract = performance.now(); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, .explore')) return;
  if (e.key === ' ') { e.preventDefault(); if (mode !== 'tour') setMode('tour'); play(!tour.playing); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    if (mode !== 'tour') setMode('tour');
    const c = chapterAt(tour.T), i = clamp(c.n - 1 + (e.key === 'ArrowRight' ? 1 : -1), 0, CHAPTERS.length - 1);
    seek(CHAPTERS[i].start + 0.001); syncPlay();
  }
});

// ───────────── frame ─────────────
function renderFrame(dt) {
  const r = mode === 'tour' ? evalTour(tour.T, dt) : evalExplore(dt);
  if (currentStage === 'watch') {
    for (const n of W.LAYER_NAMES) { W.L[n].g.position.z = W.L[n].ex * currentEx; W.setLayerOpacity(n, clamp(currentVis[n])); }
  }
  const origin = currentStage === 'watch' || !WX.stages[currentStage] ? null : WX.stages[currentStage].origin;
  WX.placeCam(currentCam, origin, user);
  W.applyState();
  // HUD
  const hud = r.hud;
  ui.badge.hidden = !r.badge; if (r.badge) ui.badge.textContent = r.badge;
  ui.sw.hidden = !hud.stopwatch; ui.scopeCard.hidden = !hud.scope; ui.specs.hidden = !hud.specs;
  if (hud.stopwatch) {
    const c = S.chrono, mm = Math.floor(c / 300), ss = Math.floor((c % 300) / 5), f = (c % 5) * 2;
    ui.swTime.innerHTML = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}<small>.${f}</small>`;
    ui.swState.innerHTML = S.hammer > 0.05 && !(S.pB && S.pB.blocked) ? '<b>Hammer down</b> · resetting' : S.running ? '<b>Running</b> · 5 pulses/s' : c > 0 ? 'Stopped · press B to reset' : 'Reset · press A to start';
  }
  if (hud.scope) drawScope();
  if (performance.now() > toastUntil) ui.toast.style.opacity = 0;
  WX.renderer.render(WX.scene, WX.camera);
  if (mode === 'tour' && currentStage !== 'watch') { const st = WX.stages[currentStage], s = shotAt(tour.T); if (st && st.api.overlay) st.api.overlay(tour.T - s.start, paramsOf(s, tour.T - s.start), tour.T, s.dur); }
  updateLabels(r.labels);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === 'tour') {
    if (tour.playing) {
      // follow the audio clock when narration is playing so picture and voice stay locked
      const a = ui.vo;
      if (a && a.src && !a.paused && !CAPTURE && a.readyState >= 2 && Math.abs(a.currentTime - tour.T) < 0.5) tourStep(Math.max(0, a.currentTime - tour.T));
      else tourStep(dt);
      if (tour.T >= TOTAL - 1e-6) { tour.playing = false; syncPlay(); syncAudio(); }
    }
    if (!pointers.size && performance.now() - lastInteract > 2500) {
      const kk = 1 - Math.exp(-dt / 1.4);
      user.yaw = wrapPi(user.yaw) * (1 - kk); user.pitch *= 1 - kk; user.zoom *= 1 - kk;
    }
  } else {
    W.simStep(dt, { rate: ex.rate, slow: 1, spin: ex.spin });
    if (S.toastMsg) { toast(S.toastMsg); S.toastMsg = null; }
  }
  renderFrame(dt);
  requestAnimationFrame(loop);
}

if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('400 40px Michroma'), document.fonts.load('500 40px "IBM Plex Sans"'), document.fonts.load('600 40px "IBM Plex Sans"')])
    .then(() => WX.textures.forEach(t => t.userData.redraw())).catch(() => {});
}
measure();
seek(0);
syncPlay();
window.__seek = T => { if (mode !== 'tour') setMode('tour'); seek(T); renderFrame(0); return shotAt(T).id; };
window.__total = TOTAL;
// Sound-effect cue sheet for the audio mix: walks the whole film once and records mechanical events.
window.__sfx = () => {
  const out = [], dt = 1 / 240;
  W.resetSim(); if (window.SIM_INIT) window.SIM_INIT(W); tour.T = 0;
  const snap = () => ({ a: S.stepsA, b: S.motorB, pa: !!(S.pA && S.pA.fired), hit: S.hammer > 0.97, crown: S.crownPos, date: Math.round(S.dateAnim) });
  let prev = snap();
  while (tour.T < TOTAL - 1e-9) {
    const T0 = tour.T; tourStep(dt);
    const s = shotAt(T0), c = ctlAt(T0), cur = snap(), t = +tour.T.toFixed(4);
    if (s.stage === 'watch') {
      const calm = c.rate <= 1 && c.slow >= 1;
      if (calm && cur.a > prev.a) out.push({ t, type: 'tickA' });
      if (calm && cur.b > prev.b) out.push({ t, type: 'tickB' });
      if (cur.pa && !prev.pa) out.push({ t, type: 'click' });
      if (cur.hit && !prev.hit) out.push({ t, type: 'clack', slow: c.slow });
      if (cur.crown !== prev.crown) out.push({ t, type: 'crown' });
      if (cur.date !== prev.date) out.push({ t, type: 'snap' });
    }
    prev = cur;
  }
  for (const s of SHOTS) {
    if (s.sfx) for (const e of s.sfx(s)) out.push(Object.assign({}, e, { t: +(s.start + tref(s, e.u)).toFixed(4) }));
    if (s.prev && !sameStage(s.prev, s)) out.push({ t: +s.start.toFixed(4), type: 'cut' });
  }
  seek(0);
  return out.sort((x, y) => x.t - y.t);
};
window.__timeline = () => ({ total: TOTAL, shots: SHOTS.map(s => ({ id: s.id, stage: s.stage, start: +s.start.toFixed(3), dur: +s.dur.toFixed(3), chapter: s.chapter || null })), lines: LINES.map(L => ({ id: L.id, t0: +L.t0.toFixed(3), t1: +L.t1.toFixed(3) })), events: EVENTS.map(e => +e[0].toFixed(3)) });
window.__sim = () => ({ t: S.t, stepsA: S.stepsA, chrono: S.chrono, running: S.running, pulses: S.pulses.slice(-50) });
window.__ready = Promise.resolve(document.fonts ? document.fonts.ready : null).then(() => WX.textures.forEach(t => t.userData.redraw()));
if (CAPTURE) { document.body.classList.add('capture'); renderFrame(0); }
else requestAnimationFrame(t => { last = t; loop(t); });
})();
