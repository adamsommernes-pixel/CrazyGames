// Ende-til-ende-test i iPhone-visning. Kjør etter `npm run build`:
//   npm run e2e
// Starter `vite preview` og går gjennom hele appen med to kontoer. Skjermbilder i tests/screens/.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
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

await rm('tests/screens', { recursive: true, force: true });
await mkdir('tests/screens', { recursive: true });
// SwiftShader gir WebGL uten skjermkort, så 3D-demoene kan testes.
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// 0. Intro ved oppstart: logo og navn i ca. 1,5 s, så flyr logoen til hjørnet og forsvinner
{
  const ic = await browser.newContext({ ...devices['iPhone 13'], locale: 'nb-NO' });
  const ip = await ic.newPage();
  await ip.goto(URL);
  await ip.locator('[data-intro="show"]').waitFor({ timeout: 3000 });
  await ip.waitForTimeout(1000);
  assert.equal(await ip.locator('[data-intro="show"]').count(), 1, 'logoen vises fortsatt etter 1 s');
  await ip.locator('[data-intro]').waitFor({ state: 'detached', timeout: 3500 });
  await ip.locator('[data-logo-anchor]').waitFor();
  await ic.close();
}

const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'nb-NO' });
// Headless Chromium har ingen skjermlås: tell kallene i stedet, så vi ser at appen ber om den.
await ctx.addInitScript(() => {
  localStorage.setItem('repgrade-skip-intro', '1');
  // Hovedflyten kjøres på norsk; den engelske har egen kontekst lenger ned.
  if (!sessionStorage.getItem('lang-set')) {
    localStorage.setItem('gym-lang', 'nb');
    sessionStorage.setItem('lang-set', '1');
  }
  window.__wakeLocks = 0;
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: async () => (window.__wakeLocks++, { released: false, release: async () => {} }) },
  });
});
const page = await ctx.newPage();
const errors = [];
const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
const isoDay = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
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
  await page.getByText(new RegExp(`^Hei, ${name}$`)).waitFor();
}

async function onboard({ goal, perWeek, sex, program }, shots = false) {
  if (shots) await shot('oppstart-navn');
  await btn('Fortsett').click();
  await page.getByRole('radio', { name: new RegExp(goal) }).click();
  if (shots) await shot('oppstart-mal');
  await btn('Fortsett').click();
  await page.getByRole('radio', { name: new RegExp(`^${perWeek}`) }).click();
  await btn('Fortsett').click();
  if (sex) await btn(sex, { exact: true }).click();
  if (shots) await shot('oppstart-om-deg');
  await btn('Fortsett').click();
  await page.getByRole('radio', { name: /Anbefalt/ }).first().waitFor();
  if (program) await page.getByRole('radio', { name: new RegExp(`^${program} `) }).click();
  if (shots) await shot('oppstart-program');
  await btn('Start å trene').click();
  await page.getByText(/God (morgen|kveld|natt)|Hei,/).first().waitFor();
}

async function logSet(i, weight, reps) {
  await page.getByLabel(`Vekt set ${i} (kg)`).first().fill(String(weight));
  await page.getByLabel(`Reps set ${i}`).first().fill(String(reps));
  await page.getByLabel(`Reps set ${i}`).first().blur();
  await btn(`Fullfør set ${i}`).first().click();
  await dismissLevelUp();
}

