// Lager PNG-ikoner fra public/favicon.svg med Playwright (Chromium).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Playwright hentes fra prosjektet eller den globale installasjonen.
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = await readFile(path.join(dir, 'favicon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(file, size, { padded = false, rounded = true } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable: ikonet krympes inn i trygg sone på helsvart bakgrunn.
  const inner = padded ? Math.round(size * 0.7) : size;
  const body = rounded ? svg : svg.replace('rx="112"', 'rx="0"');
  await page.setContent(`<html><body style="margin:0;background:#0A0A0A;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${body.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: path.join(dir, file), omitBackground: false });
}

await render('icon-192.png', 192, { rounded: false });
await render('icon-512.png', 512, { rounded: false });
await render('icon-maskable-512.png', 512, { padded: true, rounded: false });
await render('apple-touch-icon.png', 180, { rounded: false });
await browser.close();
console.log('Ikoner laget i public/');
