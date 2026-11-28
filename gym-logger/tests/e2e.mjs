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
  await page.getByText('Bytter du fra en annen app?').waitFor();
  if (shots) {
    await page.getByText('Bytter du fra en annen app?').scrollIntoViewIfNeeded();
    await shot('oppstart-importer');
    await page.evaluate(() => window.scrollTo(0, 0));
  }
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
  // Del-knappen øverst: delemeny der den finnes, ellers kopieres lenken (vises som melding)
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  await btn('Del RepGrade med en venn').click();
  await page.getByText(/Lenken er kopiert|http/).first().waitFor();
  assert.equal(await page.getByText('Vil du importere data?').count(), 0, 'nye brukere fikk tilbudet i oppstarten, ikke banner');

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
  await levelUp().getByRole('button', { name: 'Se styrkenivå' }).waitFor();
  await levelUp().getByRole('button', { name: 'Fortsett' }).click();
  await levelUp().waitFor({ state: 'detached' });
  // 3D-knappen på Knebøy-kortet åpner demoen direkte
  await btn('3D-demo av Knebøy').click();
  await dialog().locator('[data-demo3d="kneboy"] canvas').waitFor();
  await dialog().getByRole('button', { name: 'Lukk' }).last().click();
  await dialog().waitFor({ state: 'detached' });
  // Trykk på øvelsesnavnet åpner øvelsessiden; tilbake går til økta som fortsatt pågår
  await btn(/^Knebøy: rekorder, grafer og historikk/).first().click();
  await page.getByRole('tab', { name: 'Oversikt' }).waitFor();
  await page.goBack();
  await page.getByRole('timer').waitFor();

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
  assert.equal(await dialog().locator('[data-set-type]').getAttribute('data-set-type'), 'normal', 'set-menyen viser typen i farge');
  await dialog().getByRole('button', { name: 'Oppvarming' }).waitFor();
  await page.waitForTimeout(300);
  await shot('set-meny');
  assert.ok(await page.locator('header').getByText('RepGrade').count(), 'logo og RepGrade øverst i økta');
  await dialog().getByRole('button', { name: 'Slett' }).click();
  await page.getByText('Settet er slettet').waitFor();
  assert.equal(await btn('Set 2, rediger').count(), 0);
  await btn('Angre', { exact: true }).click();
  await btn('Set 2, rediger').first().waitFor();
  // Dra settet til venstre for å slette (og angre)
  const row = page.locator('[data-swipe-row]').filter({ has: btn('Set 2, rediger') }).first();
  const rb = await row.boundingBox();
  await page.mouse.move(rb.x + rb.width * 0.3, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width * 0.3 - rb.width * 0.6, rb.y + rb.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.getByText('Settet er slettet').waitFor();
  assert.equal(await btn('Set 2, rediger').count(), 0, 'settet ble slettet med sveip');
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
  // 5e1. Manualøvelse: vekten per manual står tydelig, og «Del på to» retter opp om begge ble logget samlet
  const lr = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Lateral raise' }) }).first();
  await lr.getByText('kg/stk').waitFor();
  await lr.locator('[data-per-hand="hint"]').waitFor();
  await lr.getByLabel('Vekt set 1 (kg)').fill('60');
  await lr.getByLabel('Vekt set 1 (kg)').blur();
  await lr.locator('[data-per-hand="warn"]').waitFor();
  await page.getByText(/60 kg per manual\?/).waitFor(); // varsel hver gang over 50 kg
  await lr.scrollIntoViewIfNeeded();
  await shot('manual-del-pa-to');
  await lr.getByRole('button', { name: 'Logget feil? Del på to' }).click();
  await page.getByText(/Vektene er delt på to/).waitFor();
  assert.equal(await lr.getByLabel('Vekt set 1 (kg)').inputValue(), '30', 'vekten ble delt på to');
  await btn('Angre', { exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(await lr.getByLabel('Vekt set 1 (kg)').inputValue(), '60', 'angre gir tilbake vekten');
  await lr.getByLabel('Vekt set 1 (kg)').fill('0');
  await lr.getByLabel('Vekt set 1 (kg)').blur();
  // «Skjul» fjerner merknaden (for denne og de neste 3 øktene)
  await lr.locator('[data-per-hand="hint"]').getByRole('button', { name: 'Skjul' }).click();
  await page.getByText(/Skjult for denne og de neste 3 øktene/).waitFor();
  await lr.locator('[data-per-hand]').waitFor({ state: 'detached' });

  // 5e2. Endre rekkefølge: dra første øvelse ned én plass og flytt siste opp med pil
  const cardTitles = async () => (await page.locator('main h2').allInnerTexts()).map((x) => x.split('\n')[0].trim());
  await btn('Endre rekkefølge').click();
  await page.waitForTimeout(500); // arket glir opp
  const items = () => dialog().locator('[data-reorder-item]').allInnerTexts();
  const before = (await items()).map((x) => x.replace(/[≡\s]+$/g, '').replace(/^≡\s*/, '').trim());
  const handle = dialog().locator('[data-reorder-item] [role=button]').first();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + hb.height + 14, { steps: 8 });
  await page.mouse.up();
  const after = (await items()).map((x) => x.replace(/^≡\s*/, '').trim());
  assert.equal(after[1], before[0], `dra flyttet ${before[0]} ned (${after.join(' | ')})`);
  await shot('endre-rekkefolge');
  await dialog().getByRole('button', { name: 'Ferdig' }).click();
  await dialog().waitFor({ state: 'detached' });
  assert.equal((await cardTitles())[1], before[0], 'rekkefølgen er lagret i økta');

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
  await page.getByText(/Tren (press|trekk).*-løft/).waitFor();
  const levelHeads = await page.locator('main h2').allInnerTexts();
  assert.ok(levelHeads.indexOf('Dine løft') >= 0 && levelHeads.indexOf('Dine løft') < levelHeads.indexOf('Kategorier'), `løftene står over kategoriene (${levelHeads.join(' | ')})`);
  await page.getByText(/Klarer du .* blir du/).first().waitFor();
  await shot('styrkeniva');
  await btn('Tilbake').click();
  await page.getByText('Siste rekorder').waitFor();

  // 5c. Kroppskartet: knebøy farger beina, brystet er ikke trent
  const bodyMap = page.getByRole('img', { name: /^Trent: .*bein/ });
  await bodyMap.waitFor();
  assert.match(await bodyMap.getAttribute('aria-label'), /Ikke trent: .*bryst/);
  await btn('Bein', { exact: true }).click();
  await page.getByRole('status').filter({ hasText: /Bein · .*sets siste 30 dager/ }).waitFor();
  await page.waitForTimeout(350);
  await page.getByRole('region', { name: 'Trent kropp' })
    .screenshot({ path: `tests/screens/${String(++n).padStart(2, '0')}-kroppskart.png` });
  // Tidsrom: 7 d, 12 mnd og år virker på kroppskartet
  await btn('7 d').click();
  await page.getByRole('status').filter({ hasText: /siste 7 dager/ }).waitFor();
  await btn('12 mnd').click();
  await page.getByRole('status').filter({ hasText: /siste 12 måneder/ }).waitFor();
  await page.getByLabel('Velg år').selectOption(String(new Date().getFullYear()));
  await page.getByRole('status').filter({ hasText: new RegExp(`Bein · .* i ${new Date().getFullYear()}`) }).waitFor();
  await btn('30 d').click();

  // 6. Historikk og kalender
  await page.getByRole('navigation').getByRole('link', { name: 'Historikk' }).click();
  await btn(/1 øvelse/).first().waitFor();
  assert.equal(await btn(/1 øvelse/).count(), 2, 'to økter i historikken');
  // Søk i historikken: på øvelse (også engelsk/norsk navn) og uten treff
  await page.getByLabel('Søk i historikken').fill('kneboy');
  await btn(/1 øvelse/).first().waitFor();
  await page.getByLabel('Søk i historikken').fill('finnes-ikke-xyz');
  await page.getByText('Ingen økter passer søket.').waitFor();
  await page.getByLabel('Søk i historikken').fill('');
  await btn('Kalender').click();
  await shot('kalender');

  // 6a. Kontotype: sosial konto bytter Historikk-fanen med Sosialt, og Historikk ligger under Fremgang
  {
    const nav = () => page.getByRole('navigation', { name: 'Hovedmeny' });
    // Lokal konto: «Sosial» kan ikke velges i Profil.
    await nav().getByRole('link', { name: 'Profil' }).click();
    await page.getByRole('radiogroup', { name: 'Kontotype' }).waitFor();
    await page.getByRole('radiogroup', { name: 'Kontotype' }).scrollIntoViewIfNeeded();
    await shot('kontotype');
    assert.equal(await page.getByRole('radio', { name: /Trening/ }).getAttribute('aria-checked'), 'true', 'trening er standard');
    assert.ok(await page.getByRole('radio', { name: /Sosial/ }).isDisabled(), 'sosial krever konto på nett');
    // Med den falske Sosialt-varianten (alt på enheten) kan en lokal konto velge Sosial.
    await page.evaluate(() => localStorage.setItem('repgrade-social-fake', '1'));
    await page.reload();
    // En annen bruker (Zara, åpen konto) finnes allerede i den falske Sosialt-lagringen.
    const fakeStore = () => page.evaluate(() => JSON.parse(localStorage.getItem('repgrade-fake-social') ?? 'null'));
    const putFake = (store) => page.evaluate((s) => localStorage.setItem('repgrade-fake-social', JSON.stringify(s)), store);
    const zara = { user_id: 'zara-id', handle: 'zara_test', display_name: 'Zara', color: '#4d9bf0', visibility: 3, is_16_plus: true, active: true, tier_index: 4, score: 45, lift_scores: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await putFake({ profiles: [zara], follows: [], blocks: [], reports: [], activities: [], reactions: [], challenges: [], members: [], notifications: [] });
    // Velg Sosial: appen går til Sosialt og ber deg lage en sosial profil
    await page.getByRole('radio', { name: /Sosial/ }).click();
    await page.getByRole('heading', { name: 'Lag sosial profil' }).waitFor();
    const handle = page.getByLabel('Brukernavn');
    await page.getByRole('status').filter({ hasText: 'Ledig' }).waitFor();
    assert.equal(await handle.inputValue(), 'ola', 'brukernavn foreslås fra navnet');
    assert.equal(await page.getByLabel('Navn som vises').inputValue(), 'Ola', 'navnet fra profilen');
    // Opptatt brukernavn, og rydding av det du skriver
    await handle.fill('Zara_Test');
    assert.equal(await handle.inputValue(), 'zara_test', 'små bokstaver');
    await page.getByRole('status').filter({ hasText: 'Opptatt' }).waitFor();
    await handle.fill('ola.løfter');
    assert.equal(await handle.inputValue(), 'ola.lofter', 'ø blir o');
    await page.getByRole('status').filter({ hasText: 'Ledig' }).waitFor();
    // Uten svar på alder kan profilen ikke lagres; Åpen og Ledertavler krever 16+
    assert.ok(await btn('Lag sosial profil').isDisabled(), 'må svare på alder');
    assert.ok(await page.getByRole('radio', { name: /^3\. Åpen/ }).isDisabled(), 'åpen krever 16+');
    await btn('Ja', { exact: true }).click();
    await page.getByRole('radio', { name: /^3\. Åpen/ }).click();
    assert.ok(await btn('Lag sosial profil').isDisabled(), 'må velge om gamle økter skal deles');
    await page.getByRole('radio', { name: /^Start fra null/ }).click();
    await shot('sosial-oppsett');
    await btn('Lag sosial profil').click();
    await page.getByText('@ola.lofter').waitFor();
    assert.equal((await fakeStore()).profiles.find((p) => p.handle === 'ola.lofter')?.visibility, 3, 'profilen er lagret som åpen');
    await nav().getByRole('link', { name: 'Sosialt' }).waitFor();
    assert.equal(await nav().getByRole('link', { name: 'Historikk' }).count(), 0, 'Historikk er ikke i bunnmenyen');
    // Styrkenivået regnes ut på telefonen og publiseres i den sosiale profilen (aldri kroppsvekten)
    await page.getByLabel(/^Nivå: /).waitFor({ timeout: 8000 });
    const published = (await fakeStore()).profiles.find((p) => p.handle === 'ola.lofter');
    assert.ok(published.tier_index !== null && published.score > 0 && published.lift_scores['ex-kneboy'] > 0, 'nivå og knebøy publisert');
    assert.deepEqual(Object.keys(published).sort(), ['active', 'color', 'created_at', 'display_name', 'handle', 'is_16_plus', 'lift_scores', 'score', 'share_from', 'tier_index', 'updated_at', 'user_id', 'visibility'], 'bare disse feltene deles (ingen kroppsvekt)');
    await shot('sosialt');
    // Profil → Endre sosial profil: under 16 gir bare privat. Zara følger deg uten at du følger tilbake → «Behold følgerne?»
    const store = await fakeStore();
    const me = store.profiles.find((p) => p.handle === 'ola.lofter').user_id;
    store.follows.push({ follower: 'zara-id', followee: me, status: 'accepted', created_at: new Date().toISOString(), accepted_at: new Date().toISOString() });
    await putFake(store);
    await nav().getByRole('link', { name: 'Profil' }).click();
    await btn('Endre sosial profil').click();
    await btn('Nei', { exact: true }).click();
    assert.equal(await page.getByRole('dialog').getByRole('radio', { name: /^1\. Privat/ }).getAttribute('aria-checked'), 'true', 'under 16 blir privat');
    assert.ok(await page.getByRole('radio', { name: /^3\. Åpen/ }).isDisabled(), 'åpen er låst under 16');
    await btn('Lagre', { exact: true }).click();
    await page.getByText('1 person følger deg som du ikke følger tilbake', { exact: false }).waitFor();
    await shot('behold-folgere');
    await btn('Velg selv').click();
    await page.getByLabel('Fjern Zara').check();
    await btn('Fjern 1 valgte').click();
    await page.getByText('1 følger fjernet').waitFor();
    assert.equal((await fakeStore()).follows.length, 0, 'Zara er fjernet som følger');
    assert.equal((await fakeStore()).profiles.find((p) => p.user_id === me).visibility, 1, 'nå privat');

    // ===== Steg 5: følge folk =====
    {
      const now = new Date().toISOString();
      const fake = (id, handle, name, visibility) => ({ ...zara, user_id: id, handle, display_name: name, visibility, is_16_plus: true, tier_index: 2, score: 25 });
      const st = await fakeStore();
      st.profiles.push(fake('per-id', 'per_test', 'Per', 1), fake('liv-id', 'liv_test', 'Liv', 1));
      st.follows.push({ follower: 'per-id', followee: me, status: 'pending', created_at: now, accepted_at: null });
      await putFake(st);
      await nav().getByRole('link', { name: 'Sosialt' }).click();
      await page.getByRole('tab', { name: /Folk/ }).click();
      // Forespørsel fra Per: godta
      await page.getByLabel('1 forespørsler').waitFor();
      const perRow = page.locator('[data-person="per_test"]');
      await perRow.getByRole('button', { name: 'Godta' }).click();
      await page.getByText('Godtatt', { exact: true }).waitFor();
      await perRow.getByRole('button', { name: 'Følg tilbake' }).waitFor();
      assert.equal((await fakeStore()).follows.find((f) => f.follower === 'per-id').status, 'accepted', 'Per er godtatt');
      // Søk: @zara_test (åpen) følges med en gang
      const find = page.getByLabel('Søk etter folk');
      const results = page.getByRole('list', { name: 'Treff' });
      await find.fill('@Zara_Test');
      await results.locator('[data-person="zara_test"]').getByRole('button', { name: 'Følg' }).click();
      await results.locator('[data-person="zara_test"]').getByRole('button', { name: 'Følger' }).waitFor();
      // Privat konto: finnes bare på hele brukernavnet, og gir forespørsel
      await find.fill('liv_test');
      await results.locator('[data-person="liv_test"]').getByRole('button', { name: 'Følg' }).click();
      await page.getByText('Forespørsel sendt til Liv').waitFor();
      await results.locator('[data-person="liv_test"]').getByRole('button', { name: 'Forespurt' }).waitFor();
      // Ingen treff
      await find.fill('finnes_ikke');
      await page.getByText('Fant ingen som heter «finnes_ikke».', { exact: false }).waitFor();
      await find.fill('');
      await shot('folk');
      // Zaras profil: nivå vises (åpen konto), rapporter og blokker
      await page.locator('[data-person="zara_test"]').first().getByRole('link').click();
      await page.getByRole('heading', { name: 'Zara', level: 2 }).waitFor();
      await page.getByText('Styrkenivå').waitFor();
      await shot('person');
      await btn('Valg').click();
      await btn('Rapporter').click();
      await btn('Spam', { exact: true }).click();
      await btn('Send rapport').click();
      await page.getByText('Takk. Rapporten er sendt.').waitFor();
      assert.equal((await fakeStore()).reports[0]?.target, 'zara-id', 'rapporten er lagret');
      await btn('Valg').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Blokker' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Blokker' }).click();
      await page.getByText('Zara er blokkert').waitFor();
      const after = await fakeStore();
      assert.ok(!after.follows.some((f) => f.follower === 'zara-id' || f.followee === 'zara-id'), 'blokkering fjerner følging');
      await page.getByRole('tab', { name: /Folk/ }).click();
      await btn('Blokkerte (1)').click();
      await btn('Opphev').click();
      await page.getByText('Blokkering opphevet').waitFor();
      assert.equal((await fakeStore()).blocks.length, 0, 'blokkering opphevet');
      // Invitasjonslenke (#/u/brukernavn) åpner profilen
      await page.goto(page.url().replace(/#.*$/, '#/u/per_test'));
      await page.getByRole('heading', { name: 'Per', level: 2 }).waitFor();
      await page.getByText('Følger deg').waitFor();
    }

    // ===== Steg 6: feed =====
    {
      const ago = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
      const st = await fakeStore();
      st.activities.push({
        user_id: 'zara-id', id: 'z1', name: 'Zara push', started_at: ago(5), ended_at: ago(4), created_at: ago(4), updated_at: ago(4),
        data: { version: 1, duration_s: 3600, sets: 3, reps: 24, volume_kg: 1440, records: [], muscles: { Bryst: 3 }, lifts: {}, tier: { index: 4, score: 45 },
          exercises: [{ exercise_id: 'ex-benkpress', name: 'Benkpress', kind: 'weight', muscle_group: 'Bryst', sets: [{ weight: 50, reps: 10, set_type: 'warmup' }, { weight: 60, reps: 8, set_type: 'normal' }, { weight: 62.5, reps: 8, set_type: 'normal', pr: true }] }] },
      });
      await putFake(st);
      // Logg en økt som sosial konto: den publiseres av seg selv
      await btn('Start økt').click();
      await btn(/Gjenta forrige/).click();
      await page.getByText('Knebøy').first().waitFor();
      await logSet(1, 110, 5);
      await btn('Avslutt', { exact: true }).click();
      await btn('Lagre økt').click();
      await btn('Bare denne gangen').click();
      await page.getByText('Økt fullført').waitFor();
      const shareSwitch = page.getByRole('switch', { name: 'Del i feeden' });
      assert.ok(await shareSwitch.isChecked(), 'økta deles som standard');
      await shot('oppsummering-deling');
      await btn('Ferdig').click();
      const mine = async () => (await fakeStore()).activities.filter((a) => a.user_id === me);
      for (let i = 0; i < 40 && (await mine()).length === 0; i++) await page.waitForTimeout(250);
      const [act] = await mine();
      assert.ok(act, 'økta er publisert');
      assert.equal(act.data.exercises[0].exercise_id, 'ex-kneboy', 'hele økta er med');
      assert.equal(act.data.exercises[0].sets[0].weight, 110, 'settene er med');
      // Feeden viser din og Zaras økt; Zaras viser alle sets med oppvarming (W) og rekord
      await nav().getByRole('link', { name: 'Sosialt' }).click();
      await page.getByRole('tab', { name: 'Feed' }).click();
      await page.locator(`[data-activity="${act.id}"]`).waitFor();
      const z = page.locator('[data-activity="z1"]');
      await z.getByText('Zara push').waitFor();
      await z.getByText('62,5 × 8').waitFor();
      await z.getByText('W', { exact: true }).waitFor();
      assert.ok(await page.locator(`[data-activity="${act.id}"]`).boundingBox().then((b) => b.y) < (await z.boundingBox()).y, 'nyeste øverst');
      await shot('feed');
      // Kudos: trykk 🔥 på Zaras økt, trykk igjen fjerner
      await z.getByRole('button', { name: '🔥 0' }).click();
      await z.getByRole('button', { name: '🔥 1', pressed: true }).waitFor();
      assert.equal((await fakeStore()).reactions.length, 1, 'reaksjonen er lagret');
      assert.ok((await fakeStore()).notifications.some((n) => n.user_id === 'zara-id' && n.kind === 'reaction'), 'Zara får varsel');
      await z.getByRole('button', { name: '💪 0' }).click();
      await z.getByRole('button', { name: '💪 1', pressed: true }).waitFor();
      assert.equal((await fakeStore()).reactions[0].emoji, '💪', 'bytter reaksjon');
      await z.getByRole('button', { name: '💪 1' }).click();
      await z.getByRole('button', { name: '💪 0', pressed: false }).waitFor();
      assert.equal((await fakeStore()).reactions.length, 0, 'reaksjonen er fjernet');
      // Egen økt: fjern fra feeden
      await page.locator(`[data-activity="${act.id}"]`).getByRole('button', { name: 'Valg for økta' }).click();
      await btn('Fjern fra feeden').click();
      await page.getByText('Økta er fjernet fra feeden').waitFor();
      for (let i = 0; i < 40 && (await mine()).length > 0; i++) await page.waitForTimeout(250);
      assert.equal((await mine()).length, 0, 'fjernet fra serveren');
      // Fra historikken: del igjen, så slett økta → borte fra feeden
      await nav().getByRole('link', { name: 'Fremgang' }).click();
      await page.getByRole('navigation', { name: 'Fremgang og historikk' }).getByRole('link', { name: 'Historikk' }).click();
      await btn(/1 øvelse/).first().click();
      assert.equal(await page.getByRole('switch', { name: 'Del i feeden' }).isChecked(), false, 'viser at den ikke er delt');
      await page.getByRole('switch', { name: 'Del i feeden' }).check();
      for (let i = 0; i < 40 && (await mine()).length === 0; i++) await page.waitForTimeout(250);
      assert.equal((await mine()).length, 1, 'delt igjen');
      await btn('Valg').click();
      await btn('Slett økt').click();
      for (let i = 0; i < 40 && (await mine()).length > 0; i++) await page.waitForTimeout(250);
      assert.equal((await mine()).length, 0, 'slettet økt er borte fra feeden');
    }

    // ===== Steg 7: ledertavler =====
    {
      const st = await fakeStore();
      const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
      st.activities.push({ user_id: 'zara-id', id: 'z0', name: 'Gammel', started_at: old, ended_at: old, created_at: old, updated_at: old, data: { version: 1, duration_s: 60, sets: 1, reps: 1, volume_kg: 1, exercises: [], records: [], muscles: {}, lifts: {}, tier: { index: 4, score: 40 } } });
      await putFake(st);
      // Ola er under 16 (valgt tidligere): tavlene er låst
      await nav().getByRole('link', { name: 'Sosialt' }).click();
      await page.getByRole('tab', { name: 'Topp' }).click();
      await page.getByText('Ledertavlene er for deg som er 16 år eller eldre.').waitFor();
      // 16+ og synlighet «Ledertavler»
      await nav().getByRole('link', { name: 'Profil' }).click();
      await btn('Endre sosial profil').click();
      await btn('Ja', { exact: true }).click();
      await page.getByRole('dialog').getByRole('radio', { name: /^2\. Ledertavler/ }).click();
      await btn('Lagre', { exact: true }).click();
      await page.getByText('Sosial profil lagret').waitFor();
      await nav().getByRole('link', { name: 'Sosialt' }).click();
      await page.getByRole('tab', { name: 'Topp' }).click();
      // Sterkest: Zara (åpen) og Ola (deg). Per og Liv er private og vises ikke.
      const board = page.getByRole('list', { name: 'Sterkest' });
      await board.getByText('Zara', { exact: true }).waitFor();
      await board.getByText('(deg)').waitFor();
      assert.equal(await board.getByText('Per', { exact: true }).count(), 0, 'private kontoer er ikke på tavla');
      await shot('ledertavle');
      // Fremgang: Zara 40 → 45 = +5
      await btn('Fremgang').click();
      await page.getByRole('list', { name: 'Fremgang' }).getByText('+5 p', { exact: true }).waitFor();
      // Flest økter denne måneden
      await btn('Flest økter').click();
      await page.getByRole('list', { name: 'Flest økter' }).or(page.getByText('Ingen på denne tavla ennå.')).first().waitFor();
      // Bare de du følger: Ola følger ikke Zara lenger (blokkert og opphevet tidligere)
      await btn('Sterkest').click();
      await btn('Følger', { exact: true }).click();
      await page.getByRole('list', { name: 'Sterkest' }).getByText('(deg)').waitFor();
      assert.equal(await page.getByRole('list', { name: 'Sterkest' }).getByText('Zara', { exact: true }).count(), 0, 'bare deg og dem du følger');
    }

    // ===== Steg 8: Oppdag =====
    {
      const st = await fakeStore();
      for (let i = 1; i <= 6; i++) st.profiles.push({ ...zara, user_id: `open-${i}`, handle: `aapen_${i}`, display_name: `Åpen ${i}`, visibility: 3 });
      await putFake(st);
      await nav().getByRole('link', { name: 'Hjem' }).click();
      await nav().getByRole('link', { name: 'Sosialt' }).click();
      await page.getByRole('tab', { name: /Folk/ }).click();
      // Oppdag: 7 åpne kontoer (Zara + 6), 5 vises først. Private (Per, Liv) og du selv er ikke med.
      const disc = page.getByRole('list', { name: 'Oppdag' });
      await disc.locator('[data-person]').first().waitFor();
      assert.equal(await disc.locator('[data-person]').count(), 5, '5 vises først');
      await btn('Vis 2 til').click();
      assert.equal(await disc.locator('[data-person]').count(), 7, 'alle åpne kontoer');
      for (const h of ['per_test', 'liv_test', 'ola.lofter']) assert.equal(await disc.locator(`[data-person="${h}"]`).count(), 0, `${h} er ikke i Oppdag`);
      await shot('oppdag');
      // Søk på navn finner åpne kontoer, ikke private
      const find = page.getByLabel('Søk etter folk');
      await find.fill('åpen 3');
      await page.getByRole('list', { name: 'Treff' }).locator('[data-person="aapen_3"]').waitFor();
      assert.equal(await page.getByRole('list', { name: 'Treff' }).locator('[data-person]').count(), 1, 'ett treff');
      await find.fill('Liv');
      await page.getByText('Private kontoer finnes bare på hele brukernavnet.', { exact: false }).waitFor();
      // Følg rett fra Oppdag
      await find.fill('');
      await disc.locator('[data-person="aapen_1"]').getByRole('button', { name: 'Følg' }).click();
      await disc.locator('[data-person="aapen_1"]').getByRole('button', { name: 'Følger' }).waitFor();
      // Blokkerte vises ikke i Oppdag
      const st2 = await fakeStore();
      st2.blocks.push({ blocker: 'open-2', blocked: me });
      await putFake(st2);
      await page.getByRole('tab', { name: 'Feed' }).click();
      await page.getByRole('tab', { name: /Folk/ }).click();
      await disc.locator('[data-person]').first().waitFor();
      assert.equal(await disc.locator('[data-person="aapen_2"]').count(), 0, 'den som blokkerte deg er borte');
    }

    // ===== Steg 9: utfordringer =====
    {
      const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();
      const DAY = 86_400_000;
      const act = (user, id, at) => ({ user_id: user, id, name: id, started_at: at, ended_at: at, created_at: at, updated_at: at, data: { version: 1, duration_s: 60, sets: 1, reps: 5, volume_kg: 500, exercises: [], records: [], muscles: {}, lifts: {}, tier: null } });
      await page.getByRole('tab', { name: 'Utfordringer' }).click();
      await page.getByText('Ingen utfordringer ennå').waitFor();
      await btn('Ny utfordring').click();
      // Hvem kan utfordres: Åpen 1 (åpen, du følger). Per følger deg, men du følger ikke Per tilbake.
      await page.getByLabel('Inviter Åpen 1').waitFor();
      assert.equal(await page.getByLabel('Inviter Per').count(), 0, 'kan ikke utfordre en du ikke følger gjensidig');
      assert.ok(await btn('Send utfordring').isDisabled(), 'må invitere noen');
      // Løft: pull-ups kan ikke velges (kroppsvekten ville blitt synlig)
      await btn('Løft', { exact: true }).click();
      const lifts = await page.getByRole('combobox').locator('option').allTextContents();
      assert.ok(lifts.includes('Knebøy') && !lifts.some((l) => /pull-ups/i.test(l)), 'løft uten pull-ups');
      await page.getByRole('combobox').selectOption({ label: 'Knebøy' });
      assert.equal(await page.getByLabel('Navn', { exact: true }).inputValue(), 'Knebøy – 1 uke', 'navn foreslås');
      // Flest økter, 2 uker
      await btn('Flest økter', { exact: true }).click();
      await btn('2 uker', { exact: true }).click();
      assert.equal(await page.getByLabel('Navn', { exact: true }).inputValue(), 'Flest økter – 2 uker');
      await page.getByLabel('Inviter Åpen 1').check();
      await shot('utfordring-ny');
      await btn('Send utfordring').click();
      await page.getByRole('heading', { name: 'Flest økter – 2 uker' }).waitFor();
      await page.getByText('Venter på svar').waitFor();
      const standings = page.getByRole('list', { name: 'Stilling' });
      await standings.getByText('(deg)').waitFor();
      // Åpen 1 blir med og trener: stillingen regnes fra delte økter
      const st = await fakeStore();
      const ch = st.challenges.find((c) => c.title === 'Flest økter – 2 uker');
      assert.equal(ch.creator, me, 'du laget utfordringen');
      st.members.find((m) => m.challenge_id === ch.id && m.user_id === 'open-1').status = 'joined';
      st.activities.push(act('open-1', 'o1', iso(60_000)));
      // Invitasjon til deg fra Åpen 1, og en ferdig utfordring som Åpen 1 vant
      st.challenges.push({ id: 'inv-1', creator: 'open-1', kind: 'weekly', exercise_id: null, target: 2, title: 'Uka', starts_at: iso(-DAY), ends_at: iso(6 * DAY), created_at: iso(-DAY) });
      st.members.push({ challenge_id: 'inv-1', user_id: 'open-1', status: 'joined', invited_at: iso(-DAY), joined_at: iso(-DAY) }, { challenge_id: 'inv-1', user_id: me, status: 'invited', invited_at: iso(-DAY), joined_at: null });
      st.challenges.push({ id: 'done-1', creator: 'open-1', kind: 'workouts', exercise_id: null, target: null, title: 'Forrige uke', starts_at: iso(-10 * DAY), ends_at: iso(-DAY), created_at: iso(-10 * DAY) });
      st.members.push({ challenge_id: 'done-1', user_id: 'open-1', status: 'joined', invited_at: iso(-10 * DAY), joined_at: iso(-10 * DAY) }, { challenge_id: 'done-1', user_id: me, status: 'joined', invited_at: iso(-10 * DAY), joined_at: iso(-10 * DAY) });
      st.activities.push(act('open-1', 'o0', iso(-5 * DAY)));
      await putFake(st);
      await page.reload();
      await standings.locator('[data-standing="aapen_1"]').getByText('1 økt').waitFor();
      assert.equal(await standings.locator('li').first().getAttribute('data-standing'), 'aapen_1', 'Åpen 1 leder');
      await shot('utfordring');
      // Invitasjon: bli med
      await page.goBack();
      await page.getByRole('tab', { name: 'Utfordringer' }).click();
      const invite = page.locator('[data-challenge="Uka"]');
      await invite.getByText('Fra Åpen 1', { exact: false }).waitFor();
      await shot('utfordringer');
      await invite.getByRole('button', { name: 'Bli med' }).click();
      await page.getByText('Du er med!').waitFor();
      assert.equal((await fakeStore()).members.find((m) => m.challenge_id === 'inv-1' && m.user_id === me).status, 'joined', 'med i Uka');
      // Ferdig utfordring: vinneren vises
      await page.locator('[data-challenge="Forrige uke"]').getByRole('link').click();
      await page.getByText('🏆 Åpen 1 vant').waitFor();
      await page.goBack();
      // Avlys din egen utfordring
      await page.locator('[data-challenge="Flest økter – 2 uker"]').getByRole('link').click();
      await btn('Avlys utfordringen').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Avlys' }).click();
      await page.getByRole('tab', { name: 'Utfordringer' }).waitFor();
      assert.ok(!(await fakeStore()).challenges.some((c) => c.title === 'Flest økter – 2 uker'), 'utfordringen er avlyst');
    }
    await nav().getByRole('link', { name: 'Fremgang' }).click();
    const tabs = page.getByRole('navigation', { name: 'Fremgang og historikk' });
    await tabs.getByRole('link', { name: 'Historikk' }).click();
    await btn(/1 øvelse/).first().waitFor();
    assert.match(await nav().getByRole('link', { name: 'Fremgang' }).getAttribute('class'), /text-accent/, 'Fremgang er aktiv på Historikk');
    await shot('historikk-under-fremgang');
    // Åpne en økt og gå tilbake: fortsatt under Fremgang
    await btn(/1 øvelse/).first().click();
    await page.goBack();
    await tabs.getByRole('link', { name: 'Fremgang' }).click();
    await page.getByRole('heading', { name: 'Fremgang', exact: true }).waitFor();
    // Kontotypen ligger i profilen og overlever omlasting
    await page.reload();
    await nav().getByRole('link', { name: 'Sosialt' }).waitFor();
    // Tilbake til treningskonto: appen er som før
    await nav().getByRole('link', { name: 'Profil' }).click();
    await page.getByRole('radio', { name: /Trening/ }).click();
    await page.evaluate(() => localStorage.removeItem('repgrade-social-fake'));
    await nav().getByRole('link', { name: 'Historikk' }).waitFor();
    assert.equal(await nav().getByRole('link', { name: 'Sosialt' }).count(), 0, 'ingen Sosialt-fane på treningskonto');
    await nav().getByRole('link', { name: 'Fremgang' }).click();
    await page.getByRole('heading', { name: 'Fremgang', exact: true }).waitFor();
    assert.equal(await page.getByRole('navigation', { name: 'Fremgang og historikk' }).count(), 0, 'ingen faner på Fremgang');
    await nav().getByRole('link', { name: 'Historikk' }).click();
    await btn(/1 øvelse/).first().waitFor();
  }

  // 6b. Etter en oppdatering fra 1.0 (uten nyhetsskjerm): «Nytt i denne versjonen» vises én gang
  // Ny telefon (ingen kjent versjon): ingen nyheter
  await page.evaluate(() => localStorage.removeItem('repgrade-seen-version'));
  await page.reload();
  await page.getByRole('navigation').first().waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.getByRole('heading', { name: 'Nytt i denne versjonen' }).count(), 0, 'ingen nyheter på ny telefon');
  // Oppdatert fra 1.1.0: nyhetene for alle versjoner siden vises, gruppert per versjon
  await page.evaluate(() => localStorage.setItem('repgrade-seen-version', '1.1.0'));
  await page.reload();
  await page.getByRole('heading', { name: 'Nytt i denne versjonen' }).waitFor();
  await page.getByText('Versjon 1.1.1').waitFor();
  await shot('nytt-etter-oppdatering');
  await page.getByRole('dialog').getByRole('button', { name: 'Fortsett' }).click();
  await page.reload();
  await page.getByRole('navigation').first().waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.getByRole('heading', { name: 'Nytt i denne versjonen' }).count(), 0, 'nyhetene vises bare én gang');

  // 7. Fremgang og øvelse
  await page.getByRole('navigation').getByRole('link', { name: 'Fremgang' }).click();
  await page.getByRole('heading', { name: 'Siste 30 dager', exact: true }).waitFor();
  await btn('12 mnd').click();
  await page.getByRole('heading', { name: 'Siste 12 måneder', exact: true }).waitFor();
  await shot('fremgang');
  await btn('30 d').click();
  await btn(/Knebøy/).click();
  await page.getByRole('img', { name: /Graf/ }).waitFor();
  await page.getByText('Prosent av 1RM').waitFor();
  await shot('ovelse');

  // 7b. 3D-demo for et stort løft: lerretet tegnes, pause og sakte film virker, og figuren kan snus
  await page.getByRole('tab', { name: 'Slik gjør du' }).click();
  // Demoen viser først et stillbilde; 3D lastes først ved trykk.
  await page.locator('[data-demo-poster="kneboy"]').waitFor();
  assert.equal(await page.locator('[data-demo3d]').count(), 0, '3D lastes ikke før man trykker');
  await btn('Vis 3D-demo av Knebøy').click();
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
  await page.getByText('Medlem siden').waitFor();
  await shot('profil');
  await page.getByRole('heading', { name: 'Innstillinger' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -60));
  await shot('innstillinger');

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
  await page.getByText('Medlem siden').waitFor();
  // Tilbake til 3 økter i uka, som resten av testen forventer.
  await btn(/^Økter per uke: 5/).click();
  await dialog().getByRole('button', { name: '3', exact: true }).click();
  await btn(/^Økter per uke: 3/).waitFor();

  // 9-1. Appfarge: velg blå, se at knapper og grafer følger, og at valget huskes
  await btn(/^Design/).click(); // innstillingene er gruppert og foldet sammen
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
  await page.getByText('Medlem siden').waitFor();

  // 9a. Data og backup: JSON og CSV lastes ned, og backupen kan leses inn igjen
  const { readFile } = await import('node:fs/promises');
  await btn(/^Data og backup/).click();
  await page.waitForTimeout(250);
  await btn('Last ned backup (JSON)').scrollIntoViewIfNeeded();
  await shot('innstillinger-data');
  const [jsonDl] = await Promise.all([page.waitForEvent('download'), btn('Last ned backup (JSON)').click()]);
  const backup = JSON.parse(await readFile(await jsonDl.path(), 'utf8'));
  assert.equal(backup.version, 2);
  assert.ok(backup.tables.sets.length >= 2, `backupen har sets (${backup.tables.sets.length})`);
  await page.getByText(/Siste backup:/).waitFor();
  const [csvDl] = await Promise.all([page.waitForEvent('download'), btn('Eksporter sets til regneark (CSV)').click()]);
  const csv = await readFile(await csvDl.path(), 'utf8');
  assert.match(csv, /date,workout,exercise,set,type,weight_kg,reps,distance_km,pr/);
  assert.match(csv, /Knebøy,1,normal,100,5/);
  await page.getByLabel('Velg fil å importere').setInputFiles(await jsonDl.path());
  await page.getByText(/Backup fra .* økter og .* sets/).waitFor();
  await shot('gjenopprett-backup');
  await btn('Importer', { exact: true }).click();
  await page.getByText(/Ferdig!/).waitFor();
  // Import fra Hevy (oppdiktet eksempelfil): to økter med sine egne navn havner i historikken
  await page.getByLabel('Velg fil å importere').setInputFiles(new globalThis.URL('./fixtures/hevy-sample.csv', import.meta.url).pathname);
  await page.getByText(/Eksport fra Hevy: 2 økter og 6 sets/).waitFor();
  await btn('Importer', { exact: true }).click();
  await page.getByText(/Ferdig! 2 økter/).waitFor();
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
  await ep.getByRole('button', { name: /^Design/ }).click();
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
