// Tar opp skjermbildene til reklamefilmen fra den ekte appen (engelsk, demokonto med falsk Sosialt-data).
//   npm run build && node scripts/ad/capture.mjs <ut-mappe>
// Skriver <ut-mappe>/*.png (1170 × 2532, iPhone 13 × 3) og <ut-mappe>/shots.json (posisjoner for «trykk»).
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium, devices } = pw;

const OUT = process.argv[2] ?? 'ad-shots';
mkdirSync(OUT, { recursive: true });
const PORT = 4191;
const URL = `http://localhost:${PORT}/`;
const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => d.toString().includes('Local') && res());
  setTimeout(() => rej(new Error('preview startet ikke')), 15000);
});

const browser = await chromium.launch();
// Hele iPhone 13-skjermen (390 × 844), ikke bare nettleserens synlige del, så appen fyller telefonen i filmen.
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'en-GB' });
await ctx.addInitScript(() => {
  localStorage.setItem('repgrade-skip-intro', '1');
  localStorage.setItem('gym-lang', 'en');
  localStorage.setItem('repgrade-social-fake', '1');
  localStorage.setItem('repgrade-seen-version', '9.9.9');
  localStorage.setItem('gym-install-hint-dismissed', '1');
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ released: false, release: async () => {} }) } });
});
const page = await ctx.newPage();
const btn = (name, opts = {}) => page.getByRole('button', { name, ...opts });
const nav = () => page.getByRole('navigation', { name: 'Main menu' });
const meta = {};
const box = async (locator) => {
  const b = await locator.boundingBox();
  return b && { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};
const settle = () => page.waitForTimeout(600);
async function shot(name, opts = {}) {
  await settle();
  // Helsides-bilder: skjul den faste bunnmenyen og toppen (de legges over i filmen), ellers havner de midt i lista.
  if (opts.fullPage) await page.addStyleTag({ content: '.fixed.inset-x-0.bottom-0, header.sticky { visibility: hidden !important; }' });
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  if (opts.fullPage) await page.reload();
  console.log('·', name);
}

const H = 3_600_000;
const D = 24 * H;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

try {
  // ---------- Konto og onboarding (engelsk) ----------
  await page.goto(URL);
  await btn('Create account').click();
  await page.getByLabel('Name').fill('Alex');
  await page.getByLabel('Email').fill('alex@example.com');
  await page.getByLabel('Password (at least 8 characters)').fill('Strong-password-26');
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();
  await page.getByText(/^Hi, Alex$/).waitFor();
  await btn('Continue').click();
  await page.getByRole('radio', { name: /Get stronger/ }).click();
  await btn('Continue').click();
  await page.getByRole('radio', { name: /^3/ }).click();
  await btn('Continue').click();
  await page.locator('#ob-bodyweight').fill('82');
  await btn('Continue').click();
  await page.getByRole('radio', { name: /^Full body A\/B / }).click();
  await btn('Start training').click();
  await page.getByText('Muscles trained').waitFor();
  // Kontotype-valget: Alex starter som treningskonto (byttes til Sosial senere i opptaket)
  await page.getByRole('dialog', { name: 'Choose your account type' }).getByRole('button', { name: /^Training/ }).click();

  // ---------- Alex sine økter (rett i den lokale databasen) ----------
  const me = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).find((n) => n?.startsWith('gym-') && n !== 'gym-none').slice(4));
  const workouts = [
    { name: 'Push day', ago: 3 * D, mins: 58, ex: [['ex-benkpress', [[85, 6], [90, 5], [90, 5]]], ['ex-militaerpress', [[55, 6], [55, 6]]], ['ex-triceps-pushdown', [[35, 10], [35, 10]]]] },
    { name: 'Pull day', ago: 2 * D, mins: 52, ex: [['ex-stangroing', [[75, 8], [75, 8], [75, 7]]], ['ex-nedtrekk', [[70, 10], [70, 9]]], ['ex-bicepscurl-med-manualer', [[16, 10], [16, 10]]]] },
    { name: 'Leg day', ago: 1 * D, mins: 64, ex: [['ex-kneboy', [[110, 5], [120, 5], [120, 5]]], ['ex-markloft', [[150, 5], [150, 5]]], ['ex-rumensk-markloft', [[100, 8], [100, 8]]]] },
  ];
  await page.evaluate(async ({ me, workouts }) => {
    const name = `gym-${me}`;
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const now = new Date().toISOString();
    const row = (x) => ({ ...x, updated_at: now, deleted: 0, dirty: 1 });
    const tx = db.transaction(['workouts', 'workout_exercises', 'sets'], 'readwrite');
    for (const w of workouts) {
      const wid = crypto.randomUUID();
      const start = Date.now() - w.ago;
      tx.objectStore('workouts').put(row({ id: wid, routine_id: null, name: w.name, started_at: new Date(start).toISOString(), ended_at: new Date(start + w.mins * 60000).toISOString(), notes: '' }));
      let minute = 2;
      w.ex.forEach(([exId, sets], p) => {
        const weId = crypto.randomUUID();
        tx.objectStore('workout_exercises').put(row({ id: weId, workout_id: wid, exercise_id: exId, position: p, rest_seconds: 120, notes: '', target_reps: null }));
        sets.forEach(([kg, reps], i) => {
          minute += 4;
          tx.objectStore('sets').put(row({ id: crypto.randomUUID(), workout_exercise_id: weId, workout_id: wid, exercise_id: exId, position: i, weight: kg, reps, set_type: 'normal', completed_at: new Date(start + minute * 60000).toISOString() }));
        });
      });
    }
    await new Promise((res) => (tx.oncomplete = res));
    db.close();
  }, { me, workouts });

  // ---------- Venner, aktivitet, tavler, utfordringer, merker (falsk Sosialt) ----------
  const people = [
    ['markus', 'Markus', '#4d9bf0', 3, 6, 64.2], ['sofia', 'Sofia', '#ec6fa8', 3, 6, 61.8], ['jonas', 'Jonas', '#f08a3c', 2, 5, 55.1],
    ['yuki', 'Yuki', '#9b87f5', 3, 8, 86.4], ['mateo', 'Mateo', '#e8c547', 3, 8, 83.9], ['amara', 'Amara', '#34c56a', 2, 7, 78.2],
    ['lukas', 'Lukas', '#ef5f5f', 3, 7, 74.6], ['chloe', 'Chloé', '#4d9bf0', 2, 7, 71.3], ['aarav', 'Aarav', '#f08a3c', 3, 6, 68.9],
    ['ingrid', 'Ingrid', '#ec6fa8', 2, 6, 66.0], ['diego', 'Diego', '#e8c547', 3, 6, 63.5], ['emma', 'Emma', '#9b87f5', 2, 5, 58.7],
    ['noah', 'Noah', '#34c56a', 3, 5, 52.4], ['lea', 'Lea', '#ef5f5f', 1, 4, 44.0],
  ];
  const prof = ([handle, display, color, visibility, tier, score]) => ({
    user_id: `${handle}-id`, handle, display_name: display, color, visibility, is_16_plus: true, active: true, tier_index: tier, score,
    lift_scores: {}, share_from: iso(40 * D), created_at: iso(40 * D), updated_at: iso(D),
  });
  const exData = (list) => list.map(([exercise_id, name, muscle_group, sets]) => ({ exercise_id, name, kind: 'weight', muscle_group, sets: sets.map(([weight, reps, extra]) => ({ weight, reps, set_type: 'normal', ...(extra ?? {}) })) }));
  const activity = (user, id, name, agoMs, mins, exercises, extra = {}) => {
    const sets = exercises.reduce((n, e) => n + e.sets.length, 0);
    const volume = exercises.reduce((v, e) => v + e.sets.reduce((s, x) => s + x.weight * x.reps, 0), 0);
    return {
      user_id: user, id, name, started_at: iso(agoMs), ended_at: iso(agoMs - mins * 60000), created_at: iso(agoMs), updated_at: iso(agoMs),
      data: { version: 1, duration_s: mins * 60, sets, reps: exercises.reduce((n, e) => n + e.sets.reduce((s, x) => s + x.reps, 0), 0), volume_kg: volume, exercises, records: [], muscles: {}, lifts: {}, tier: extra.tier ?? null, ...extra },
    };
  };
  const store = {
    profiles: [
      { user_id: me, handle: 'alex', display_name: 'Alex', color: '#34c56a', visibility: 3, is_16_plus: true, active: true, tier_index: null, score: null, lift_scores: {}, share_from: iso(30 * D), created_at: iso(30 * D), updated_at: iso(D) },
      ...people.map(prof),
    ],
    follows: [
      ...['markus', 'sofia', 'jonas'].flatMap((h) => [
        { follower: me, followee: `${h}-id`, status: 'accepted', created_at: iso(20 * D), accepted_at: iso(20 * D) },
        { follower: `${h}-id`, followee: me, status: 'accepted', created_at: iso(20 * D), accepted_at: iso(20 * D) },
      ]),
      { follower: 'lea-id', followee: me, status: 'pending', created_at: iso(H), accepted_at: null },
    ],
    blocks: [], reports: [], reactions: [], members: [], notifications: [], badges: [],
    activities: [
      activity('markus-id', 'm1', 'Push day 💥', 2 * H, 61, exData([
        ['ex-benkpress', 'Benkpress', 'Bryst', [[60, 10], [100, 5], [105, 4, { pr: true }], [100, 5]]],
        ['ex-skrabenk-med-manualer', 'Skråbenk med manualer', 'Bryst', [[34, 10], [34, 9], [34, 8]]],
        ['ex-sidehev', 'Sidehev', 'Skuldre', [[12, 15], [12, 14], [12, 12]]],
        ['ex-triceps-pushdown', 'Triceps pushdown', 'Triceps', [[40, 12], [40, 11]]],
      ]), { tier: { index: 6, score: 64.2 } }),
      activity('sofia-id', 's1', 'Legs + core', 7 * H, 55, exData([
        ['ex-kneboy', 'Knebøy', 'Bein', [[80, 8], [90, 6], [90, 6]]],
        ['ex-hip-thrust', 'Hip thrust', 'Rumpe', [[120, 10], [120, 10]]],
        ['ex-planke', 'Planke', 'Mage', []],
      ].filter((e) => e[3].length)), { tier: { index: 6, score: 61.8 } }),
      activity('jonas-id', 'j1', 'Back & biceps', 26 * H, 48, exData([
        ['ex-pull-ups', 'Pull-ups', 'Rygg', [[0, 10], [0, 9], [0, 8]]],
        ['ex-stangroing', 'Stangroing', 'Rygg', [[70, 8], [70, 8]]],
      ]), { tier: { index: 5, score: 55.1 } }),
      // Markus i knebøy-utfordringen (når ikke 140)
      activity('markus-id', 'm0', 'Leg day', 2 * D, 50, exData([['ex-kneboy', 'Knebøy', 'Bein', [[110, 5], [115, 4]]]]), { lifts: { 'ex-kneboy': 130.3 } }),
    ],
    challenges: [
      { id: 'goal-squat', creator: me, kind: 'goal', exercise_id: 'ex-kneboy', target: 140, title: 'First to 140 kg squat', starts_at: iso(3 * D), ends_at: iso(-4 * D), created_at: iso(3 * D) },
      { id: 'most-workouts', creator: 'sofia-id', kind: 'workouts', exercise_id: null, target: null, title: 'Most workouts – 2 weeks', starts_at: iso(5 * D), ends_at: iso(-9 * D), created_at: iso(5 * D) },
      { id: 'weekly-jonas', creator: 'jonas-id', kind: 'weekly', exercise_id: null, target: 3, title: 'Three a week', starts_at: iso(H), ends_at: iso(-30 * D), created_at: iso(H) },
    ],
  };
  store.members.push(
    { challenge_id: 'goal-squat', user_id: me, status: 'joined', invited_at: iso(3 * D), joined_at: iso(3 * D) },
    { challenge_id: 'goal-squat', user_id: 'markus-id', status: 'joined', invited_at: iso(3 * D), joined_at: iso(3 * D) },
    { challenge_id: 'most-workouts', user_id: 'sofia-id', status: 'joined', invited_at: iso(5 * D), joined_at: iso(5 * D) },
    { challenge_id: 'most-workouts', user_id: me, status: 'joined', invited_at: iso(5 * D), joined_at: iso(5 * D) },
    { challenge_id: 'weekly-jonas', user_id: 'jonas-id', status: 'joined', invited_at: iso(H), joined_at: iso(H) },
    { challenge_id: 'weekly-jonas', user_id: me, status: 'invited', invited_at: iso(H), joined_at: null },
  );
  store.badges.push(
    { id: 'b1', user_id: me, kind: 'board', ref: 'b1', title: null, board: 'level', tier_index: 6, period: '2026-10-01', awarded_at: iso(27 * D) },
    { id: 'b2', user_id: me, kind: 'challenge', ref: 'b2', title: 'Bench battle', board: null, tier_index: null, period: null, awarded_at: iso(12 * D) },
  );
  const note = (id, kind, actor, payload, ago) => ({ id, user_id: me, kind, actor, payload, read_at: null, created_at: iso(ago) });
  store.notifications.push(
    note('n1', 'badge', null, { badge_kind: 'board', board: 'level', tier_index: 6, period: '2026-11' }, 20 * 60000),
    note('n2', 'reaction', 'markus-id', { activity_id: 'x', emoji: '🔥' }, 40 * 60000),
    note('n3', 'challenge_invite', 'jonas-id', { challenge_id: 'weekly-jonas', title: 'Three a week' }, H),
    note('n4', 'follow_request', 'lea-id', {}, H + 60000),
  );
  await page.evaluate((s) => localStorage.setItem('repgrade-fake-social', JSON.stringify(s)), store);

  // ---------- Hjem (før Sosialt er slått på) ----------
  await page.reload();
  await page.getByText('Muscles trained').waitFor();
  await shot('home-training');
  meta.navSocialSlot = await box(nav().getByRole('link', { name: 'History' }));

  // Slå på Sosialt: Profil → Kontotype → Sosial
  await nav().getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('radio', { name: /^Social/ }).click();
  await page.getByRole('tab', { name: 'Feed' }).waitFor();
  // Vent til Alex sine økter er publisert og nivået er regnet ut
  const fake = () => page.evaluate(() => JSON.parse(localStorage.getItem('repgrade-fake-social')));
  for (let i = 0; i < 60; i++) {
    const s = await fake();
    const alex = s.profiles.find((p) => p.user_id === me);
    if (alex.tier_index !== null && s.activities.filter((a) => a.user_id === me).length >= 3) break;
    await page.waitForTimeout(250);
  }
  // Kudos på Alex sine økter, og gjør Alex til vinner av knebøy-utfordringen
  {
    const s = await fake();
    const mine = s.activities.filter((a) => a.user_id === me).sort((a, b) => b.started_at.localeCompare(a.started_at));
    for (const [who, emoji] of [['markus-id', '🔥'], ['sofia-id', '💪'], ['jonas-id', '👏']]) s.reactions.push({ activity_owner: me, activity_id: mine[0].id, user_id: who, emoji, created_at: iso(H) });
    s.reactions.push({ activity_owner: 'markus-id', activity_id: 'm1', user_id: 'sofia-id', emoji: '💪', created_at: iso(H) }, { activity_owner: 'markus-id', activity_id: 'm1', user_id: 'jonas-id', emoji: '🏆', created_at: iso(H) });
    const alex = s.profiles.find((p) => p.user_id === me);
    console.log('Alex:', alex.tier_index, alex.score, 'økter', mine.length, 'knebøy', mine.find((a) => a.data.lifts['ex-kneboy'])?.data.lifts['ex-kneboy']);
    await page.evaluate((st) => localStorage.setItem('repgrade-fake-social', JSON.stringify(st)), s);
  }
  await page.goto(URL + '#/');
  await page.getByText('Muscles trained').waitFor();
  await shot('home-social');
  meta.navSocial = await box(nav().getByRole('link', { name: /Social/ }));

  // ---------- Sosialt: profil og feed ----------
  await nav().getByRole('link', { name: /Social/ }).click();
  await page.getByRole('tab', { name: 'Feed' }).click();
  await page.locator('[data-activity="m1"]').waitFor();
  await shot('social-top');
  await shot('social-full', { fullPage: true });
  // Markus sitt kort øverst, før og etter 🔥
  await page.locator('[data-activity="m1"]').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
  await shot('feed-markus');
  meta.fire = await box(page.locator('[data-activity="m1"]').getByRole('button', { name: /^🔥/ }));
  await page.locator('[data-activity="m1"]').getByRole('button', { name: /^🔥/ }).click();
  await page.locator('[data-activity="m1"]').getByRole('button', { name: '🔥 1', pressed: true }).waitFor();
  await shot('feed-markus-fire');

  // ---------- Fanene (til «a whole lineup of new features») ----------
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('tab', { name: 'People' }).click();
  await page.getByText('Open accounts, most recently active first.').waitFor();
  await shot('tab-people');
  await page.getByRole('tab', { name: 'Top' }).click();
  await page.getByRole('list', { name: 'Strongest' }).waitFor();
  await shot('tab-top');
  await shot('top-full', { fullPage: true });
  meta.myLevel = await box(btn('My level'));
  await btn('My level').click();
  await page.getByText(/Only people at your level/).waitFor();
  await shot('top-mylevel');
  await btn('Everyone').click();
  await page.getByRole('tab', { name: 'Challenges' }).click();
  await btn('New challenge').waitFor();
  await shot('tab-challenges');
  meta.newChallenge = await box(btn('New challenge'));
  await page.goto(URL + '#/inbox');
  await page.reload();
  await page.getByRole('list', { name: 'Notifications' }).waitFor({ timeout: 60000 });
  await shot('inbox');

  // ---------- Ny utfordring: Først til 140 kg knebøy, inviter Markus ----------
  await page.goto(URL + '#/social');
  await page.getByRole('tab', { name: 'Challenges' }).click();
  await btn('New challenge').click();
  await page.getByText('What are you competing in?').waitFor();
  await shot('sheet-empty');
  await page.getByRole('combobox').selectOption({ label: 'Squat' });
  for (let i = 0; i < 16; i++) await btn('Target weight plus').click();
  await page.getByLabel('Invite Markus').check();
  await page.getByRole('dialog').evaluate((el) => el.querySelector('.overflow-y-auto')?.scrollTo(0, 0));
  await shot('sheet-filled');
  meta.sendChallenge = await box(btn('Send challenge'));
  meta.inviteMarkus = await box(page.getByLabel('Invite Markus'));
  await page.keyboard.press('Escape');

  // ---------- Utfordringen: Alex nådde målet først ----------
  await page.goto(URL + '#/challenge/goal-squat');
  await page.getByText(/reached the goal first/).waitFor();
  await shot('challenge-won');

  // ---------- Nivåsiden og delekort ----------
  await page.goto(URL + '#/level');
  await page.getByText('How the levels work ↓').waitFor();
  await shot('level');
  await page.goto(URL + '#/social');
  await page.getByRole('list', { name: 'Badges' }).waitFor();
  meta.badges = await box(page.getByRole('list', { name: 'Badges' }));
  await shot('social-badges');
  // Delekort fra siste økt
  const lastId = await page.evaluate(async (me) => {
    const db = await new Promise((res) => { const r = indexedDB.open(`gym-${me}`); r.onsuccess = () => res(r.result); });
    const all = await new Promise((res) => { const q = db.transaction('workouts').objectStore('workouts').getAll(); q.onsuccess = () => res(q.result); });
    db.close();
    return all.filter((w) => w.ended_at && !w.deleted).sort((a, b) => b.started_at.localeCompare(a.started_at))[0].id;
  }, me);
  await page.goto(URL + `#/history/${lastId}`);
  await btn('Share workout').first().click();
  const shareDialog = page.getByRole('dialog', { name: 'Share workout' });
  await shareDialog.getByRole('img', { name: /Share card/ }).waitFor();
  await shareDialog.getByRole('button', { name: /^Highlights/ }).click().catch(() => {});
  await page.waitForTimeout(800);
  await shot('share');
  meta.viewport = { w: 390, h: 844, dpr: 3 };
  writeFileSync(`${OUT}/shots.json`, JSON.stringify(meta, null, 2));
  console.log('✓ Skjermbilder i', OUT);
} catch (e) {
  await page.screenshot({ path: `${OUT}/FEIL.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
  server.kill();
}
