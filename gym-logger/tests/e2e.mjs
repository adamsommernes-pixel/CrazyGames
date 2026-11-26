// Ende-til-ende-test i iPhone-visning. Kjør etter `npm run build`:
//   npm run e2e
// Starter `vite preview`, logger en hel økt, og tar skjermbilder i tests/screens/.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium, devices } = pw;

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => d.toString().includes('Local') && res());
  server.on('exit', (c) => rej(new Error('preview avsluttet ' + c)));
  setTimeout(() => rej(new Error('preview startet ikke')), 15000);
});

await mkdir('tests/screens', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'nb-NO' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = (name) => page.screenshot({ path: `tests/screens/${name}.png`, fullPage: false });

/** Logger én økt med benkpress og gitte sets. */
async function logWorkout(sets) {
  await page.getByRole('button', { name: 'Start tom økt' }).click();
  await page.getByRole('button', { name: 'Legg til øvelse' }).click();
  await page.getByPlaceholder('Søk etter øvelse').fill('benkpress');
  await page.getByRole('button', { name: /^Benkpress Bryst/ }).click();
  // Første gang: 3 tomme sets. Senere: forhåndsutfylt fra forrige.
  await page.getByRole('button', { name: 'Fullfør set 1' }).waitFor();
  const rows = await page.getByRole('button', { name: /^Fullfør set/ }).count();
  for (let i = rows; i < sets.length; i++) await page.getByRole('button', { name: 'Legg til set' }).click();
  for (const [i, [w, r]] of sets.entries()) {
    await page.getByLabel(`Vekt set ${i + 1} (kg)`).fill(String(w));
    await page.getByLabel(`Reps set ${i + 1}`).fill(String(r));
    await page.getByLabel(`Reps set ${i + 1}`).blur();
    await page.getByRole('button', { name: `Fullfør set ${i + 1}` }).click();
  }
}

async function finish() {
  await page.getByRole('button', { name: 'Avslutt', exact: true }).click();
  await page.getByRole('button', { name: 'Lagre økt' }).click();
  await page.waitForURL(/#\/history\//);
}

try {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Start tom økt' }).waitFor();
  await shot('01-start');

  // Økt 1
  await logWorkout([[80, 8], [80, 8], [80, 7]]);
  await page.getByRole('timer').waitFor({ timeout: 3000 });
  await shot('02-aktiv-okt');
  await finish();
  await shot('03-detalj');

  // Økt 2: tyngre, skal gi PR, og forrige skal vises
  await page.getByRole('link', { name: 'Økt' }).click();
  await page.getByRole('button', { name: 'Start tom økt' }).click();
  await page.getByRole('button', { name: 'Legg til øvelse' }).click();
  await page.getByPlaceholder('Søk etter øvelse').fill('benkpress');
  await page.getByRole('button', { name: /^Benkpress Bryst/ }).click();
  await page.getByRole('button', { name: 'Bruk forrige: 80 × 8' }).first().waitFor({ timeout: 3000 });
  assert.equal(await page.getByLabel('Vekt set 1 (kg)').inputValue(), '80', 'vekt forhåndsutfylt');
  await page.getByLabel('Vekt set 1 (kg)').fill('85');
  await page.getByLabel('Reps set 1').fill('6');
  await page.getByLabel('Reps set 1').blur();
  await page.getByRole('button', { name: 'Fullfør set 1' }).click();
  await page.getByText('Tyngste').first().waitFor();
  await shot('04-pr-i-okt');
  await finish();

  // Historikk
  await page.getByRole('link', { name: 'Historikk' }).click();
  await page.getByRole('button', { name: /min · 1 øvelse ·/ }).first().waitFor();
  assert.equal(await page.getByRole('button', { name: /min · 1 øvelse ·/ }).count(), 2, 'to økter i historikken');
  await shot('05-historikk');

  // Fremgang
  await page.getByRole('link', { name: 'Fremgang' }).click();
  await page.getByRole('button', { name: /Benkpress/ }).click();
  await page.getByRole('img', { name: /Graf/ }).waitFor();
  await page.waitForTimeout(600);
  await shot('06-fremgang');

  // Rutine
  await page.getByRole('link', { name: 'Rutiner' }).click();
  await page.getByRole('button', { name: 'Lag rutine' }).click();
  await page.getByPlaceholder('F.eks. Push, Overkropp A').fill('Push');
  await page.getByRole('button', { name: 'Legg til øvelse' }).click();
  await page.getByRole('button', { name: /^Skulderpress med manualer/ }).click();
  await shot('07-rutine');
  await page.getByRole('button', { name: 'Lagre' }).click();
  await page.getByRole('button', { name: 'Start økt' }).click();
  await page.getByText('Skulderpress med manualer').waitFor();
  await page.getByRole('button', { name: 'Fullfør set 3' }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Fullfør set/ }).count(), 3, 'rutine gir 3 sets');

  // Offline: appen skal laste fra service worker
  await page.goto(URL);
  await page.waitForTimeout(1000);
  await ctx.setOffline(true);
  await page.reload();
  await page.getByText('Skulderpress med manualer').waitFor({ timeout: 5000 });
  await ctx.setOffline(false);

  await page.getByRole('link', { name: 'Profil' }).click();
  await shot('08-profil');

  assert.deepEqual(errors, [], 'ingen JS-feil');
  console.log('✓ Alle e2e-sjekker bestått. Skjermbilder i tests/screens/');
} finally {
  await browser.close();
  server.kill();
}
