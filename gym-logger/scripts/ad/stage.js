// Reklamefilmen for Sosialt: ekte skjermbilder fra appen, animert etter tidene i voiceoveren.
// Alt regnes ut fra tiden t (sekunder), så hvert bilde blir likt hver gang (render.mjs tar bilde for bilde).
/* global shots */

const K = 640 / 390; // CSS-piksler i appen → piksler på telefonskjermen
const SCREEN_H = 1385;
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const p = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out = (x) => 1 - Math.pow(1 - x, 3);
const back = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
// Inn (a→a+d), ute (b→b+d): 0..1..0
const window01 = (t, a, b, d = 0.35) => Math.min(p(t, a, a + d), 1 - p(t, b, b + d));
// Deterministisk tilfeldig
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

const SHOTS = ['home-training', 'home-social', 'social-top', 'feed-markus', 'feed-markus-fire', 'tab-people', 'tab-top', 'top-full', 'top-mylevel',
  'tab-challenges', 'inbox', 'sheet-filled', 'challenge-won', 'level', 'share', 'social-badges'];
const layers = {};
const screen = $('screen');
for (const name of SHOTS) {
  const img = document.createElement('img');
  img.className = 'layer';
  img.src = `shots/${name}.png`;
  screen.insertBefore(img, $('ripple'));
  layers[name] = img;
}
// Fast topp og bunnmeny over ledertavla som ruller (fra skjermbildet uten rulling)
for (const [name, clip] of [['topNav', `inset(${SCREEN_H - 96 * K}px 0 0 0)`], ['topHead', `inset(0 0 ${SCREEN_H - 50 * K}px 0)`]]) {
  const img = document.createElement('img');
  img.className = 'layer';
  img.src = 'shots/tab-top.png';
  img.style.clipPath = clip;
  screen.insertBefore(img, $('ripple'));
  layers[name] = img;
}

// Fire små telefoner til «a whole lineup of new features»
const MINIS = [['tab-people', 'People'], ['tab-top', 'Leaderboards'], ['tab-challenges', 'Challenges'], ['inbox', 'Notifications']];
const minis = MINIS.map(([shot, label]) => {
  const el = document.createElement('div');
  el.className = 'abs mini';
  el.innerHTML = `<img src="shots/${shot}.png"><div class="label">${label}</div>`;
  $('minis').appendChild(el);
  return el;
});

// Globus av prikker (ledertavler for hele verden)
{
  const svg = $('globe');
  let html = '<defs><radialGradient id="g"><stop offset="0" stop-color="#34c56a" stop-opacity=".25"/><stop offset="1" stop-color="#34c56a" stop-opacity="0"/></radialGradient></defs><circle cx="450" cy="450" r="440" fill="url(#g)"/>';
  for (let i = 0; i < 520; i++) html += `<circle class="dot" r="4" fill="#34c56a"/>`;
  svg.innerHTML = html;
}
const dots = [...document.querySelectorAll('#globe .dot')].map((el, i) => ({ el, lat: Math.asin(2 * rnd(i + 1) - 1), lon: rnd(i + 999) * Math.PI * 2 }));

// Konfetti og emoji
const confetti = Array.from({ length: 90 }, (_, i) => {
  const el = document.createElement('div');
  el.className = 'bit';
  el.style.background = ['#34c56a', '#7dd89e', '#f2f5f3', '#e8c547', '#4d9bf0'][i % 5];
  $('confetti').appendChild(el);
  return el;
});
const emojis = Array.from({ length: 9 }, (_, i) => {
  const el = document.createElement('div');
  el.className = 'em';
  el.textContent = ['🔥', '🔥', '💪', '🔥', '👏', '🔥', '🏆', '🔥', '💪'][i];
  $('emoji').appendChild(el);
  return el;
});

