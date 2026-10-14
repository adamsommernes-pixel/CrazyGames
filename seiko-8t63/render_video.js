// Render the film to numbered JPEG frames with headless Chromium (deterministic capture mode).
// Usage: node render_video.js <out-dir> [fps=24] [width=1280] [height=720] [first-frame] [last-frame]
// Env: CHROMIUM_PATH (Chromium binary), THREE_PATH (local three@0.147.0 build if the CDN is unreachable),
//      PW_PATH (playwright-core module path if not installed locally).
// Then mux with the soundtrack: ffmpeg -framerate 24 -i out/f%05d.jpg -i audio/film.m4a -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a copy -shortest film.mp4
const { chromium } = require(process.env.PW_PATH || 'playwright-core');
const fs = require('fs'), path = require('path');
const [,, outDir, fpsArg = '24', wArg = '1280', hArg = '720', firstArg, lastArg] = process.argv;
const fps = +fpsArg, W = +wArg, H = +hArg;
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const body = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const page_html = path.join(__dirname, '.capture.html');   // next to index.html so relative script paths resolve
  if (!fs.existsSync(page_html)) fs.writeFileSync(page_html, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e.message));
  if (process.env.THREE_PATH) await page.route('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', r => r.fulfill({ path: process.env.THREE_PATH, contentType: 'application/javascript' }));
  await page.goto('file://' + page_html + '?capture=1');
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await page.evaluate(() => window.__ready);
  const total = await page.evaluate(() => window.__total);
  const n = Math.ceil(total * fps);
  const first = firstArg ? +firstArg : 0, last = lastArg ? Math.min(+lastArg, n - 1) : n - 1;
  const t0 = Date.now();
  for (let i = first; i <= last; i++) {
    const f = path.join(outDir, `f${String(i).padStart(5, '0')}.jpg`);
    if (fs.existsSync(f) && fs.statSync(f).size > 1000) continue;   // resumable
    await page.evaluate(T => window.__seek(T), i / fps);
    await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
    if ((i - first) % 200 === 0) console.log(`frame ${i}/${last} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`done ${first}-${last} in ${((Date.now() - t0) / 1000).toFixed(0)}s (${n} frames total)`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