/** «Nivå opp» dekker skjermen til man trykker Fortsett. */
const levelUp = () => page.getByRole('dialog').filter({ has: page.getByText('Nytt nivå', { exact: true }) });
async function dismissLevelUp() {
  await page.waitForTimeout(250);
  if (await levelUp().count()) await levelUp().getByRole('button', { name: 'Fortsett' }).click();
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

  // 1-0. Lenken fra bekreftelses-e-posten fører til innlogging med en melding
  await page.goto(URL + '?confirmed=1#access_token=x&type=signup');
  await page.getByText('E-posten er bekreftet. Logg inn for å starte.').waitFor();
  assert.equal(await page.evaluate(() => location.search), '', 'markøren fjernes fra adressen');
  await page.evaluate(() => { location.hash = '#/'; });
  await btn('Lag konto').waitFor(); // velkomstsiden, ikke tilbake til innlogging

  // 1a. Personvernerklæringen kan leses før man lager konto
  await page.getByRole('link', { name: 'Personvern' }).click();
  await page.getByRole('heading', { name: 'Kroppsdata er særlig beskyttet' }).waitFor();
  await page.getByText(/Adam Sommernes er behandlingsansvarlig/).waitFor();
  await shot('personvern');
  await btn('Tilbake').click();
  await btn('Lag konto').waitFor();

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
  await page.getByText(/^Hei, Ola$/).waitFor();

  // 3. Oppstart → Hjem med startrutiner
  await onboard({ goal: 'Bli sterkere', perWeek: 3, sex: 'Mann', program: 'Fullkropp A/B' }, true);
  await page.getByRole('link', { name: /^Styrkenivå: Nybegynner/ }).waitFor();
  await page.getByRole('img', { name: '0 av 3 økter denne uka' }).waitFor();
  await page.getByText('Fullkropp A').first().waitFor();
  await shot('hjem-ny');

  // 4. Første økt fra rutine, med platekalkulator
  await btn('Start Fullkropp A').click();
  await page.getByText('Knebøy').first().waitFor();
  await btn('Fullfør set 5').first().waitFor(); // styrkerutine gir 5 sets
  // 4-0. Det du skriver er lagret selv om siden lastes på nytt før du forlater feltet
  await page.getByLabel('Vekt set 3 (kg)').first().fill('97,5');
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByText('Knebøy').first().waitFor();
  assert.equal(await page.getByLabel('Vekt set 3 (kg)').first().inputValue(), '97,5', 'vekten overlevde omlasting');
  await page.getByLabel('Vekt set 3 (kg)').first().fill('100');
  await page.getByLabel('Vekt set 3 (kg)').first().blur();
  // 4a. Første knebøy gir nytt totalnivå: fullskjerm «Nivå opp»
  await page.getByLabel('Vekt set 1 (kg)').first().fill('100');
  await page.getByLabel('Reps set 1').first().fill('5');
  await page.getByLabel('Reps set 1').first().blur();
  await btn('Fullfør set 1').first().click();
  await levelUp().waitFor();
  await levelUp().getByRole('heading', { name: 'Rookie' }).waitFor();
  await page.waitForTimeout(2200);
  await shot('niva-opp');
  await levelUp().getByRole('button', { name: 'Fortsett' }).click();
  await levelUp().waitFor({ state: 'detached' });

  // 4b. Hvilelinja: +15 og −15 virker
  const timerText = async () => (await page.getByRole('timer').innerText()).match(/\d+:\d\d/)?.[0];
  const toSec = (v) => v.split(':').reduce((m, x) => m * 60 + Number(x), 0);
  const t0 = toSec(await timerText());
  await page.getByRole('timer').getByRole('button', { name: '+15' }).click();
  await page.waitForTimeout(400);
  assert.ok(toSec(await timerText()) >= t0 + 13, 'hviletiden økte med 15 s');
  await page.getByRole('timer').getByRole('button', { name: '−15' }).click();
  await page.waitForTimeout(400);
  assert.ok(toSec(await timerText()) <= t0 + 2, 'hviletiden gikk ned igjen');

  // 4c. Ark oppå ark (velger → øvelsesinfo → rekorder) låser ikke scrollingen etterpå
  const locked = () => page.evaluate(() => document.body.style.overflow === 'hidden');
  await btn(/Legg til øvelse/).first().click();
  await page.getByRole('button', { name: /^Slik gjør du: / }).first().click();
  assert.ok(await locked(), 'låst mens arkene er åpne');
  await btn('Rekorder og grafer').click();
  await page.waitForTimeout(400);
  assert.equal(await locked(), false, 'scrolling virker på øvelsessiden');
  await page.goBack();
  await page.getByText('Knebøy').first().waitFor();
  assert.equal(await locked(), false, 'scrolling virker tilbake i økta');
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

  // 5a. Progresjonsforslag (målet 5 reps ble nådd sist) og skjermlås
  await page.getByText('Du klarte målet sist').waitFor();
  assert.ok((await page.evaluate(() => window.__wakeLocks)) > 0, 'skjermen holdes på under økta');

  // 5b. Oppvarming med ett trykk: 40/60/80 % av 100 kg
  await btn('Valg for øvelse').first().click();
  await btn('Legg til oppvarming (40 / 60 / 80 kg)').click();
  await btn('Fullfør set oppvarming 3').waitFor();
  await shot('oppvarming-og-forslag');

  // 5c. Enter-flyt: vekt → reps → fullført, og fokus til neste set
  const weight1 = page.getByLabel('Vekt set 1 (kg)').first();
  await weight1.fill('105');
  await weight1.press('Enter');
  assert.equal(await focused(), 'Reps set 1', 'Enter i vekt går til reps');
  await page.keyboard.type('5');
  await page.keyboard.press('Enter');
  await btn('Angre set 1').first().waitFor();
  assert.equal(await focused(), 'Vekt set 2 (kg)', 'Enter i reps fullfører og går til neste set');
  await page.getByText('Tyngste').first().waitFor();
  await shot('pr-i-okt');

  // 5d. Slett et set og angre
  await btn('Set 2, rediger').first().click();
  await dialog().getByRole('button', { name: 'Slett' }).click();
  await page.getByText('Settet er slettet').waitFor();
  assert.equal(await btn('Set 2, rediger').count(), 0);
  await btn('Angre', { exact: true }).click();
  await btn('Set 2, rediger').first().waitFor();

  // 5e. Flervalg og søk uten æøå
  await btn('Legg til øvelse').click();
  await page.getByPlaceholder('Søk blant øvelser').fill('kneboy');
  await page.getByRole('checkbox', { name: /^Knebøy/ }).first().waitFor();
  await page.getByPlaceholder('Søk blant øvelser').fill('');
  await page.getByRole('checkbox', { name: /^Benkpress Bryst/ }).click();
  await page.getByPlaceholder('Søk blant øvelser').fill('tåhev');
  await page.getByRole('checkbox', { name: /^Standing calf raise/ }).waitFor();
  await page.getByPlaceholder('Søk blant øvelser').fill('sidehev') // norsk søk finner det engelske navnet;
  await page.getByRole('checkbox', { name: /^Lateral raise Skuldre/ }).click();
  await shot('flervalg');
  await btn('Legg til (2)').click();
  await page.getByRole('heading', { name: 'Lateral raise' }).waitFor();
  await page.getByRole('heading', { name: 'Benkpress' }).waitFor();

  // 5f. Økta avviker fra rutinen → spørsmål om å lagre endringene i rutinen (bare denne gangen)
  await btn('Avslutt', { exact: true }).click();
  // 5e. Egen tittel på økta når den avsluttes
  assert.equal(await page.locator('#finish-title').inputValue(), 'Fullkropp A');
  await page.locator('#finish-title').fill('Tunge bein');
  await btn('Lagre økt').click();
  await dialog().getByText(/Du endret økta i forhold til rutinen «Fullkropp A»/).waitFor();
  await shot('lagre-i-rutinen');
  await btn('Bare denne gangen').click();
  await page.getByText('Økt fullført').waitFor();
  await page.getByText(/ny rekord|nye rekorder/).first().waitFor();
  await page.getByRole('heading', { name: 'Tunge bein' }).waitFor();
  await shot('oppsummering-pr');
  // …og kan endres fra oppsummeringen
  await btn(/^Endre tittel: Tunge bein/).click();
  await page.locator('#summary-title').fill('Tunge bein – ny PR');
  await dialog().getByRole('button', { name: 'Lagre' }).click();
  await page.getByRole('heading', { name: 'Tunge bein – ny PR' }).waitFor();

  // 5d. Delekort: fire nivåer i to formater, og nedlasting gir en PNG
  await btn('Del økta').click();
  const share = page.getByRole('dialog', { name: 'Del økta' });
  await share.getByRole('img', { name: /Delekort/ }).waitFor();
  for (const [i, name] of [[1, /Enkel/], [2, /Tall/], [3, /Høyde.?punkter/], [4, /Hele økta/]]) {
    await share.getByRole('tab', { name }).click();
    await share.getByRole('tab', { name, selected: true }).waitFor();
    await page.waitForTimeout(500);
    if (i === 3) await shot('delekort-hoydepunkter');
  }
  await share.getByRole('button', { name: 'Post 4:5' }).click();
  await page.waitForTimeout(600);
  await shot('delekort-full-post');
  const [download] = await Promise.all([page.waitForEvent('download'), share.getByRole('button', { name: 'Last ned' }).click()]);
  assert.match(download.suggestedFilename(), /\.png$/);
  const { size } = await (await import('node:fs/promises')).stat(await download.path());
  assert.ok(size > 50_000, `PNG er ${size} bytes`);
  await share.getByRole('button', { name: 'Lukk' }).last().click();
  await share.waitFor({ state: 'detached' });
  await btn('Ferdig').click();
  await page.getByText('Siste rekorder').waitFor();
  await shot('hjem-med-data');

  // 5b2. Nivåmerket på Hjem og nivåsiden
  await page.getByRole('link', { name: /^Styrkenivå: / }).click();
  await page.getByRole('heading', { name: 'Styrkenivå' }).waitFor();
  await page.getByText('Olympia', { exact: true }).waitFor();
  await page.getByText(/Logg (press|trekk).*-øvelser/).waitFor();
  await shot('styrkeniva');
  await btn('Tilbake').click();
  await page.getByText('Siste rekorder').waitFor();

  // 5c. Kroppskartet: knebøy farger beina, brystet er ikke trent
  const bodyMap = page.getByRole('img', { name: /^Trent: .*bein/ });
  await bodyMap.waitFor();
  assert.match(await bodyMap.getAttribute('aria-label'), /Ikke trent: .*bryst/);
  await btn('Bein', { exact: true }).click();
  await page.getByRole('status').filter({ hasText: /Bein · .*sets siste 7 dager/ }).waitFor();
  await page.waitForTimeout(350);
  await page.getByRole('region', { name: 'Trent kropp' })
    .screenshot({ path: `tests/screens/${String(++n).padStart(2, '0')}-kroppskart.png` });
  await btn('30 d').click();
  await page.getByRole('status').filter({ hasText: /siste 30 dager/ }).waitFor();
  await btn('7 d').click();

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
  await page.getByText('Prosent av 1RM').waitFor();
  await shot('ovelse');

  // 7b. 3D-demo for et stort løft: lerretet tegnes, pause og sakte film virker, og figuren kan snus
  await page.getByRole('tab', { name: 'Slik gjør du' }).click();
  const demo = page.locator('[data-demo3d="kneboy"]');
  await demo.locator('canvas').waitFor();
  await demo.getByText(/Ned: hofta bak|Opp: press gjennom/).waitFor();
  await page.waitForTimeout(600);
  const pixels = async () => (await demo.locator('canvas').screenshot({ animations: 'allow' })).toString('base64');
  const a = await pixels();
  await page.waitForTimeout(500);
  assert.notEqual(await pixels(), a, '3D-figuren beveger seg');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('3d-demo');
  await demo.getByRole('button', { name: 'Pause' }).click();
  await demo.getByRole('button', { name: 'Spill av' }).waitFor();
  await page.waitForTimeout(200);
  const still = await pixels();
  await page.waitForTimeout(400);
  assert.equal(await pixels(), still, 'står stille på pause');
  const box = await demo.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.notEqual(await pixels(), still, 'figuren snus når man drar');
  await demo.getByRole('button', { name: '0,5×' }).click();
  assert.equal(await demo.getByRole('button', { name: '0,5×' }).getAttribute('aria-pressed'), 'true');
  await demo.getByRole('button', { name: 'Spill av' }).click();

  // 8. Kroppsvekt
  await page.goBack();
  await page.getByRole('link', { name: /Kroppsvekt/ }).click();
  await page.getByPlaceholder('Vekt i dag (kg)').fill('82,5');
  await btn('Logg').click();
  await page.getByText('82,5 kg').first().waitFor();

  // 8b. Etterregistrert økt fra forrige uke (påvirker ikke ukemålet), så endre den i historikken
  await btn('Start økt').click();
  await btn(/Logg tidligere økt/).click();
  await page.locator('#past-date').fill(isoDay(8));
  await btn('Start registrering').click();
  await btn('Legg til øvelse').click();
  await page.getByPlaceholder('Søk blant øvelser').fill('benk');
  await page.getByRole('checkbox', { name: /^Benkpress Bryst/ }).click();
  await btn('Legg til (1)').click();
  await logSet(1, 60, 10);
  await btn('Avslutt', { exact: true }).click();
  await page.getByRole('group', { name: 'Varighet' }).waitFor();
  await shot('etterregistrert');
  await btn('Lagre økt').click();
  await page.getByText('Økt fullført').waitFor();
  await btn('Ferdig').click();
  await page.getByRole('img', { name: '2 av 3 økter denne uka' }).waitFor();

  await page.getByRole('navigation').getByRole('link', { name: 'Historikk' }).click();
  await btn(/1 øvelse/).nth(2).waitFor();
  await btn(/1 øvelse/).last().click();
  await btn('Valg').click();
  await btn('Endre navn, dato og varighet').click();
  await page.locator('#edit-workout-name').fill('Bryst');
  await btn('Lagre endringer').click();
  await page.getByRole('heading', { name: 'Bryst' }).waitFor();

  // 9. Profil → logg ut
  await page.getByRole('navigation').getByRole('link', { name: 'Profil' }).click();
  await page.getByText('Økter totalt').waitFor();
  await shot('profil');

  // 9-0. Treningen din: endre mål og dager direkte, og bytt program fra Profil
  await btn(/^Mål: Bli sterkere/).click();
  await dialog().getByRole('button', { name: /Min egen vei/ }).click();
  await btn(/^Mål: Min egen vei/).waitFor();
  await btn(/^Økter per uke: 3/).click();
  await dialog().getByRole('button', { name: '5', exact: true }).click();
  await btn(/^Økter per uke: 5/).waitFor();
  await shot('profil-treningen-din');
  await page.getByRole('link', { name: /Program.*Bytt/ }).click();
  await page.getByRole('radio', { name: /^PPL \+ Overkropp \/ Underkropp.*Anbefalt/ }).waitFor();
  await page.getByRole('button', { name: '6 dager' }).click();
  await page.getByRole('radio', { name: /^Push \/ Pull \/ Bein ×2.*Anbefalt/ }).waitFor();
  await shot('programmer');
  await btn('Bruk dette programmet').click();
  await dialog().getByText(/Du har 2 startrutiner fra et tidligere program/).waitFor();
  await btn('Erstatt startrutinene').click();
  await page.getByRole('heading', { name: 'Rutiner', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Push B', exact: true }).waitFor();
  // Rekkefølgen bestemmer hva som står for tur: flytt Pull øverst
  const firstRoutine = () => page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) }).first().getByRole('heading', { level: 2 }).innerText();
  assert.equal(await firstRoutine(), 'Push');
  await btn('Flytt opp: Pull', { exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(await firstRoutine(), 'Pull');
  await page.getByRole('listitem').first().getByText('Står for tur').waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Fullkropp A', exact: true }).count(), 0, 'gamle startrutiner er erstattet');
  await page.getByRole('navigation').getByRole('link', { name: 'Hjem' }).click();
  await page.getByRole('heading', { name: 'Dine rutiner' }).waitFor();
  await page.getByRole('heading', { name: 'Nyheter og eventer' }).waitFor();
  await shot('hjem-rutiner');
  await page.getByRole('navigation').getByRole('link', { name: 'Profil' }).click();
  await page.getByText('Økter totalt').waitFor();
  // Tilbake til 3 økter i uka, som resten av testen forventer.
  await btn(/^Økter per uke: 5/).click();
  await dialog().getByRole('button', { name: '3', exact: true }).click();
  await btn(/^Økter per uke: 3/).waitFor();

  // 9-1. Appfarge: velg blå, se at knapper og grafer følger, og at valget huskes
  await page.getByRole('radiogroup', { name: 'Appfarge' }).getByRole('radio', { name: 'Blå' }).click();
  const accentNow = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
  assert.equal(await accentNow(), '#4d9bf0');
  await page.getByRole('navigation').getByRole('link', { name: 'Hjem' }).click();
  await page.getByRole('heading', { name: 'Dine rutiner' }).waitFor();
  const primary = page.locator('main button.bg-accent').first();
  await primary.waitFor();
  const startBg = await primary.evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(startBg, 'rgb(77, 155, 240)', 'hovedknappen er blå');
  await page.reload();
  await page.getByText('Dine rutiner').first().waitFor();
  assert.equal(await accentNow(), '#4d9bf0', 'fargen huskes etter omlasting');
  await shot('hjem-blaa');
  await page.getByRole('navigation').getByRole('link', { name: 'Profil' }).click();
  await page.getByText('Økter totalt').waitFor();

  // 9a. Data og backup: JSON og CSV lastes ned, og backupen kan leses inn igjen
  const { readFile } = await import('node:fs/promises');
  const [jsonDl] = await Promise.all([page.waitForEvent('download'), btn('Last ned backup (JSON)').click()]);
  const backup = JSON.parse(await readFile(await jsonDl.path(), 'utf8'));
  assert.equal(backup.version, 2);
  assert.ok(backup.tables.sets.length >= 2, `backupen har sets (${backup.tables.sets.length})`);
  await page.getByText(/Siste backup:/).waitFor();
  const [csvDl] = await Promise.all([page.waitForEvent('download'), btn('Eksporter sets til regneark (CSV)').click()]);
  const csv = await readFile(await csvDl.path(), 'utf8');
  assert.match(csv, /date,workout,exercise,set,type,weight_kg,reps,distance_km,pr/);
  assert.match(csv, /Knebøy,1,normal,100,5/);
  await page.getByLabel('Velg backupfil').setInputFiles(await jsonDl.path());
  await page.getByText(/Backup fra .* økter, .* sets/).waitFor();
  await shot('gjenopprett-backup');
  await btn('Slå sammen').click();
  await page.getByText(/Gjenopprettet\./).waitFor();
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

  // 10b. Fremgangsmåte, favoritt, tid og kondisjon, bytt øvelse
  await btn('Start økt').click();
  await btn(/^Tom økt/).click();
  await btn('Legg til øvelse').click();
  await page.getByPlaceholder('Søk blant øvelser').fill('planke');
  await btn('Slik gjør du: Plank').click();
  await page.getByText('Støtt deg på underarmene og tærne.').waitFor();
  await btn('Legg til i favoritter').click();
  await btn('Fjern fra favoritter').waitFor();
  await shot('fremgangsmate');
  assert.equal(await page.locator('[data-demo3d]').count(), 0, 'ingen 3D-demo for andre øvelser');
  await dialog().last().getByRole('button', { name: 'Lukk' }).last().click();
  await page.getByRole('checkbox', { name: /^Plank Mage/ }).click();
  await page.getByPlaceholder('Søk blant øvelser').fill('tredem');
  await page.getByRole('checkbox', { name: /^Tredemølle Kondisjon/ }).click();
  await btn('Legg til (2)').click();
  await page.getByRole('heading', { name: 'Tredemølle' }).waitFor();
  await page.getByText('Sek', { exact: true }).waitFor();
  await page.getByText('Km', { exact: true }).waitFor();

  // Planke med stoppeklokke: start, vent, stopp → settet er fullført med sekundene fylt inn
  await btn('Start tidtaking set 1').click();
  await page.waitForTimeout(1300);
  await btn('Stopp tidtaking set 1').click();
  await btn('Angre set 1').first().waitFor();
  const secs = Number(await page.getByLabel('Sekunder set 1').inputValue());
  assert.ok(secs >= 1, `stoppeklokka fylte inn ${secs} sekunder`);

  // Tredemølle: km og minutter
  await page.getByLabel('Distanse set 1 (Km)').fill('5');
  await page.getByLabel('Minutter set 1').fill('30');
  await page.getByLabel('Minutter set 1').blur();
  await btn('Fullfør set 1').click();
  await shot('tid-og-kondisjon');

  // Bytt øvelse: Tredemølle har ett fullført set, så de uferdige flyttes til Romaskin
  await btn('Valg for øvelse').last().click();
  await btn('Bytt øvelse').click();
  await page.getByPlaceholder('Søk blant øvelser').fill('romask');
  await btn(/^Romaskin Kondisjon/).click();
  await page.getByRole('heading', { name: 'Romaskin' }).waitFor();
  await page.getByRole('heading', { name: 'Tredemølle' }).waitFor();

  // Favoritter står først i velgeren
  await btn('Legg til øvelse').click();
  await page.getByText('★ Favoritter').waitFor();
  await shot('velger-favoritter');

  // Egen øvelse: lag, rediger og slett med angre
  await btn(/^Lag ny øvelse/).click();
  await page.locator('#new-exercise-name').fill('Sledgehammer');
  await btn('Kondisjon', { exact: true }).first().click();
  await btn('Lagre og velg').click();
  await btn('Legg til (1)').click();
  await page.getByRole('heading', { name: 'Sledgehammer' }).waitFor();
  await btn('Slik gjør du').last().click();
  await page.getByText('Dette er en egen øvelse').waitFor();
  await btn('Rekorder og grafer').click();
  await btn('Rediger øvelse').click();
  await page.locator('#new-exercise-name').fill('Slegge');
  await btn('Lagre endringer').click();
  await page.getByRole('heading', { name: 'Slegge', level: 1 }).waitFor();
  await btn('Rediger øvelse').click();
  await btn('Slett øvelse').click();
  await page.getByText('Slegge er slettet').waitFor();
  await btn('Angre', { exact: true }).click();
  await page.waitForTimeout(300);

  // Avslutt økta
  await page.getByRole('navigation').getByRole('button', { name: 'Fortsett økt' }).click();
  await finish();
  await btn('Ferdig').click();

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

  // 13. Engelsk: velg English på velkomstsiden, lag konto, logg knebøy, bytt tilbake til norsk
  const en = await browser.newContext({ ...devices['iPhone 13'], locale: 'nb-NO' });
  const ep = await en.newPage();
  ep.on('pageerror', (e) => errors.push(e.message));
  const ebtn = (name, opts = {}) => ep.getByRole('button', { name, ...opts });
  await ep.goto(URL);
  await ebtn('Lag konto').waitFor();
  await ep.getByRole('radio', { name: 'English' }).click();
  await ep.getByRole('link', { name: 'Privacy' }).click();
  await ep.getByRole('heading', { name: 'Body data gets extra protection' }).waitFor();
  await ep.getByRole('button', { name: 'Back' }).click();
  await ebtn('Create account').click();
  await ep.getByLabel('Name').fill('Sam');
  await ep.getByLabel('Email').fill('sam@example.com');
  await ep.getByLabel('Password (at least 8 characters)').fill('Strong-password-26');
  await ep.locator('form').getByRole('button', { name: 'Create account' }).click();
  await ep.getByText(/^Hi, Sam$/).waitFor();
  await ebtn('Continue').click();
  await ep.getByRole('radio', { name: /Get stronger/ }).click();
  await ebtn('Continue').click();
  await ep.getByRole('radio', { name: /^3/ }).click();
  await ebtn('Continue').click();
  await ebtn('Continue').click();
  await ep.getByRole('radio', { name: /^Full body A\/B / }).click();
  await ebtn('Start training').click();
  await ep.getByText('Muscles trained').waitFor();
  await ep.getByRole('img', { name: 'No muscle groups trained in this period.' }).waitFor();
  await ebtn('Start Full body A').click();
  await ep.getByText('Squat').first().waitFor();
  await ep.getByLabel('Weight set 1 (kg)').first().fill('80');
  await ep.getByLabel('Reps set 1').first().fill('5');
  await ep.getByLabel('Reps set 1').first().blur();
  await ebtn('Complete set 1').first().click();
  const enLevel = ep.getByRole('dialog').filter({ has: ep.getByText('New level', { exact: true }) });
  await enLevel.waitFor();
  await enLevel.getByRole('button', { name: 'Continue' }).click();
  await ebtn('Finish', { exact: true }).click();
  await ebtn('Save workout').click();
  await ep.getByText('Workout complete').waitFor();
  await ebtn('Share workout').click();
  await ep.getByRole('dialog', { name: 'Share workout' }).getByRole('img', { name: /Share card/ }).waitFor();
  await ep.getByRole('dialog', { name: 'Share workout' }).getByRole('button', { name: 'Close' }).last().click();
  await ebtn('Done').click();
  await ep.getByRole('img', { name: /^Trained: .*legs/ }).waitFor();
  await ep.waitForTimeout(350);
  await ep.getByRole('region', { name: 'Muscles trained' }).screenshot({ path: `tests/screens/${String(++n).padStart(2, '0')}-body-map-en.png` });
  await ep.getByRole('navigation').getByRole('link', { name: 'Profile' }).click();
  await ep.getByRole('radio', { name: 'Norsk' }).click();
  await ep.getByRole('navigation').getByRole('link', { name: 'Hjem' }).click();
  await ep.getByText('Trent kropp').waitFor();
  await en.close();

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
