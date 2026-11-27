// Skjermbilder av alle nivå- og rekordvarslene: node scripts/preview/level-shots.mjs <mappe>
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'tests/level-shots';
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', '--port', '5198', '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 100; i++) {
  if (await fetch('http://localhost:5198/scripts/preview/levels.html').then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 200));
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const cases = [
  ['1-ny-rekord', 'case=record&tier=5'],
  ['2-nytt-niva-pa-loftet', 'case=liftup&tier=4'],
  ['3-nytt-rangert-loft', 'case=ranked&tier=3'],
  ['4-nytt-niva-gra', 'case=levelup&tier=1'],
  ['5-nytt-niva-ring', 'case=levelup&tier=4'],
  ['6-nytt-niva-fylt', 'case=levelup&tier=7'],
  ['7-nytt-niva-olympia', 'case=levelup&tier=9'],
  ['8-ny-rekord-bla', 'case=record&tier=6&accent=%234d9bf0'],
  ['9-new-level-en', 'case=levelup&tier=5&lang=en'],
  ['10-hva-er-nytt', 'case=whatsnew'],
];
for (const [name, qs] of cases) {
  await page.goto(`http://localhost:5198/scripts/preview/levels.html?${qs}`);
  await page.waitForTimeout(qs.includes('levelup') ? 1600 : 1700);
  await page.screenshot({ path: `${out}/${name}.png` });
}
await browser.close();
server.kill();
console.log(`✓ ${cases.length} bilder i ${out}`);
