// Screenshot one stage in isolation.
// node dev/shoot_stage.js <stage> <out-dir> '<json array of {cam, p, u, dur?, T?}>' [width=1280] [height=720]
// Needs playwright-core; CHROMIUM_PATH and THREE_PATH env vars point at a Chromium binary and a local three@0.147.0 build.
const { chromium } = require(process.env.PW_PATH || 'playwright-core');
const fs = require('fs'), path = require('path');
const [,, stage, outDir, shotsJson, W = '1280', H = '720'] = process.argv;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  if (process.env.THREE_PATH) await page.route('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', r => r.fulfill({ path: process.env.THREE_PATH, contentType: 'application/javascript' }));
  await page.goto('file://' + path.resolve(__dirname, 'stage.html') + '?stage=' + stage);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error);
  if (err) { console.log(err); process.exit(1); }
  await page.evaluate(() => window.__ready);
  const shots = JSON.parse(shotsJson);
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const r = await page.evaluate(a => window.__render(a.u || 0, a.p || {}, a.cam, a.T, a.dur || 10), s);
    const f = path.join(outDir, `${stage}_${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    console.log(f, JSON.stringify(s), 'cameras:', r.cameras.join(','), 'calls:', r.calls);
  }
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
