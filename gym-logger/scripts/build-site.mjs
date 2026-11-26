// Bygger nettstedet for GitHub Pages: landingssiden i roten og appen under app/.
//   SITE_BASE=/repo-navn/ node scripts/build-site.mjs   (standard: /)
//   SITE_DOMAIN=repgrade.no node scripts/build-site.mjs  (eget domene: skriver CNAME, bruk SITE_BASE=/)
// Resultat i dist-site/.
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, writeFileSync } from 'node:fs';

const siteBase = (process.env.SITE_BASE ?? '/').replace(/\/?$/, '/');
const out = 'dist-site';
rmSync(out, { recursive: true, force: true });

const r = spawnSync('node_modules/.bin/vite', ['build', '--outDir', `${out}/app`, '--emptyOutDir'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: `${siteBase}app/` },
});
if (r.status !== 0) process.exit(r.status ?? 1);

cpSync('landing/index.html', `${out}/index.html`);
// Fontene ligger hos oss (ingen Google Fonts), så besøkende ikke sendes til tredjeparter.
const fonts = { 'space-grotesk-700.woff2': '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2', 'space-grotesk-500.woff2': '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2', 'inter.woff2': '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2' };
for (const [name, src] of Object.entries(fonts)) cpSync(`node_modules/${src}`, `${out}/fonts/${name}`);
// GitHub Pages: ikke kjør Jekyll (filer som starter med _ skal med).
writeFileSync(`${out}/.nojekyll`, '');
// Eget domene (f.eks. repgrade.no): GitHub Pages leser domenet fra CNAME-filen.
const domain = (process.env.SITE_DOMAIN ?? '').trim();
if (domain) writeFileSync(`${out}/CNAME`, `${domain}\n`);
console.log(`✓ Nettsted bygget i ${out}/ (landingsside på ${siteBase}, app på ${siteBase}app/)`);