function caption(t, list) {
  // list: [fra, til, hovedtekst (HTML), undertekst]
  // Den teksten som er mest synlig akkurat nå (en som tones ut skal ikke skjule den neste).
  const vis = ([a, b]) => window01(t, a - 0.3, b, 0.3);
  const c = list.reduce((best, x) => (vis(x) > (best ? vis(best) : 0) ? x : best), null);
  const c1 = $('cap1');
  const c2 = $('cap2');
  if (!c) { c1.style.opacity = 0; c2.style.opacity = 0; return; }
  const [a, b, main, sub] = c;
  const v = vis(c);
  if (c1.innerHTML !== main) c1.innerHTML = main;
  if (c2.innerHTML !== (sub ?? '')) c2.innerHTML = sub ?? '';
  c1.style.opacity = v;
  c1.style.transform = `translateY(${(1 - out(p(t, a - 0.3, a))) * 30}px)`;
  c2.style.opacity = v * p(t, a, a + 0.4);
}

const CAPTIONS = [
  [0.1, 1.95, 'Introducing', ''],
  [2.05, 3.0, '<span class="accent">Socials</span>', 'by RepGrade'],
  [3.2, 5.6, 'Level up your training', 'The new way to train with friends'],
  [5.95, 8.9, 'Sticking to the plan?', 'See every set your friends log'],
  [9.0, 9.95, 'Now you can <span class="accent">check</span>', 'Give kudos 🔥'],
  [10.3, 12.95, 'A whole lineup', 'of new features'],
  [13.02, 14.0, 'My favorite?', ''],
  [14.1, 17.85, 'The <span class="accent">challenges</span>', 'First to hit a strength goal'],
  [17.95, 19.8, 'May the best lifter <span class="accent">win</span>', ''],
  [19.95, 23.6, 'How do you compare?', 'To the rest of the world'],
  [23.7, 25.1, '<span class="accent">Global</span> leaderboards', ''],
  [25.25, 27.45, 'Compete at your level', 'Newbie to Olympia'],
  [27.5, 28.75, 'Win a <span class="accent">badge</span>', ''],
  [28.8, 29.95, 'The best part?', ''],
  [32.05, 33.4, 'Level up your training', ''],
  [33.5, 35.0, 'Share your <span class="accent">true strength</span>', ''],
];

function setLayer(name, opacity, { y = 0, x = 0, scale = 1, clip } = {}) {
  const el = layers[name];
  el.style.opacity = opacity;
  el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  if (clip !== undefined) el.style.clipPath = clip;
}

function ripple(t, at, pt) {
  const r = $('ripple');
  const v = p(t, at, at + 0.45);
  if (t < at || v >= 1 || !pt) { r.style.opacity = 0; return; }
  r.style.left = `${pt.x * K}px`;
  r.style.top = `${pt.y * K}px`;
  r.style.opacity = 1 - v;
  r.style.transform = `scale(${0.4 + v * 1.1})`;
}

