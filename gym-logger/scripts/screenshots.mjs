// Lager rene skjermbilder til manifestet og landingssiden fra en demokonto med realistiske data.
//   npm run build && node scripts/screenshots.mjs
// Resultat: public/screenshots/<navn>-<nb|en>.webp (540×919) og share-<nb|en>.webp.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const PORT = 4191;
const BASE = `http://localhost:${PORT}/`;
const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => server.stdout.on('data', (d) => d.toString().includes('Local') && res()));

// ---------- Demodata: fire uker med fullkroppsøkter som går jevnt oppover ----------
const DAY = 86_400_000;
const iso = (t) => new Date(t).toISOString();
const id = (() => {
  let n = 0;
  return (p) => `${p}-demo-${++n}`;
})();
function demoBackup() {
  const now = Date.now();
  const tables = { workouts: [], workout_exercises: [], sets: [], bodyweights: [] };
  const A = [['ex-kneboy', 90, 5], ['ex-benkpress', 72.5, 5], ['ex-stangroing', 65, 8], ['ex-sidehev', 10, 12]];
  const B = [['ex-markloft', 120, 5], ['ex-militaerpress', 45, 6], ['ex-pull-ups', 0, 8], ['ex-bicepscurl-med-manualer', 14, 10]];
  const sessions = 11;
  for (let i = 0; i < sessions; i++) {
    const daysAgo = Math.round((sessions - i) * 2.5) + 1;
    const start = now - daysAgo * DAY + 17 * 3600_000;
    const plan = i % 2 ? B : A;
    const w = { id: id('w'), routine_id: null, name: i % 2 ? 'Fullkropp B' : 'Fullkropp A', started_at: iso(start), ended_at: iso(start + 58 * 60_000), notes: '', updated_at: iso(start + 58 * 60_000), deleted: 0 };
    tables.workouts.push(w);
    plan.forEach(([ex, kg, reps], pos) => {
      const we = { id: id('we'), workout_id: w.id, exercise_id: ex, position: pos, rest_seconds: 120, notes: '', target_reps: reps, updated_at: w.updated_at, deleted: 0 };
      tables.workout_exercises.push(we);
      const weight = kg ? kg + Math.floor(i / 2) * (kg > 50 ? 2.5 : 1) : 0;
      for (let s = 0; s < 3; s++) {
        const done = start + (pos * 3 + s + 1) * 4 * 60_000;
        tables.sets.push({ id: id('s'), workout_exercise_id: we.id, workout_id: w.id, exercise_id: ex, position: s, weight, reps, set_type: 'normal', completed_at: iso(done), updated_at: iso(done), deleted: 0 });
      }
    });
  }
  for (let d = 28; d >= 0; d -= 7) tables.bodyweights.push({ id: id('bw'), date: iso(now - d * DAY), weight_kg: 81.5 - (28 - d) * 0.04, updated_at: iso(now - d * DAY), deleted: 0 });
  return { app: 'repgrade', version: 2, exported_at: iso(now), tables, kv: [] };
}

const sharp = async (page, name) => {
  await page.waitForTimeout(500);
  return page.screenshot({ path: name });
};

const browser = await chromium.launch();
const tmp = await mkdtemp(join(tmpdir(), 'shots-'));
const backupPath = join(tmp, 'demo.json');
await writeFile(backupPath, JSON.stringify(demoBackup()));
const out = [];

