// Bygger nettstedet for GitHub Pages: landingssiden i roten og appen under app/.
//   SITE_BASE=/repo-navn/ node scripts/build-site.mjs   (standard: /)
//   SITE_DOMAIN=repgrade.no node scripts/build-site.mjs  (eget domene: skriver CNAME, bruk SITE_BASE=/)
// Resultat i dist-site/.
import { spawnSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const siteBase = (process.env.SITE_BASE ?? '/').replace(/\/?$/, '/');
const out = 'dist-site';
rmSync(out, { recursive: true, force: true });

const r = spawnSync('node_modules/.bin/vite', ['build', '--outDir', `${out}/app`, '--emptyOutDir'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: `${siteBase}app/` },
});
if (r.status !== 0) process.exit(r.status ?? 1);

// Full adresse til nettstedet (for sitemap og canonical). Eget domene, ellers github.io-adressen.
const domainEnv = (process.env.SITE_DOMAIN ?? '').trim();
const origin = (process.env.SITE_ORIGIN ?? (domainEnv ? `https://${domainEnv}` : 'https://adamsommernes-pixel.github.io')).replace(/\/$/, '');
const siteUrl = `${origin}${siteBase}`;
writeFileSync(`${out}/index.html`, readFileSync('landing/index.html', 'utf8').replaceAll('%SITE_URL%', siteUrl));
// Bekreftelsesfil for Google Search Console (googleXXXX.html) ligger i landing/.
for (const f of readdirSync('landing')) if (/^google[0-9a-f]+\.html$/.test(f)) cpSync(`landing/${f}`, `${out}/${f}`);
// Sitemap og robots for søkemotorer. (robots.txt virker bare i roten av et domene, altså med eget domene.)
writeFileSync(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);
writeFileSync(`${out}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
// Fontene ligger hos oss (ingen Google Fonts), så besøkende ikke sendes til tredjeparter.
const fonts = { 'space-grotesk-700.woff2': '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2', 'space-grotesk-500.woff2': '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2', 'inter.woff2': '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2' };
for (const [name, src] of Object.entries(fonts)) cpSync(`node_modules/${src}`, `${out}/fonts/${name}`);
// GitHub Pages: ikke kjør Jekyll (filer som starter med _ skal med).
writeFileSync(`${out}/.nojekyll`, '');
// Eget domene (f.eks. repgrade.no): GitHub Pages leser domenet fra CNAME-filen.
const domain = (process.env.SITE_DOMAIN ?? '').trim();
if (domain) writeFileSync(`${out}/CNAME`, `${domain}\n`);
console.log(`✓ Nettsted bygget i ${out}/ (landingsside på ${siteBase}, app på ${siteBase}app/)`);
