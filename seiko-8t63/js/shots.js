// The film: an ordered list of shots. Each shot names the stage it plays on ('watch' or a close-up
// stage), the narration lines spoken over it (durations come from js/narration.js), a camera,
// layer visibility for watch shots, stage params, timed events and labels.
// Time references: a number is seconds into the shot (negative = from the end); 'n12' / 'n12+1.5' /
// 'n12.end-0.5' refer to the start or end of a narration line.
(function () {
const PI = Math.PI;
const ease = t => WX.ease(t);
const VIS_BACK = { bracelet: 0, case: 0.08, crown: 0.1, caseback: 0, crystal: 0, bezel: 0.18, hands: 0.2, chands: 0.2, dial: 0.2, date: 0.2, chrono: 0.25, motion: 0.25 };
const VIS_FRONT = { bracelet: 0.14, case: 0.09, crown: 0.4, crystal: 0, bezel: 0.13, dial: 0.05, date: 0.06 };
const XRAY_CHRONO = Object.assign({}, VIS_FRONT, { motion: 0.18, hands: 0.16 });
const CAM_WATCH = { t: [0, -1, 0], yaw: -0.75, pitch: 0.36, dist: 128 };
const CAM_DIAL = { t: [0, 0, 3], yaw: 0, pitch: 0.03, dist: 80 };
const CAM_CHRONO = { t: [1, 2, 3], yaw: 0.4, pitch: 0.36, dist: 80 };
const CAM_HEARTS = { t: [-3.4, 0.6, 3.2], yaw: 0.06, pitch: 0.64, dist: 42 };
const CAM_BACK = { t: [-4, -5, -3], yaw: PI + 0.42, pitch: -0.2, dist: 70 };
const lineU = (s, id) => s.t(id);

// gear-maths card for the timekeeping train; rows light up with the narration
const TRAIN_ROWS = [
  ['Rotor', '½ turn per pulse', '30 turns/min'],
  ['÷ 5', 'fifth wheel', '6 turns/min'],
  ['÷ 6', 'fourth wheel', '1 turn/min · small seconds'],
  ['÷ 8', 'third wheel', '⅛ turn/min'],
  ['÷ 7.5', 'centre wheel', '1 turn/hour'],
];
const trainCard = {
  side: 'left', at: 'n32', until: -0.4,
  html: '<div class="k">Timekeeping train · time motor</div><div class="eq">' + TRAIN_ROWS.map((r, i) => `<div data-r="${i}"><b>${r[0]}</b> <i>${r[1]}</i> → ${r[2]}</div>`).join('') + '</div><div class="fine">Tooth counts are illustrative; the overall ratios are fixed by the hands: ÷30 to the seconds, ÷60 more to the minutes.</div>',
  update(el, u, dur, W) {
    const s = SHOT_BY_ID.s23;
    const lit = u < s.t('n33') ? 0 : u < s.t('n33+4') ? 2 : u < s.t('n34') ? 2 : 4;
    el.querySelectorAll('[data-r]').forEach((d, i) => d.classList.toggle('hl', i === lit || (lit === 2 && i === 1) || (lit === 4 && i === 3)));
  },
};
const motionCard = {
  side: 'left', at: 'n36+1',
  html: '<div class="k">Motion works</div><div class="eq"><div><b>Cannon pinion</b> → 1 turn/hour · minute hand</div><div><b>÷ 12</b> <i>minute wheel + hour wheel</i> → 1 turn/12 h</div><div><b>÷ 2</b> <i>24-hour wheels</i> → 1 turn/day</div></div>',
};
const creditsCard = {
  side: 'left', at: 1.0, until: -0.2,
  html: '<div class="k">Inside the Seiko 8T63</div><div class="fine" style="font-size:12px;color:var(--soft);margin-top:8px">Sources: Seiko Cal. 8T63/8T68 instruction manual; Seiko Cal. 8T63A parts catalogue and technical guide; Seiko product data for the SSB397.<br><br>Part shapes and layout are illustrative, not a service drawing. Narration voice: Kokoro, an open-source speech model.<br><br>Independent explainer, not affiliated with Seiko.</div>',
};

window.SHOTS = [
  // ── 1 · The watch ──
  { id: 's01', chapter: 'The watch', lines: ['n01', 'n02'], lead: 1.2, camFrac: true,
    cam: [{ at: 0, t: [0, -7.6, 3.3], yaw: 0.22, pitch: 0.42, dist: 24 }, { at: 1, t: [0, -3.5, 3.3], yaw: 0.12, pitch: 0.3, dist: 44 }],
    events: [['n02+1.6', W => W.pressA()]] },
  { id: 's02', lines: ['n03', 'n04', 'n05'], cam: Object.assign({ drift: 0.03 }, CAM_WATCH), trans: 3.2,
    labels: [{ k: 'pusherA', text: 'Pusher A · start / stop', at: 'n04' }, { k: 'pusherB', text: 'Pusher B · reset', d: 1, at: 'n04+0.6' }, { k: 'crown', text: 'Crown', at: 'n04+1.2' }, { k: 'bezel', text: 'Tachymeter bezel', at: 'n03+3' }] },

  // ── 2 · Reading the dial ──
  { id: 's03', chapter: 'Reading the dial', lines: ['n06', 'n07'], cam: CAM_DIAL, trans: 2.4,
    labels: [{ k: 'subSec', text: 'Small seconds', d: 1, at: 'n06+2.2' }, { k: 'sub24', text: '24-hour hand', at: 'n06+4' }, { k: 'chronoTip', text: 'Stopwatch seconds', at: 'n07+0.4' }, { k: 'subMin', text: 'Stopwatch minutes, 0–60', at: 'n07+2.2' }, { k: 'date', text: 'Date', d: 1, at: 'n06+6' }],
    hud: { stopwatch: 1 } },
  { id: 's04', lines: ['n08'], cam: { t: [0, 9, 3.3], yaw: 0, pitch: 0.08, dist: 40 }, trans: 2.0, extra: 1.2, hud: { stopwatch: 1 } },

  // ── 3 · Opening the case ──
  { id: 's05', chapter: 'Opening the case', lines: ['n09', 'n10'], lead: 1.0, extra: 1.0,
    cam: Object.assign({ drift: 0.012 }, { t: [0, 0, 4], yaw: 1.14, pitch: 0.3, dist: 160 }), trans: 3.0,
    ex: (u, d) => ease((u - 0.4) / 5.5), vis: { bracelet: 0, case: 0.12, crown: 0.12 },
    labels: [['L_crystal', 'Crystal'], ['L_bezel', 'Bezel', 1], ['L_hands', 'Hands'], ['L_dial', 'Dial', 1], ['L_date', 'Date ring'], ['L_chrono', 'Stopwatch works', 1], ['L_motion', 'Motion works'], ['L_plate', 'Main plate', 1], ['L_drive', 'Motors + gear trains'], ['L_circuit', 'Circuit block', 1], ['L_battery', 'Battery'], ['L_caseback', 'Case back', 1]]
      .map((l, i) => ({ k: l[0], text: l[1], d: l[2] || 0, at: `n10+${(i * 0.85).toFixed(2)}`, minor: [0, 1, 4, 6, 10].includes(i) ? 1 : 0 })) },

  // ── 4 · Power ──
  { id: 's06', stage: 'battery', chapter: 'Power', lines: ['n11'], cam: 'cell', drift: { yaw: 0.04 }, p: { mode: 'cell' },
    events: [[0.3, W => W.pressA()], [1.4, W => W.pressB()]] },
  { id: 's06b', stage: 'battery', lines: ['n12'], cam: 'cutaway', p: { mode: 'reaction' }, trans: 1.6 },
  { id: 's07', stage: 'battery', lines: ['n13'], cam: 'side', p: { mode: 'curve' }, trans: 1.4 },
  { id: 's08', stage: 'battery', lines: ['n14', 'n15'], cam: 'side', p: { mode: 'budget' }, trans: 1.0, extra: 1.0 },

  // ── 5 · The quartz crystal ──
  { id: 's09', stage: 'quartz', chapter: 'The quartz crystal', lines: ['n16'], cam: 'can', p: { mode: 'can' }, extra: 1.5 },
  { id: 's10', stage: 'quartz', lines: ['n17'], cam: 'lattice', p: { mode: 'lattice' }, extra: 2.0 },
  { id: 's11', stage: 'quartz', lines: ['n18', 'n18b'], cam: 'fork', p: { mode: 'fork' }, extra: 1.0 },
  { id: 's12', stage: 'quartz', lines: ['n19', 'n20'], cam: 'circuit', p: { mode: 'oscillator' } },
  { id: 's13', stage: 'quartz', lines: ['n21'], cam: 'circuit', p: { mode: 'temperature' }, extra: 1.0 },

  // ── 6 · The chip ──
  { id: 's14', stage: 'chip', chapter: 'The chip', lines: ['n22'], cam: ['board', 'die'], p: { mode: 'board' }, extra: 1.5 },
  { id: 's15', stage: 'chip', lines: ['n23', 'n23b'], cam: 'divider', p: { mode: 'divider' }, extra: 1.0 },
  { id: 's16', stage: 'chip', lines: ['n24'], cam: 'driver', p: { mode: 'driver' }, extra: 1.0 },
  { id: 's17', stage: 'chip', lines: ['n25', 'n25b'], cam: 'logic', p: (u, d, s) => ({ mode: 'stopwatch', pressAt: s.t('n25+3.5'), stopAt: d - 1.6 }), extra: 1.0,
    card: { side: 'right', at: 'n25b', html: '<div class="k">One fifth of a second</div><div class="eq"><div>32,768 ÷ 5 = <b>6,553.6</b> cycles</div><div><i>gaps:</i> 6,554 · 6,554 · 6,554 · 6,554 · <b>6,552</b></div><div><i>total:</i> 32,768 cycles = 1 s</div></div><div class="fine">One possible pattern; the chip\'s actual sequence isn\'t published.</div>' } },

  // ── 7 · The stepping motor ──
  { id: 's18', stage: 'motor', chapter: 'The stepping motor', lines: ['n26'], cam: 'overview', drift: { yaw: 0.02 }, p: { mode: 'overview' },
    labels: [{ k: 'motor:coil', text: 'Coil', at: 'n26+8' }, { k: 'motor:stator', text: 'Stator', at: 'n26+10' }, { k: 'motor:rotor', text: 'Rotor (magnet)', d: 1, at: 'n26+12' }] },
  { id: 's19', stage: 'motor', lines: ['n27'], cam: 'bore', p: { mode: 'rest' }, extra: 0.8,
    labels: [{ k: 'motor:notch', text: 'Notch', at: 'n27+6' }] },
  { id: 's20', stage: 'motor', lines: ['n28', 'n29'], cam: 'bore', p: (u, d, s) => ({ mode: 'pulse', count: 4, at: s.t('n28+3.0'), interval: (s.t('n29.end') - s.t('n28+3.0')) / 3.2, pol: 1 }), extra: 1.0,
    sfx: s => { const p = s.p(0, s.dur, s); return Array.from({ length: p.count }, (_, k) => ({ u: p.at + k * p.interval, type: 'pulse' })); } },
  { id: 's21', stage: 'motor', lines: ['n30'], cam: 'bore', p: (u, d, s) => ({ mode: 'wrong', at: 0.6, interval: s.t('n30+6.5') - 0.6 }), extra: 1.5,
    sfx: s => { const p = s.p(0, s.dur, s); return [{ u: p.at, type: 'pulse' }, { u: p.at + p.interval, type: 'pulse', gain: 0.6 }]; } },
  { id: 's22', stage: 'motor', lines: ['n31'], cam: 'twin', p: { mode: 'twin' }, extra: 1.5,
    sfx: s => { const out = []; for (let u = 0.45; u < s.dur; u += 1.0) out.push({ u, type: 'tick', gain: 1.0 }); for (let u = 0.25; u < s.dur; u += 0.2) out.push({ u, type: 'tick', gain: 0.45 }); return out; } },

  // ── 8 · From steps to hands ──
  { id: 's23', chapter: 'From steps to hands', lines: ['n32', 'n33', 'n34'], cam: Object.assign({ drift: 0.01 }, CAM_BACK), ex: 0.3,
    vis: Object.assign({}, VIS_BACK, { circuit: 0.08, battery: 0.2 }), card: trainCard, hud: { scope: 1 },
    labels: [{ k: 'rotorA', text: 'Time motor rotor', d: 1, at: 'n32+0.5' }, { k: 'fifth', text: 'Fifth wheel', at: 'n33+0.8' }, { k: 'fourth', text: 'Fourth wheel · small seconds', d: 1, at: 'n33+2.2' }, { k: 'third', text: 'Third wheel', at: 'n34' }, { k: 'center', text: 'Centre wheel · minutes', at: 'n34+1.5' }] },
  { id: 's24', lines: ['n35'], cam: Object.assign({ drift: -0.02 }, CAM_BACK, { dist: 62 }), ex: 0.3, trans: 2,
    vis: Object.assign({}, VIS_BACK, { circuit: 0.08, battery: 0.2 }), ctl: u => (u > 1.5 ? { rate: 60, badge: 'Time-lapse ×60' } : {}), hud: { scope: 1 }, extra: 1.0 },

  // ── 9 · Minutes, hours and a friction fit ──
  { id: 's25', chapter: 'Minutes, hours and a friction fit', lines: ['n36'], cam: { t: [2.6, 0, 3], yaw: 0.1, pitch: 0.24, dist: 58 }, ex: 0.32,
    vis: Object.assign({}, VIS_FRONT, { chrono: 0.08, chands: 0.12, motion: 1 }), card: motionCard, extra: 1.0,
    ctl: u => (u > 1.5 ? { rate: 600, badge: 'Time-lapse ×600' } : {}),
    labels: [{ k: 'cannon', text: 'Cannon pinion', at: 'n36+1' }, { k: 'minuteWheel', text: 'Minute wheel', d: 1, at: 'n36+4' }, { k: 'hourWheel', text: 'Hour wheel', d: 1, at: 'n36+5.5' }, { k: 'wheel24', text: '24-hour wheel', at: 'n36+9' }] },
  { id: 's26', stage: 'keyless', lines: ['n37'], cam: 'friction', p: { mode: 'friction' }, extra: 1.5 },

  // ── 10 · The date ──
  { id: 's27', stage: 'calendar', chapter: 'The date', lines: ['n38', 'n39'], cam: ['overview', 'finger'], camAt: [0, 0.35], p: { mode: 'day', h0: 20.0, h1: 24.6 }, extra: 1.5 },
  { id: 's28', stage: 'calendar', lines: ['n40'], cam: 'overview', p: { mode: 'danger' }, extra: 1.0 },

  // ── 11 · The crown ──
  { id: 's29', stage: 'keyless', chapter: 'The crown', lines: ['n41'], cam: 'overview', p: { mode: 'positions' }, extra: 2.0,
    sfx: s => [0.15, 0.45, 0.85].map(f => ({ u: f * s.dur, type: 'crown' })) },
  { id: 's30', stage: 'keyless', lines: ['n42'], cam: 'wheels', p: { mode: 'date' }, extra: 1.5 },
  { id: 's31', stage: 'keyless', lines: ['n43', 'n44'], cam: 'wheels', p: { mode: 'time' }, extra: 1.0 },
  { id: 's31b', lines: ['n45'], lead: 1.4, extra: 2.6, cam: CAM_DIAL, fadeOut: 0.45,
    events: [[0.1, W => W.pressA()], [1.0, W => { W.S.crownPos = 2; }], [-0.6, W => { W.S.crownPos = 0; }], [-0.35, W => W.pressA()]],
    labels: [{ k: 'subSec', text: 'Small seconds: stopped', d: 1, at: 1.4 }, { k: 'chronoTip', text: 'Stopwatch: still running', at: 1.8 }, { k: 'crown', text: 'Crown at 2nd click', at: 1.2 }], hud: { stopwatch: 1 } },

  // ── 12 · Starting the stopwatch ──
  { id: 's32', chapter: 'Starting the stopwatch', lines: ['n46', 'n47'], cam: CAM_CHRONO, ex: 0.28, vis: XRAY_CHRONO, cut: true, fadeIn: 0.45,
    events: [[0.05, W => W.pressB()], ['n46+3.2', W => W.pressA()]],
    labels: [{ k: 'pusherA', text: 'Pusher A', at: 'n46' }, { k: 'switchA', text: 'Switch lever A', at: 'n46+2.4' }, { k: 'rotorB', text: 'Stopwatch motor rotor', d: 1, at: 'n46+5.5' }, { k: 'B1', text: 'Intermediate wheels', d: 1, at: 'n47+3' }, { k: 'CS', text: 'Stopwatch seconds wheel', d: 1, at: 'n47+5' }],
    hud: { stopwatch: 1, scope: 1 } },
  { id: 's33', lines: ['n48', 'n49'], cam: Object.assign({}, CAM_CHRONO, { yaw: 0.3 }), ex: 0.28, vis: XRAY_CHRONO, trans: 1.5, extra: 4.5,
    events: [['n48+5.2', W => W.pressA()], ['n48+7.6', W => W.pressA()]],
    ctl: (u, d, s) => (u >= s.t('n49') - 0.4 ? { rate: 600, badge: 'Time-lapse ×600' } : u > 0.5 && u < s.t('n48+5') ? { rate: 40, badge: 'Time-lapse ×40' } : {}),
    labels: [{ k: 'MC', text: 'Minute counter wheel', at: 'n48+0.5' }, { k: 'subMin', text: '60-minute counter', d: 1, at: 'n48+1.5' }],
    hud: { stopwatch: 1, scope: 1 } },

  // ── 13 · Hammer and heart ──
  { id: 's34', stage: 'heart', chapter: 'Hammer and heart', lines: ['n50'], cam: 'cam', p: { mode: 'profile' }, extra: 1.0,
    // off screen: leave the stopwatch stopped at 2:37.4 so the reset in s38 shows one hand flying forward and one back
    events: [[0.2, W => { W.S.running = false; W.S.chrono = 787; W.S.reset = null; W.S.accB = 0; }]] },
  { id: 's35', stage: 'heart', lines: ['n51'], cam: 'cam', p: { mode: 'force', theta0: 130 }, extra: 2.0 },
  { id: 's36', stage: 'heart', lines: ['n52'], cam: 'both', p: { mode: 'both' }, extra: 2.0 },
  { id: 's37', stage: 'heart', lines: ['n53'], cam: 'linkage', p: { mode: 'linkage' }, extra: 1.5 },
  { id: 's38', lines: ['n54'], cam: CAM_HEARTS, ex: 0.28, vis: Object.assign({}, VIS_FRONT, { motion: 0.1, hands: 0.12 }), extra: 7.0,
    events: [['n54+1.2', W => W.pressB(0.01)]],
    ctl: (u, d, s) => (u > s.t('n54+1.0') && u < d - 0.6 ? { slow: 0.01, badge: 'Slow motion · 1/100 speed' } : {}),
    labels: [{ k: 'hammer', text: 'Hammer', at: 0.6 }, { k: 'heartCS', text: 'Heart cam · seconds', at: 1.0 }, { k: 'heartMC', text: 'Heart cam · minutes', d: 1, at: 1.4 }],
    hud: { stopwatch: 1 } },

  // ── 14 · The whole machine ──
  { id: 's39', chapter: 'The whole machine', lines: ['n55', 'n56'], cam: Object.assign({ drift: 0.03 }, { t: [4, -1, 0], yaw: -0.5, pitch: 0.3, dist: 132 }), trans: 3.0, extra: 2.5, hud: { specs: 1 } },
  { id: 's40', minDur: 7, cam: Object.assign({ drift: 0.03 }, { t: [9, -1, 0], yaw: -0.15, pitch: 0.3, dist: 140 }), trans: 2.0, card: creditsCard, fadeOut: 1.4 },
];
const SHOT_BY_ID = {}; window.SHOTS.forEach(s => { SHOT_BY_ID[s.id] = s; });

document.getElementById('specList').innerHTML = [
  ['Type', 'Quartz chronograph, mechanical reset'], ['Oscillator', '32,768 Hz quartz tuning fork'], ['Motors', '2 Lavet stepping motors'],
  ['Stopwatch', '1/5 s steps, up to 60 min, stops by itself'], ['Reset', 'One-piece hammer, two heart cams'], ['Accuracy', '±15 s per month (5–35 °C)'],
  ['Current', 'under 2.7 µA'], ['Battery', 'SR936SW, about 3 years'], ['Movement', '30.8 mm across, 5.1 mm high, 0 jewels'], ['Case 00T0', 'SSB397, 41 mm steel, 100 m'],
].map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('');
})();
