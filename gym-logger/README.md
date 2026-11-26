# Gym Logger

Treningsapp (PWA) for gymmen: velg øvelse, logg sets, reps og vekt, og følg fremgangen. Svart og grønt design, norsk språk, virker uten nett.

## Funksjoner

**Konto og oppstart**
- Velkomstside første gang og etter utlogging.
- Registrering og innlogging med e-post og passord. Man kan bytte passord, logge ut og slette kontoen.
- Oppstart i fire steg: navn og farge, mål, økter per uke og erfaring, og til slutt enhet og kroppsvekt. Til slutt lages ferdige startrutiner etter mål og frekvens (Fullkropp A/B, Overkropp/Underkropp eller Push/Pull/Bein).
- Hver konto har sin egen database, så flere personer kan bruke samme enhet uten å se hverandres data.

**Trening**
- **Hjem**: ukemål som ring, streak i uker, ukas treningsdager, neste rutine og siste rekorder.
- **Startknapp** i midten av menyen: tom økt, rutine eller «Gjenta forrige».
- **Aktiv økt**:
  - forrige økt vises ved siden av hvert set
  - set-typer: vanlig, oppvarming, drop-set og til feil
  - notat per øvelse
  - platekalkulator
  - hold-inne-knapper for vekt og reps
  - fremdriftslinje
  - neste tomme sets får samme vekt når du fullfører et set
  - **progresjonsforslag**: nådde du mål-reps på alle sett sist, foreslås ett steg tyngre (+2,5 kg stang, +1 kg annet)
  - **oppvarming med ett trykk** for stangøvelser (40/60/80 %, avrundet til skivene dine)
  - **Enter-flyt**: Enter i vekt går til reps, og Enter i reps fullfører settet og går til neste
  - **skjermen holdes på** under økta (kan slås av)
- **Øvelsesvelger**: velg flere øvelser på én gang, med «Nylig brukt» og siste vekt × reps. Søket tåler at du skriver uten æ, ø og å («kneboy» finner Knebøy).
- **Angre**: sletting av set, øvelse, økt, rutine og kroppsvekt kan angres fra meldingen nederst på skjermen.
- **Hviletimer** starter når du huker av et set. Den har −15/+15, lyd og vibrasjon, og teller riktig når skjermen er låst.
- **Oppsummering** etter økta: rekorder med konfetti, volum mot forrige gang og muskelgrupper. Har du endret en rutine-økt underveis, kan rutinen oppdateres.
- **Glemt å avslutte?** Hjem spør når en økt har stått åpen i over 3 timer, og du setter varigheten selv.
- **Logg tidligere økt**: registrer en økt i ettertid med dato og klokkeslett.

**Oversikt**
- **Historikk** som liste eller kalender. Du kan rette vekt og reps, og endre navn, dato og varighet på ferdige økter.
- **Fremgang**: volum og økter per uke (12 uker), fordeling på muskelgrupper og 1RM per øvelse.
- **Øvelsesside**: rekorder, graf (tyngste, 1RM, volum), prosenttabell for 1RM, historikk og egne notater.
- **Rutiner** kan dupliseres.
- **Kroppsvekt**: logg og graf.
- **Profil**: livstidstall, rediger profil, konto, innstillinger (enhet, hvile, stang og skiver, lyd og vibrasjon) og backup til JSON.

## To typer konto

| | Lokal konto | Sky-konto |
|---|---|---|
| Når | Appen er bygget uten Supabase-nøkler (bl.a. claude.ai-versjonen) | `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` er satt |
| Lagring | Bare på enheten (IndexedDB) | Lokalt først, og synket til Supabase |
| Passord | PBKDF2-SHA256, 210 000 runder, tilfeldig salt | Supabase Auth |
| Glemt passord | Kan ikke tilbakestilles | Lenke på e-post |

Data fra versjon 1, fra før appen hadde kontoer, kan flyttes inn i den første kontoen som lages på enheten. Appen spør om det under oppstarten.

## Utvikling

```bash
cd gym-logger
npm install
npm run dev        # http://localhost:5173
npm test           # enhetstester (Vitest)
npm run build
npm run e2e        # ende-til-ende i iPhone-visning (Playwright + Chromium)
ARTIFACT=1 npx vite build   # versjon for claude.ai (dist-artifact/)
```

Teknologi: React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), Recharts, vite-plugin-pwa, Supabase, Inter og Space Grotesk (pakket med appen).

## Publisering (GitHub Pages)

1. I GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Workflowen `.github/workflows/gym-logger-pages.yml` bygger og publiserer når `gym-logger/` endres på repoets standardgren. Den kan også startes manuelt under **Actions**.
3. Appen ligger da på `https://<brukernavn>.github.io/<repo>/`.

Slik installeres den på telefonen:
- **iPhone**: Safari → Del → «Legg til på Hjem-skjerm».
- **Android**: Chrome → meny → «Installer app».

## Sky-kontoer med Supabase (valgfritt)

1. Lag et gratis prosjekt på [supabase.com](https://supabase.com).
2. Kjør disse filene i **SQL Editor**, i denne rekkefølgen:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_profiles.sql` (profiler, kroppsvekt, set-typer og sletting av konto)
   - `supabase/migrations/003_qol.sql` (mål-reps per øvelse i økta, til progresjonsforslag)
3. Velg om e-post skal bekreftes, under **Authentication → Sign In / Providers → Email**:
   - Med bekreftelse ber appen brukeren sjekke e-posten etter registrering.
   - Uten bekreftelse logges brukeren inn med en gang.
4. Under **Project Settings → API** kopierer du Project URL og anon public key:
   - Lokalt: `.env.local` (se `.env.example`).
   - GitHub Pages: repository secrets `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY`.

Anon-nøkkelen er laget for å ligge i nettleseren. Row Level Security sørger for at hver bruker bare ser egne rader.

Synken skriver alt lokalt først. Når det er nett, sendes endringene og nye endringer hentes. Ved konflikt vinner siste endring.

## Struktur

```
src/
  auth/        innlogging: lokal og Supabase bak samme grensesnitt, passord-hashing
  db/          Dexie-skjema (én database per konto), datafunksjoner, maler, synk, backup, v1-migrering
  lib/         1RM, PR, statistikk (ukemål, streak), platekalkulator, formatering, innstillinger
  components/  knapper, kort, ark, stepper, ring, avatar, kalender, grafer, platekalkulator
  features/    welcome, auth, onboarding, home, workout, summary, history, progress,
               exercise, bodyweight, routines, profile
supabase/      SQL-migreringer
tests/         e2e-skript (Playwright)
```
