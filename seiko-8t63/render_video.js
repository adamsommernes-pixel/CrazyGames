// Renders the guided tour to numbered JPEG frames with a headless browser.
// Usage: node render_video.js <out-dir> [fps=30] [width=1280] [height=720] [first-frame] [last-frame]
// Needs: npm i playwright-core, plus a Chromium build (set CHROMIUM_PATH if it is not on the default path).
// Then: ffmpeg -framerate 30 -i out-dir/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 seiko-8t63.mp4
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const [,, outDir, fpsArg = '30', wArg = '1280', hArg = '720', firstArg, lastArg] = process.argv;
const fps = +fpsArg, W = +wArg, H = +hArg;
const THREE_LOCAL = process.env.THREE_PATH; // optional local copy of three@0.147.0/build/three.min.js
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const body = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const page_html = path.resolve(outDir, '_capture.html');
  fs.writeFileSync(page_html, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  if (THREE_LOCAL) await page.route('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', r => r.fulfill({ path: THREE_LOCAL, contentType: 'application/javascript' }));
  await page.goto('file://' + page_html + '?capture=1');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__ready);
  const total = await page.evaluate(() => window.__total);
  const n = Math.ceil(total * fps);
  const first = firstArg ? +firstArg : 0, last = lastArg ? Math.min(+lastArg, n - 1) : n - 1;
  const t0 = Date.now();
  for (let i = first; i <= last; i++) {
    await page.evaluate(T => window.__seek(T), i / fps);
    await page.screenshot({ path: path.join(outDir, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if ((i - first) % 100 === 0) console.log(`frame ${i}/${last} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`done ${first}-${last} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
