// Ende-til-ende-test i iPhone-visning. Kjør etter `npm run build`:
//   npm run e2e
// Starter `vite preview` og går gjennom hele appen med to kontoer. Skjermbilder i tests/screens/.
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
let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `tests/screens/${String(++n).padStart(2, '0')}-${name}.png` });
};
const btn = (name, opts = {}) => page.getByRole('button', { name, ...opts });
const dialog = () => page.getByRole('dialog');

async function signUp(name, email, password) {
  await btn('Lag konto').click();
  await page.getByLabel('Navn').fill(name);
  await page.getByLabel('E-post').fill(email);
  await page.getByLabel('Passord (minst 8 tegn)').fill(password);
  await page.locator('form').getByRole('button', { name: 'Lag konto' }).click();
  await page.getByText(`Hei, ${name}!`).waitFor();
}

async function onboard({ goal, perWeek }, shots = false) {
  if (shots) await shot('oppstart-navn');
  await btn('Fortsett').click();
  await page.getByRole('radio', { name: new RegExp(goal) }).click();
  if (shots) await shot('oppstart-mal');
  await btn('Fortsett').click();
  await page.getByRole('radio', { name: new RegExp(`^${perWeek}`) }).click();
  await btn('Fortsett').click();
  await btn('Fortsett').click();
  if (shots) await shot('oppstart-klart');
  await btn('Start å trene').click();
  await page.getByText(/God (morgen|kveld|natt)|Hei,/).first().waitFor();
}

async function logSet(i, weight, reps) {
  await page.getByLabel(`Vekt set ${i} (kg)`).first().fill(String(weight));
  await page.getByLabel(`Reps set ${i}`).first().fill(String(reps));
  await page.getByLabel(`Reps set ${i}`).first().blur();
  await btn(`Fullfør set ${i}`).first().click();
}

async function finish() {
  await btn('Avslutt', { exact: true }).click();
  await btn('Lagre økt').click();
  await page.getByText('Økt fullført').waitFor();
}

