// Lager reklamefilmen: setter sammen scenen (stage.html) med skjermbildene, tar bilde for bilde og
// koder video med voiceoveren.
//   node scripts/ad/render.mjs <skjermbilde-mappe> <ut-mappe> [--preview]
// Gir <ut-mappe>/socials-1080.mp4 (1080 × 1920), public/ad/socials.mp4 og .webm (720 × 1280, til appen) og public/ad/socials-poster.jpg.
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const [shotsDir, outDir] = process.argv.slice(2);
const preview = process.argv.includes('--preview');
if (!shotsDir || !outDir) throw new Error('Bruk: node scripts/ad/render.mjs <skjermbilder> <ut-mappe>');
const FPS = preview ? 10 : 30;
const DURATION = 38.75;
const stage = resolve(outDir, 'stage');
rmSync(stage, { recursive: true, force: true });
mkdirSync(`${stage}/fonts`, { recursive: true });
cpSync('scripts/ad/stage.html', `${stage}/stage.html`);
cpSync('scripts/ad/stage.js', `${stage}/stage.js`);
cpSync('public/favicon.svg', `${stage}/logo.svg`);
cpSync('node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2', `${stage}/fonts/sg-700.woff2`);
cpSync('node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2', `${stage}/fonts/sg-500.woff2`);
cpSync('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', `${stage}/fonts/inter.woff2`);
cpSync(shotsDir, `${stage}/shots`, { recursive: true });
writeFileSync(`${stage}/shots.js`, `window.shots = ${readFileSync(`${shotsDir}/shots.json`, 'utf8')};`);

const frames = resolve(outDir, 'frames');
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`file://${stage}/stage.html`);
await page.evaluate(() => window.ready);
const total = Math.ceil(DURATION * FPS);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.renderAt(t), i / FPS);
  await page.screenshot({ path: `${frames}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (i % 100 === 0) process.stdout.write(`${i}/${total} `);
}
await browser.close();
if (errors.length) throw new Error('Feil i scenen: ' + errors.join('; '));

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg feilet');
};
const audio = 'scripts/ad/voiceover.mp3';
const input = ['-framerate', String(FPS), '-i', `${frames}/%05d.jpg`, '-i', audio];
ff([...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', `${outDir}/socials-1080.mp4`]);
if (!preview) {
  mkdirSync('public/ad', { recursive: true });
  ff([...input, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', 'public/ad/socials.mp4']);
  ff([...input, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-c:a', 'libopus', '-b:a', '80k', '-shortest', 'public/ad/socials.webm']);
  ff(['-i', `${frames}/${String(Math.round(3.6 * FPS)).padStart(5, '0')}.jpg`, '-vf', 'scale=720:1280', '-q:v', '4', 'public/ad/socials-poster.jpg']);
}
console.log(`\n✓ ${outDir}/socials-1080.mp4${preview ? ' (forhåndsvisning)' : ', public/ad/socials.mp4 og socials-poster.jpg'}`);