window.renderAt = function renderAt(t) {
  // ---------- Bakgrunn ----------
  $('glowA').style.transform = `translate(${lerp(-300, 200, (Math.sin(t * 0.25) + 1) / 2)}px, ${lerp(-200, 300, (Math.cos(t * 0.2) + 1) / 2)}px)`;
  $('glowB').style.transform = `translate(${lerp(400, 600, (Math.cos(t * 0.3) + 1) / 2)}px, ${lerp(1100, 1400, (Math.sin(t * 0.22) + 1) / 2)}px)`;
  $('grid').style.transform = `translateY(${(t * 12) % 72}px)`;

  // Nullstill
  for (const name in layers) layers[name].style.opacity = 0;
  const phone = $('phone');
  let ph = { x: 0, y: 0, s: 1, r: 0, o: 1, ox: 50, oy: 50 };

  // ---------- 1: Intro (0–3,1) ----------
  if (t < 3.15) {
    const rise = out(p(t, 0, 0.9));
    const z = io(p(t, 1.0, 1.6)) * (1 - io(p(t, 2.55, 3.1)));
    ph = { ...ph, y: lerp(900, 0, rise), r: lerp(8, 0, rise), s: lerp(0.9, 1, rise) * (1 + z * 0.55), ox: 30, oy: 96 };
    setLayer('home-training', 1);
    // Historikk-fanen blir Sosialt
    setLayer('home-social', io(p(t, 1.95, 2.3)));
    ripple(t, 1.55, shots.navSocialSlot);
  }
  // ---------- 2: Sosialt (3,1–5,9) ----------
  else if (t < 5.9) {
    setLayer('social-top', 1);
    setLayer('home-social', 1 - io(p(t, 3.15, 3.5)), { x: -io(p(t, 3.15, 3.5)) * 200 });
    // Zoom inn på profilen og nivået ved «level up»
    const z = io(p(t, 4.0, 4.9)) * (1 - io(p(t, 5.45, 5.9)));
    ph = { ...ph, s: 1 + z * 0.3, ox: 50, oy: 12 };
  }
  // ---------- 3: Feed – Markus (5,9–10,1) ----------
  else if (t < 10.1) {
    // Rulling fra toppen ned til Markus sitt kort
    const sc = io(p(t, 5.9, 6.6));
    setLayer('social-top', 1 - sc, { y: -sc * 300 });
    setLayer('feed-markus', sc, { y: (1 - sc) * 300 });
    // Zoom inn på settene («sticks to his plan»)
    const z = io(p(t, 7.0, 7.9)) * (1 - io(p(t, 8.6, 9.2)));
    ph = { ...ph, s: 1 + z * 0.32, ox: 30, oy: 40 };
    ripple(t, 9.4, shots.fire);
    if (t >= 9.5) setLayer('feed-markus-fire', 1), setLayer('feed-markus', 0);
  }
  // ---------- 4: Mange nye funksjoner (10,1–13,9) ----------
  else if (t < 13.95) {
    const away = io(p(t, 10.1, 10.6));
    ph = { ...ph, o: 1 - away, s: 1 - away * 0.3, y: away * 200 };
    setLayer('feed-markus-fire', 1);
  }
  // ---------- 5: Utfordringer (13,9–17,95) ----------
  else if (t < 17.95) {
    const inn = out(p(t, 13.6, 14.3));
    ph = { ...ph, o: inn, s: lerp(0.45, 1, inn), x: lerp(225, 0, inn), y: lerp(60, 0, inn) };
    setLayer('tab-challenges', 1);
    ripple(t, 15.0, shots.newChallenge);
    const sheet = out(p(t, 15.25, 15.75));
    setLayer('sheet-filled', clamp(p(t, 15.25, 15.37)), { y: (1 - sheet) * 700 });
    // Zoom på «Først til målet», løft og målvekt
    const z = io(p(t, 15.9, 16.6)) * (1 - io(p(t, 17.0, 17.4)));
    ph = { ...ph, s: ph.s * (1 + z * 0.25), ox: 50, oy: 45 };
    ripple(t, 17.45, shots.sendChallenge);
  }
  // ---------- 6: Vinneren (17,95–19,9) ----------
  else if (t < 19.95) {
    const c = io(p(t, 17.95, 18.3));
    setLayer('sheet-filled', 1 - c, { y: c * 400 });
    setLayer('challenge-won', c);
    const z = out(p(t, 18.9, 19.3));
    ph = { ...ph, s: 1 + z * 0.12, ox: 50, oy: 12 };
  }
  // ---------- 7: Hele verden (19,95–25,2) ----------
  else if (t < 25.2) {
    const c = io(p(t, 19.95, 20.4));
    setLayer('challenge-won', 1 - c);
    // Ledertavla ruller sakte; topp og bunnmeny står fast
    const maxScroll = Math.max(0, layers['top-full'].naturalHeight * (640 / 1170) - SCREEN_H);
    const sc = io(p(t, 21.0, 24.4)) * maxScroll * 0.85;
    setLayer('top-full', c, { y: -sc });
    setLayer('topNav', c);
    setLayer('topHead', c);
    ph = { ...ph, s: lerp(1, 0.92, io(p(t, 20.0, 21.0))) };
  }
  // ---------- 8: Ditt nivå og merker (25,2–28,8) ----------
  else if (t < 28.8) {
    const back1 = io(p(t, 25.2, 25.6));
    const maxScroll = Math.max(0, layers['top-full'].naturalHeight * (640 / 1170) - SCREEN_H);
    setLayer('top-full', 1 - back1, { y: -maxScroll * 0.85 * (1 - back1) });
    setLayer('topNav', 1 - back1);
    setLayer('topHead', 1 - back1);
    setLayer('tab-top', back1);
    ripple(t, 26.1, shots.myLevel);
    setLayer('top-mylevel', io(p(t, 26.3, 26.6)));
    if (t > 26.6) setLayer('tab-top', 0);
    ph = { ...ph, s: lerp(0.92, 1, back1) };
  }
  // ---------- 9: Gratis (28,8–31,95) ----------
  else if (t < 31.95) {
    const c = io(p(t, 28.8, 29.2));
    setLayer('top-mylevel', 1 - c);
    setLayer('home-social', c);
    ph = { ...ph, s: lerp(1, 0.94, c) };
  }
  // ---------- 10: Nivå og deling (31,95–35,3) ----------
  else if (t < 35.3) {
    const c = io(p(t, 31.95, 32.3));
    setLayer('home-social', 1 - c);
    setLayer('level', c);
    const z = io(p(t, 32.3, 33.0)) * (1 - io(p(t, 33.3, 33.6)));
    ph = { ...ph, s: 1 + z * 0.3, ox: 50, oy: 14 };
    const sh = out(p(t, 33.45, 33.9));
    setLayer('share', clamp(p(t, 33.45, 33.57)), { y: (1 - sh) * 700 });
  }
  // ---------- 11: Slutt (35,3–) ----------
  else {
    const g = io(p(t, 35.2, 35.7));
    setLayer('share', 1);
    ph = { ...ph, o: 1 - g, s: 1 - g * 0.25, y: g * 120 };
  }

  phone.style.opacity = ph.o;
  phone.style.transformOrigin = `${ph.ox}% ${ph.oy}%`;
  phone.style.transform = `translate(${ph.x}px, ${ph.y + 40}px) rotate(${ph.r}deg) scale(${ph.s * 1.08})`;
  if (!(t >= 1.55 && t < 2.1) && !(t >= 9.4 && t < 9.9) && !(t >= 15 && t < 15.5) && !(t >= 17.45 && t < 17.95) && !(t >= 26.1 && t < 26.6)) $('ripple').style.opacity = 0;

  // ---------- Fire små telefoner ----------
  minis.forEach((el, i) => {
    const a = 10.35 + i * 0.55;
    const v = out(p(t, a, a + 0.55));
    // Utfordringer (i = 2) blir den store telefonen; de andre glir ut
    const leave = io(p(t, 13.1, 13.7));
    const x = -10 + i * 240;
    const y = 560 + Math.abs(i - 1.5) * 60;
    const rot = (i - 1.5) * 8;
    const sc = 0.9;
    let o = v * (1 - (i === 2 ? p(t, 13.75, 13.95) : leave));
    if (t < 10.3 || t > 14) o = 0;
    const dy = (1 - v) * 600 + (i === 2 ? 0 : leave * 300);
    el.style.opacity = o;
    el.style.transform = `translate(${x}px, ${y + dy}px) rotate(${rot * (1 - (i === 2 ? leave : 0))}deg) scale(${sc + (i === 2 ? leave * 0.25 : 0)})`;
    el.style.zIndex = i === 2 ? 5 : 1;
  });

  // ---------- Globus ----------
  {
    const v = window01(t, 19.9, 25.0, 0.5);
    $('globe').style.opacity = v * 0.9;
    const rot = t * 0.35;
    for (const d of dots) {
      const lon = d.lon + rot;
      const x = Math.cos(d.lat) * Math.sin(lon);
      const z = Math.cos(d.lat) * Math.cos(lon);
      const y = Math.sin(d.lat);
      d.el.setAttribute('cx', 450 + x * 420);
      d.el.setAttribute('cy', 450 - y * 420);
      d.el.setAttribute('opacity', z > 0 ? 0.25 + z * 0.75 : 0.06);
    }
  }

  // ---------- Emoji (kudos) ----------
  emojis.forEach((el, i) => {
    const a = 9.5 + i * 0.05;
    const v = p(t, a, a + 1.1);
    const live = t >= a && v < 1;
    el.style.opacity = live ? 1 - v * v : 0;
    const sx = 206 + 14 + shots.fire.x * K;
    const sy = 418 + 14 + shots.fire.y * K;
    el.style.left = `${sx - 48 + (rnd(i) - 0.5) * 260 * v}px`;
    el.style.top = `${sy - 60 - out(v) * (380 + rnd(i + 7) * 260)}px`;
    el.style.transform = `scale(${0.6 + out(p(t, a, a + 0.3)) * 0.6}) rotate(${(rnd(i + 3) - 0.5) * 50 * v}deg)`;
  });

  // ---------- Konfetti (vinner) ----------
  confetti.forEach((el, i) => {
    const a = 18.9 + rnd(i) * 0.15;
    const v = p(t, a, a + 2.2);
    const live = t >= a && v < 1;
    el.style.opacity = live ? 1 - Math.pow(v, 3) : 0;
    const tt = v * 2.2;
    el.style.left = `${rnd(i + 11) * 1080 + Math.sin(tt * 3 + i) * 40}px`;
    el.style.top = `${-60 - rnd(i + 21) * 400 + (500 + rnd(i + 41) * 500) * tt}px`;
    el.style.transform = `rotate(${rnd(i + 31) * 720 * tt}deg)`;
  });

  // ---------- Merket flyr ut av telefonen ----------
  {
    const b = $('badge');
    const v = out(p(t, 27.45, 28.0));
    const o = t < 27.45 || t > 28.8 ? 0 : 1 - p(t, 28.5, 28.8);
    b.style.opacity = o;
    b.querySelector('.shine').style.left = `${lerp(-200, 1100, p(t, 27.95, 28.55))}px`;
    b.style.transform = `translateY(${(1 - v) * 300}px) scale(${lerp(0.4, 1, back(v))}) rotate(${(1 - v) * -6}deg)`;
  }

  // ---------- «100 % gratis» ----------
  {
    const v = back(p(t, 30.45, 30.85));
    const o = t < 30.45 ? 0 : 1 - p(t, 31.7, 31.95);
    $('stamp').style.opacity = o;
    $('stamp').style.transform = `rotate(-8deg) scale(${lerp(2.2, 1, clamp(v, 0, 2))})`;
    $('stampSub').style.opacity = o * p(t, 30.9, 31.2);
  }

  // ---------- Slutt: logo og Log. Eat. Gain. ----------
  {
    const v = out(p(t, 35.3, 35.9));
    $('end').style.opacity = v;
    $('end').style.transform = `scale(${lerp(0.85, 1, v)})`;
    const words = $('end').querySelectorAll('.words span');
    [36.31, 37.14, 37.79].forEach((at, i) => {
      const w = back(p(t, at - 0.05, at + 0.3));
      words[i].style.opacity = clamp(w);
      words[i].style.transform = `translateY(${(1 - clamp(w)) * 40}px) scale(${lerp(0.6, 1, w)})`;
    });
  }

  caption(t, CAPTIONS);
};

window.ready = Promise.all([...document.images].map((im) => (im.complete ? Promise.resolve() : new Promise((r) => (im.onload = im.onerror = r))))).then(() => document.fonts.ready);
