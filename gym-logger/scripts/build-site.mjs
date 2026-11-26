// Bygger nettstedet for GitHub Pages: landingssiden i roten og appen under app/.
//   SITE_BASE=/repo-navn/ node scripts/build-site.mjs   (standard: /)
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
// GitHub Pages: ikke kjør Jekyll (filer som starter med _ skal med).
writeFileSync(`${out}/.nojekyll`, '');
console.log(`✓ Nettsted bygget i ${out}/ (landingsside på ${siteBase}, app på ${siteBase}app/)`);
