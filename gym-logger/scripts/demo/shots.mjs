// Tar skjermbilder av alle 3D-demoene i tre faser til en mappe (for visuell sjekk):
//   node scripts/demo/shots.mjs <mappe> [slug ...]
// eller lager stillbildene appen viser når nettleseren mangler WebGL (public/demos/<slug>.jpg):
//   npm run demo:stills
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const stills = process.argv[2] === '--stills';
const out = stills ? 'public/demos' : (process.argv[2] ?? 'tests/demo-shots');
const only = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const slugs = only.length ? only : ['kneboy', 'frontboy', 'utfall', 'markloft', 'rumensk-markloft', 'benkpress', 'skrabenk', 'militaerpress', 'dips', 'stangroing', 'nedtrekk', 'pull-ups'];
const server = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 100; i++) {
  if (await fetch('http://localhost:5199/scripts/demo/preview.html').then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 200));
}
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 420, height: 420 }, deviceScaleFactor: stills ? 1.5 : 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
for (const slug of slugs) {
  if (stills) {
    await page.goto(`http://localhost:5199/scripts/demo/preview.html?slug=${slug}`);
    await page.waitForSelector('body[data-ready]');
    await page.screenshot({ path: `${out}/${slug}.jpg`, type: 'jpeg', quality: 78 });
    continue;
  }
  for (const [i, phase] of [0, 0.25, 0.5].entries()) {
    await page.goto(`http://localhost:5199/scripts/demo/preview.html?slug=${slug}&phase=${phase}`);
    await page.waitForSelector('body[data-ready]');
    await page.screenshot({ path: `${out}/${slug}-${i}.png` });
  }
}
await browser.close();
server.kill();
console.log(`✓ ${stills ? slugs.length : slugs.length * 3} bilder i ${out}`);