try {
  // 1. Velkomst
  await page.goto(URL);
  await btn('Lag konto').waitFor();
  await shot('velkomst');

  // 2. Registrering med svakt passord gir feilmelding, så riktig
  await btn('Lag konto').click();
  await page.getByLabel('Navn').fill('Ola');
  await page.getByLabel('E-post').fill('ola@eksempel.no');
  await page.getByLabel('Passord (minst 8 tegn)').fill('kort');
  await page.locator('form').getByRole('button', { name: 'Lag konto' }).click();
  await page.getByRole('alert').filter({ hasText: 'minst 8 tegn' }).waitFor();
  await page.getByLabel('Passord (minst 8 tegn)').fill('Sterkt-passord-2026');
  await shot('lag-konto');
  await page.locator('form').getByRole('button', { name: 'Lag konto' }).click();
  await page.getByText('Hei, Ola!').waitFor();

  // 3. Oppstart → Hjem med startrutiner
  await onboard({ goal: 'Bli sterkere', perWeek: 3 }, true);
  await page.getByRole('img', { name: '0 av 3 økter denne uka' }).waitFor();
  await page.getByText('Fullkropp A').first().waitFor();
  await shot('hjem-ny');

  // 4. Første økt fra rutine, med platekalkulator
  await btn('Start Fullkropp A').click();
  await page.getByText('Knebøy').first().waitFor();
  await btn('Fullfør set 5').first().waitFor(); // styrkerutine gir 5 sets
  await logSet(1, 100, 5);
  await page.getByRole('timer').waitFor();
  await logSet(2, 100, 5);
  await btn('Platekalkulator').first().click();
  await dialog().getByText('25 + 15').waitFor();
  await shot('platekalkulator');
  await dialog().getByRole('button', { name: 'Lukk' }).last().click();
  await shot('aktiv-okt');
  await finish();
  await shot('oppsummering-1');
  await btn('Ferdig').click();
  await page.getByRole('img', { name: '1 av 3 økter denne uka' }).waitFor();

  // 5. Andre økt: gjenta forrige, tyngre → PR
  await btn('Start økt').click();
  await btn(/Gjenta forrige/).click();
  await page.getByText('Knebøy').first().waitFor();
  await page.getByRole('button', { name: 'Bruk forrige: 100 × 5' }).first().waitFor();
  await logSet(1, 105, 5);
  await page.getByText('Tyngste').first().waitFor();
  await shot('pr-i-okt');
  await finish();
  await page.getByText(/ny rekord|nye rekorder/).first().waitFor();
  await shot('oppsummering-pr');
  await btn('Ferdig').click();
  await page.getByText('Siste rekorder').waitFor();
  await shot('hjem-med-data');

  // 6. Historikk og kalender
  await page.getByRole('navigation').getByRole('link', { name: 'Historikk' }).click();
  await btn(/1 øvelse/).first().waitFor();
  assert.equal(await btn(/1 øvelse/).count(), 2, 'to økter i historikken');
  await btn('Kalender').click();
  await shot('kalender');

  // 7. Fremgang og øvelse
  await page.getByRole('navigation').getByRole('link', { name: 'Fremgang' }).click();
  await page.getByText('Siste 12 uker').waitFor();
  await shot('fremgang');
  await btn(/Knebøy/).click();
  await page.getByRole('img', { name: /Graf/ }).waitFor();
  await shot('ovelse');

  // 8. Kroppsvekt
  await page.goBack();
  await page.getByRole('link', { name: /Kroppsvekt/ }).click();
  await page.getByPlaceholder('Vekt i dag (kg)').fill('82,5');
  await btn('Logg').click();
  await page.getByText('82,5 kg').first().waitFor();

  // 9. Profil → logg ut
  await page.getByRole('navigation').getByRole('link', { name: 'Profil' }).click();
  await page.getByText('Økter totalt').waitFor();
  await shot('profil');
  await btn('Logg ut').click();
  await dialog().getByRole('button', { name: 'Logg ut' }).click();
  await btn('Jeg har konto').waitFor();

  // 10. Feil passord, så riktig – dataene er der
  await btn('Jeg har konto').click();
  await page.getByLabel('E-post').fill('ola@eksempel.no');
  await page.getByLabel('Passord').fill('feil-passord');
  await page.locator('form').getByRole('button', { name: 'Logg inn' }).click();
  await page.getByRole('alert').filter({ hasText: 'Feil e-post eller passord' }).waitFor();
  await shot('feil-passord');
  await page.getByLabel('Passord').fill('Sterkt-passord-2026');
  await page.locator('form').getByRole('button', { name: 'Logg inn' }).click();
  await page.getByRole('img', { name: '2 av 3 økter denne uka' }).waitFor();

  // 11. Konto nr. 2 ser ingen data fra konto 1
  await page.getByRole('navigation').getByRole('link', { name: 'Profil' }).click();
  await btn('Logg ut').click();
  await dialog().getByRole('button', { name: 'Logg ut' }).click();
  await signUp('Kari', 'kari@eksempel.no', 'Kari-passord-99');
  await onboard({ goal: 'Bygge muskler', perWeek: 4 });
  await page.getByRole('img', { name: '0 av 4 økter denne uka' }).waitFor();
  assert.equal(await page.getByText('Siste rekorder').count(), 0, 'Kari ser ikke Olas rekorder');
  await page.getByText('Overkropp').first().waitFor();

  // 12. Offline: appen laster fra service worker, fortsatt innlogget
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  await page.getByRole('img', { name: '0 av 4 økter denne uka' }).waitFor({ timeout: 8000 });
  await ctx.setOffline(false);

  assert.deepEqual(errors, [], 'ingen JS-feil');
  console.log(`✓ Alle e2e-sjekker bestått. ${n} skjermbilder i tests/screens/`);
} catch (e) {
  await page.screenshot({ path: 'tests/screens/FEIL.png' }).catch(() => {});
  if (errors.length) console.error('JS-feil:', errors);
  throw e;
} finally {
  await browser.close();
  server.kill();
}
