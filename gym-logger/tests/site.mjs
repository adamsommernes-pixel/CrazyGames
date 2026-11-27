// Sjekker nettstedet (landingsside + app under /app/) slik det publiseres på GitHub Pages.
//   npm run build:site && npm run site:check
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = 'dist-site';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  let path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(4190);
const BASE = 'http://localhost:4190/';

await mkdir('tests/screens', { recursive: true });
const browser = await chromium.launch();
const errors = [];
try {
  // Mobil: landingssiden på norsk, språkbytte, lenker til appen og personvern
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'nb-NO' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.getByRole('heading', { name: /Treningsdagboka som holder følge med deg/ }).waitFor();
  await page.screenshot({ path: 'tests/screens/site-mobil.png', fullPage: true });
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByRole('heading', { name: /A training log that keeps up with you/ }).waitFor();
  await page.getByRole('button', { name: 'NO' }).click();
  // Rull gjennom siden så lazy-bilder lastes, og sjekk alle synlige bilder.
  for (let y = 0; y < 8000; y += 600) { await page.mouse.wheel(0, 600); await page.waitForTimeout(80); }
  await page.waitForTimeout(500);
  for (const img of await page.locator('img:visible').all()) {
    assert.ok(await img.evaluate((i) => i.complete && i.naturalWidth > 0), `bildet lastet: ${await img.getAttribute('src')}`);
  }
  assert.equal(await page.getByText(/Gratis · ingen reklame/).count(), 0, 'ingen salgspunkt-linje');
  // Nettsiden er svart-hvit: ingen farger i CSS-en (skjermbildene er bilder og teller ikke).
  const css = await page.evaluate(() => [...document.styleSheets].flatMap((sh) => [...sh.cssRules].map((r) => r.cssText)).join(' '));
  const colours = [...css.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase());
  const grey = (h) => h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6);
  assert.deepEqual(colours.filter((h) => !grey(h)), [], 'bare gråtoner i nettsidens CSS');
  assert.ok(!/rgb\((?!(\d+), \1, \1)/.test(css), 'ingen fargede rgb()-verdier');
  await page.getByText('Hvor lagres dataene mine?').click();
  await page.getByRole('link', { name: 'Les personvernerklæringen' }).click();
  await page.getByRole('heading', { name: 'Kroppsdata er særlig beskyttet' }).waitFor();
  await page.goto(BASE);
  await page.getByRole('link', { name: 'Åpne appen' }).first().click();
  await page.getByRole('button', { name: 'Lag konto' }).waitFor();

  // Manifest og ikoner
  const manifest = await (await page.request.get(BASE + 'app/manifest.webmanifest')).json();
  assert.equal(manifest.name, 'Repgrade');
  assert.equal(manifest.start_url, '/app/');
  for (const src of [...manifest.icons, ...manifest.screenshots].map((i) => i.src)) {
    assert.equal((await page.request.get(BASE + 'app/' + src)).status(), 200, src);
  }

  // Offline: service workeren tar over, og appen åpner uten nett
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Lag konto' }).waitFor({ timeout: 8000 });
  await ctx.setOffline(false);
  await ctx.close();

  // Desktop: engelsk landingsside
  const desk = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-GB' });
  const dp = await desk.newPage();
  dp.on('pageerror', (e) => errors.push(e.message));
  await dp.goto(BASE);
  await dp.getByRole('heading', { name: /A training log that keeps up with you/ }).waitFor();
  await dp.screenshot({ path: 'tests/screens/site-desktop.png', fullPage: true });
  await desk.close();

  assert.deepEqual(errors, [], 'ingen JS-feil');
  console.log('✓ Nettstedet virker: landingsside, språk, lenker, manifest, ikoner og offline.');
} finally {
  await browser.close();
  server.close();
}
