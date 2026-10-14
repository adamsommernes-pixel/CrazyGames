// Export the director's timeline and sound-effect cue sheet as JSON (used by tools/mix.py).
// Usage: node tools/export_timeline.js timeline.json sfx.json   (env as for render_video.js)
const { chromium } = require(process.env.PW_PATH || 'playwright-core');
const fs = require('fs'), path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const body = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const page_html = path.join(root, '.capture.html');
  fs.writeFileSync(page_html, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.THREE_PATH) await page.route('https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', r => r.fulfill({ path: process.env.THREE_PATH, contentType: 'application/javascript' }));
  await page.goto('file://' + page_html + '?capture=1');
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const tl = await page.evaluate(() => window.__timeline());
  fs.writeFileSync(process.argv[2], JSON.stringify(tl, null, 1));
  const sfx = await page.evaluate(() => window.__sfx());
  fs.writeFileSync(process.argv[3], JSON.stringify(sfx));
  console.log(`timeline ${tl.total.toFixed(1)} s, ${tl.shots.length} shots, ${tl.lines.length} lines, ${sfx.length} cues`);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  await browser.close();
})();
