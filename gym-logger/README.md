# Gym Logger

Mobilapp (PWA) for å logge treningsøkter: velg øvelse, logg sets, reps og vekt. Svart og grønt design, norsk språk.

## Funksjoner

- **Aktiv økt**: legg til øvelser fra et bibliotek med 64 øvelser (eller lag egne), logg vekt og reps, hak av sets.
- **Forrige økt**: det du løftet sist vises ved siden av hvert set, og nye sets fylles ut med forrige vekt og reps.
- **Hviletimer**: starter av seg selv når du huker av et set, med −15/+15, lyd og vibrasjon. Teller riktig selv om skjermen låses.
- **Rutiner**: lagre faste økter (Push, Pull, Bein …) og start dem med ett trykk.
- **Historikk**: alle økter, med varighet, volum og rekorder.
- **Fremgang og PR**: grafer per øvelse (tyngste set, beregnet 1RM etter Epley, volum) og automatiske rekordmerker.
- **Offline først**: alt lagres lokalt (IndexedDB) og virker uten dekning.
- **Sky-synk (valgfritt)**: logg inn med kode på e-post og synk mellom enheter via Supabase.
- **Backup**: eksport og import til JSON.

## Utvikling

```bash
cd gym-logger
npm install
npm run dev        # http://localhost:5173
npm test           # enhetstester (Vitest)
npm run build
npm run e2e        # ende-til-ende i iPhone-visning (krever Playwright + Chromium)
```

Teknologi: React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), Recharts, vite-plugin-pwa, Supabase.

## Publisering (GitHub Pages)

1. I GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Når `gym-logger/` endres på repoets standardgren, bygges og publiseres appen av `.github/workflows/gym-logger-pages.yml`.
   Du kan også starte den manuelt under **Actions → Gym Logger → Run workflow**.
3. Appen ligger da på `https://<brukernavn>.github.io/<repo>/`.

### Installer på telefonen

- **iPhone**: åpne lenken i Safari → Del → «Legg til på Hjem-skjerm».
- **Android**: åpne i Chrome → meny → «Installer app».

## Sky-synk med Supabase (valgfritt)

Uten Supabase-nøkler kjører appen bare lokalt.

1. Lag et gratis prosjekt på [supabase.com](https://supabase.com).
2. **SQL Editor**: kjør innholdet i `supabase/migrations/001_init.sql`.
3. **Authentication → Email Templates → Magic Link**: legg til koden i e-posten, f.eks. `Koden din er {{ .Token }}`.
   Appen bruker engangskode i stedet for lenke, fordi en lenke på iPhone åpnes i Safari og ikke i den installerte appen.
4. **Project Settings → API**: kopier Project URL og anon public key.
   - Lokalt: lag `.env.local` etter mønster av `.env.example`.
   - GitHub Pages: legg dem inn som repository secrets `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY`.

Anon-nøkkelen er laget for å ligge i nettleseren. Tilgangen styres av Row Level Security, så hver bruker ser bare sine egne data.

### Slik fungerer synken

- Alle endringer skrives først lokalt og merkes som «ikke sendt».
- Appen synker ved oppstart, ved innlogging, når nettet kommer tilbake, når appen åpnes igjen, og noen sekunder etter hver endring.
- Ved konflikt vinner siste endring. Slettinger synkes som myk sletting.
- Innebygde øvelser har faste id-er og synkes ikke. Egne øvelser synkes.

## Struktur

```
src/
  db/          Dexie-skjema, typer, datafunksjoner (repo.ts), synk, backup
  lib/         beregninger (1RM, volum, PR), formatering, innstillinger, Supabase-klient
  components/  knapper, kort, ark, stepper, bunnmeny, ikoner
  features/    workout, history, routines, progress, profile, auth
supabase/      SQL-migrering
tests/         e2e-skript (Playwright)
```