for (const lang of ['nb', 'en']) {
  const T = (nb, en) => (lang === 'nb' ? nb : en);
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: lang === 'nb' ? 'nb-NO' : 'en-GB' });
  await ctx.addInitScript((l) => {
    localStorage.setItem('gym-lang', l);
    localStorage.setItem('gym-install-hint-dismissed', '1');
  }, lang);
  const page = await ctx.newPage();
  const btn = (n, o = {}) => page.getByRole('button', { name: n, ...o });
  await page.goto(BASE);
  await btn(T('Lag konto', 'Create account')).click();
  await page.getByLabel(T('Navn', 'Name')).fill(T('Ola', 'Alex'));
  await page.getByLabel(T('E-post', 'Email')).fill(`demo-${lang}@example.com`);
  await page.getByLabel(T('Passord (minst 8 tegn)', 'Password (at least 8 characters)')).fill('Demo-passord-2026');
  await page.locator('form').getByRole('button', { name: T('Lag konto', 'Create account') }).click();
  await btn(T('Fortsett', 'Continue')).click();
  await page.getByRole('radio', { name: new RegExp(T('Bli sterkere', 'Get stronger')) }).click();
  await btn(T('Fortsett', 'Continue')).click();
  await page.getByRole('radio', { name: /^3/ }).click();
  await btn(T('Fortsett', 'Continue')).click();
  await page.locator('#ob-bodyweight').fill('80');
  await btn(T('Mann', 'Male'), { exact: true }).click();
  await btn(T('Fortsett', 'Continue')).click();
  await page.getByRole('radio', { name: T(/^Fullkropp A\/B /, /^Full body A\/B /) }).click();
  await btn(T('Start å trene', 'Start training')).click();

  // Les inn demodataene
  await page.getByRole('navigation').getByRole('link', { name: T('Profil', 'Profile') }).click();
  await page.getByLabel(T('Velg backupfil', 'Choose backup file')).setInputFiles(backupPath);
  await btn(T('Slå sammen', 'Merge')).click();
  await page.getByText(T(/Gjenopprettet/, /Restored/)).waitFor();

  await page.getByRole('navigation').getByRole('link', { name: T('Hjem', 'Home') }).click();
  await page.getByText(T('Trent kropp', 'Muscles trained')).waitFor();
  const later = btn(T('Senere', 'Later'));
  if (await later.count()) await later.click();
  await sharp(page, join(tmp, `home-${lang}.png`));

  await page.getByRole('link', { name: T(/^Styrkenivå:/, /^Strength level:/) }).click();
  await sharp(page, join(tmp, `level-${lang}.png`));
  await btn(T('Tilbake', 'Back')).click();

  // En økt med et tungt sett: rekordkort / nivå opp
  await btn(T('Start Fullkropp A', 'Start Full body A')).or(btn(/^Start /).first()).first().click().catch(() => {});
  await page.getByLabel(/(Vekt|Weight) set 1/).first().waitFor();
  await page.getByLabel(/(Vekt|Weight) set 1/).first().fill(T('112,5', '112.5'));
  await page.getByLabel(/Reps set 1/).first().fill('5');
  await page.getByLabel(/Reps set 1/).first().blur();
  await page.waitForTimeout(300);
  await sharp(page, join(tmp, `workout-${lang}.png`));
  await btn(T('Fullfør set 1', 'Complete set 1')).first().click();
  await page.waitForTimeout(2600);
  await sharp(page, join(tmp, `levelup-${lang}.png`));
  const dlg = page.getByRole('dialog');
  if (await dlg.count()) await dlg.getByRole('button', { name: T('Fortsett', 'Continue') }).click();

  // Delekort: høydepunkter fra siste ferdige økt
  await page.getByRole('navigation').getByRole('link', { name: T('Historikk', 'History') }).click();
  await page.locator('main button').first().click();
  await btn(T('Del økta', 'Share workout')).click();
  const sheet = page.getByRole('dialog', { name: T('Del økta', 'Share workout') });
  await sheet.getByRole('tab', { name: T(/Høyde.?punkter/, /High.?lights/) }).click();
  await page.waitForTimeout(900);
  const src = await sheet.getByRole('img', { name: T(/Delekort/, /Share card/) }).getAttribute('src');
  await writeFile(join(tmp, `share-${lang}.png`), Buffer.from(src.split(',')[1], 'base64'));
  await ctx.close();
  out.push(lang);
}
// Skaler ned og lagre som WebP med nettleserens egen koder.
const conv = await (await browser.newContext()).newPage();
await mkdir('public/screenshots', { recursive: true });
for (const lang of out) {
  for (const name of ['home', 'level', 'workout', 'levelup', 'share']) {
    const png = (await readFile(join(tmp, `${name}-${lang}.png`))).toString('base64');
    const webp = await conv.evaluate(async ({ png, w }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = Math.round((img.height * w) / img.width);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.82).split(',')[1];
    }, { png, w: 540 });
    await writeFile(`public/screenshots/${name}-${lang}.webp`, Buffer.from(webp, 'base64'));
  }
}
await browser.close();
server.kill();
console.log('✓ Skjermbilder i public/screenshots/');
