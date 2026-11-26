import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { normalizeSupabaseConfig } from './src/lib/supabaseConfig';

// Stopp bygget med en tydelig melding hvis Supabase-verdiene er feil, i stedet for en mørk skjerm på nettet.
const sbConfig = normalizeSupabaseConfig(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
if (sbConfig && 'error' in sbConfig) {
  throw new Error(`Supabase-oppsettet er feil: ${sbConfig.error}`);
}

// BASE_PATH settes av GitHub Actions (f.eks. /CrazyGames/). Lokalt: /
// ARTIFACT=1 bygger en versjon for claude.ai: relative stier og ingen service worker.
const artifact = process.env.ARTIFACT === '1';
const base = artifact ? './' : (process.env.BASE_PATH ?? '/');

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
    __ARTIFACT__: JSON.stringify(artifact),
  },
  build: artifact ? { outDir: 'dist-artifact' } : undefined,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: artifact,
      // «prompt»: ny versjon tas i bruk når brukeren trykker «Oppdater», aldri midt i en økt.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Repgrade',
        short_name: 'Repgrade',
        description: 'Logg treningen din og klatre fra Nybegynner til Olympia. Log your training and climb from Newbie to Olympia.',
        lang: 'nb',
        theme_color: '#0A0A0A',
        background_color: '#0A0A0A',
        display: 'standalone',
        orientation: 'portrait',
        id: base,
        start_url: base,
        scope: base,
        categories: ['health', 'fitness', 'sports'],
        shortcuts: [{ name: 'Start økt / Start workout', short_name: 'Start', url: `${base}#/workout`, icons: [{ src: 'icon-192.png', sizes: '192x192' }] }],
        screenshots: [
          ...['home', 'workout', 'levelup', 'level'].map((n) => ({ src: `screenshots/${n}-nb.webp`, sizes: '540x919', type: 'image/webp', form_factor: 'narrow' })),
          { src: 'screenshots/share-nb.webp', sizes: '540x960', type: 'image/webp', form_factor: 'narrow' },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Bare latinske fonter i offline-lageret; andre tegnsett hentes ved behov.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*latin*.woff2'],
        globIgnores: ['screenshots/**'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
