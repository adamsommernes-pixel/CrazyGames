# Repgrade

*Tidligere «Gym Logger». Mappen i repoet heter fortsatt `gym-logger/`, og databasen og gamle backupfiler fungerer som før.*

Treningsapp (PWA) for gymmen: velg øvelse, logg sets, reps og vekt, og følg fremgangen. Svart og grønt design, norsk og engelsk, virker uten nett.

> **English:** A gym-logging PWA. Pick an exercise, log sets, reps and weight, and follow your progress. Black and green design, works offline.
> - Available in **Norwegian and English**. Switch on the welcome page (NO / EN) or under Profile → Settings → Language. On first visit the app follows the browser language.
> - Built-in exercises have English names and how-to guides, and search finds them in both languages («squat» finds Knebøy).
> - **Muscles trained**: a front and back body figure on Home shows which muscle groups you have trained in the last 7 or 30 days. Secondary muscles count half a set. Tap a muscle for sets and the date you last trained it.
> - **Strength level**: ten levels from Newbie to Olympia, based on your best estimated 1RM in key lifts (bench, squat, deadlift, overhead press, rows, pull-ups, dips and variations) relative to bodyweight, with separate standards for men and women. Push, pull and legs are averaged. A new best lift pops up a record card, and a new overall level shows a full-screen «Level up». The level shows on Home and on its own page.
> - **Share cards**: after a workout (or from History) share an image in four levels: Basic, Stats, Highlights (muscle figure, records, top sets) and Full workout, in story 9:16 or post 4:5.
> - Development: `npm install`, `npm run dev`, `npm test`, `npm run build && npm run e2e`.

## Funksjoner

**Konto og oppstart**
- Velkomstside første gang og etter utlogging.
- Registrering og innlogging med e-post og passord. Man kan bytte passord, logge ut og slette kontoen.
- Oppstart i fire steg: navn og farge, mål, økter per uke og erfaring, og til slutt enhet og kroppsvekt. Til slutt lages ferdige startrutiner etter mål og frekvens (Fullkropp A/B, Overkropp/Underkropp eller Push/Pull/Bein).
- Hver konto har sin egen database, så flere personer kan bruke samme enhet uten å se hverandres data.

**Språk**
- Norsk og engelsk. Bytt med NO / EN på velkomstsiden eller under Profil → Innstillinger → Språk. Første gang følger appen nettleserens språk.
- Øvelsesnavn og fremgangsmåter finnes på begge språk. Søket finner øvelser på begge, og egne øvelser beholder navnet du ga dem.
- Datoer og tall følger språket (desimalkomma på norsk, punktum på engelsk).

**Øvelsesbibliotek**
- **131 innebygde øvelser** fordelt på bryst, rygg, skuldre, biceps, triceps, underarmer, bein, rumpe, mage og kondisjon.
- **Fremgangsmåte for hver øvelse**, på norsk og engelsk:
  - steg for steg
  - tips
  - vanlige feil
  - hvilke muskler som jobber
  - nivå
- Fremgangsmåten åpnes med «i» i øvelsesvelgeren og på hvert øvelseskort i økta. Du trenger ikke forlate økta.
- **Øvelsestyper** med riktige felt:
  - vekt × reps
  - kroppsvekt (reps, med valgfri ekstra vekt)
  - tid (sekunder, med stoppeklokke: ✓ starter og stopper tidtakingen)
  - kondisjon (km og minutter)
- Rekorder følger typen: tyngste og 1RM, flest reps, lengst tid eller lengst distanse.
- **Egne øvelser** kan lages, redigeres og slettes, og slettingen kan angres.
- **Favoritter** (stjerne) vises først i velgeren.
- Nye innebygde øvelser legges automatisk inn i eksisterende kontoer.

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
  - **neste set er markert** («du er her») og rulles fram etter hvert fullførte set
  - **bytt øvelse** midt i økta, f.eks. når maskinen er opptatt
  - **hviletid huskes** per øvelse, og **notatet fra sist** vises som et forslag
- **Øvelsesvelger**:
  - velg flere øvelser på én gang
  - favoritter og «Nylig brukt» øverst, så alle øvelser gruppert på muskelgruppe med fargekode
  - filter for utstyr, og siste resultat ved hver øvelse
  - søket tåler at du skriver uten æ, ø og å («kneboy» finner Knebøy)
- **Angre**: sletting av set, øvelse, økt, rutine og kroppsvekt kan angres fra meldingen nederst på skjermen.
- **Hviletimer** starter når du huker av et set. Den viser en ring, har −15/+15, lyd og vibrasjon, og viser hvilket set som er det neste. Den teller riktig når skjermen er låst.
- **Oppsummering** etter økta: rekorder med konfetti, volum mot forrige gang og muskelgrupper. Har du endret en rutine-økt underveis, kan rutinen oppdateres.
- **Glemt å avslutte?** Hjem spør når en økt har stått åpen i over 3 timer, og du setter varigheten selv.
- **Logg tidligere økt**: registrer en økt i ettertid med dato og klokkeslett.

**Styrkenivå**
- Ti nivåer: Nybegynner, Rookie, Stamgjest, Gymrotte, Løfter, Sterk, Beist, Titan, Elite og Olympia.
- Regnes ut fra beste beregnede 1RM i nøkkelløft (benk, knebøy, markløft, skulderpress, roing, pull-ups, dips og varianter) delt på kroppsvekt, med egne standarder for menn og kvinner (snitt hvis kjønn ikke er valgt). Snittet av press, trekk og bein gir nivået.
- Maskiner, manualer og hip thrust teller opp til Beist; Titan og over krever hovedløft. Estimert 1RM bruker sets med 1–10 reps, og urealistiske sets (over 1,5 × verdensklasse, som regel tastefeil) teller ikke.
- Testet mot realistiske løftere (`src/lib/strength.personas.test.ts`), mann 80 kg / kvinne 62 kg:

  | Løfter | Eksempel (1RM benk / knebøy / markløft + trekk) | Nivå |
  |---|---|---|
  | Første måned | 40 / 50 / – + roing 40 | Nybegynner (9) |
  | 6 måneder | 65 / 90 / 110 + 5 pull-ups | Gymrotte (33) |
  | 2 år | 90 / 120 / 150 + pull-ups +10 × 5 | Sterk (52) |
  | Avansert | 120 / 160 / 200 + pull-ups +30 × 5 | Titan (71) |
  | Nasjonalt nivå | 160 / 210 / 240 + pull-ups +40 × 5 | Elite (84) |
  | Verdensklasse | 195 / 260 / 290 + pull-ups +60 × 5 | Olympia (97) |
  | Bare maskiner, enorme tall | beinpress 600, hip thrust 400 … | Beist (69, taket) |
  | Kvinne, 2 år | 50 / 85 / 105 + 3 pull-ups | Sterk (51) |
  | Kvinne, verdensklasse | 100 / 165 / 190 + pull-ups +35 × 5 | Olympia (92) |
- Nytt beste løft viser et rekordkort med animert poengsum; nytt totalnivå gir fullskjerm «Nivå opp» med konfetti.
- Merke med fremgang under hilsenen på Hjem, egen nivåside med stigen og hvert løft, og nivå per løft på øvelsessiden.

**Delekort**
- Etter en økt (og fra Historikk) kan du dele et bilde i fire nivåer: Enkel, Tall, Høydepunkter (muskelfigur, rekorder, toppsett) og Hele økta.
- Story 9:16 eller post 4:5. Deles via telefonens delemeny, eller lastes ned.

**Oversikt**
- **Trent kropp** på Hjem: en figur forfra og bakfra som farges etter hvor mange arbeidssett hver muskelgruppe har fått siste 7 eller 30 dager (1–3, 4–8, 9–15 og 16+ sets per uke). Sekundære muskler teller et halvt sett. Trykk på en muskel for antall sets og når den sist ble trent.
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
3. Nettstedet bygges med `npm run build:site` (til `dist-site/`):
   - **Landingsside** på `https://<brukernavn>.github.io/<repo>/` (`landing/index.html`, ren HTML, norsk/engelsk).
   - **Appen** på `https://<brukernavn>.github.io/<repo>/app/` (installerbar PWA, virker offline).
4. Sjekk nettstedet lokalt med `npm run build:site && npm run site:check` (landingsside, lenker, manifest, ikoner og offline).
5. Nye skjermbilder til manifestet og landingssiden: `npm run build && npm run screenshots` (lager en demokonto og skriver `public/screenshots/*-nb.webp` / `*-en.webp`).

PWA-detaljer: manifest med ikoner, snarvei «Start økt» og skjermbilder (rikere installasjonsdialog på Android), knappen «Installer appen» der nettleseren støtter det, og «Ny versjon klar – Oppdater» i stedet for automatisk omlasting midt i en økt. claude.ai-lenken kan ikke installeres eller brukes offline; bruk GitHub Pages-adressen til det.

Slik installeres den på telefonen:
- **iPhone**: Safari → Del → «Legg til på Hjem-skjerm».
- **Android**: Chrome → meny → «Installer app».

## Kontoer på nett med Supabase

Når appen bygges med Supabase-nøkler, lagres alle kontoer og all trening på nett og synkes mellom enheter. Telefonen beholder en kopi, så appen virker også uten dekning.

1. Lag en gratis konto på [supabase.com](https://supabase.com) → **New project**. Navn `repgrade`, et sterkt databasepassord (ta vare på det), og region **Central EU (Frankfurt)** (det sier personvernerklæringen).
2. **SQL Editor → New query**: lim inn hele `supabase/setup.sql` og trykk **Run**. Filen er trygg å kjøre flere ganger. (Den lages fra `supabase/migrations/` med `node scripts/make-setup-sql.mjs`.)
3. **Authentication → Sign In / Providers → Email**: slå av **Confirm email** foreløpig. Supabase sin innebygde e-post sender bare noen få e-poster i timen; slå det på igjen når du har koblet til en egen e-posttjeneste (f.eks. Resend) under **Authentication → Emails → SMTP**.
4. **Authentication → URL Configuration**: sett **Site URL** til appens adresse, f.eks. `https://adamsommernes-pixel.github.io/Web-Appdevelopment/app/`.
5. **Project Settings → API Keys**: kopier **Project URL** og **Publishable key** (eller den eldre `anon`-nøkkelen).
6. GitHub → repoet → **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = Publishable key
7. GitHub → **Actions** → «Repgrade → GitHub Pages» → **Run workflow**. Når den er grønn, er kontoene på nett.

Lokalt utviklingsoppsett: legg de samme to verdiene i `.env.local` (se `.env.example`).

Den publiserbare nøkkelen er laget for å ligge i nettleseren. Row Level Security sørger for at hver bruker bare ser og endrer egne rader (testet mot Postgres 16). Synken skriver alt lokalt først; når det er nett, sendes endringene og nye hentes. Ved konflikt vinner siste endring. Feil i oppsettet (f.eks. at setup.sql ikke er kjørt) vises med en forståelig melding under Profil → Synk nå.

**Før det kommer ekte brukere:** godta databehandleravtalen (DPA) i Supabase, og slå på e-postbekreftelse med egen e-posttjeneste.

## Eget domene (valgfritt)

GitHub-adressen kan ikke endres (bortsett fra ved å gi repoet nytt navn). Slik bruker du et eget domene, f.eks. `repgrade.no` (ca. 100–200 kr i året):

1. Kjøp domenet hos en registrar (f.eks. Domeneshop for .no).
2. GitHub → repoet → **Settings → Secrets and variables → Actions → Variables → New repository variable**: `SITE_DOMAIN` = `repgrade.no`. Workflowen bygger da med landingssiden på `/`, appen på `/app/` og en `CNAME`-fil.
3. Hos registraren: fire `A`-poster for `@` til `185.199.108.153`, `185.199.109.153`, `185.199.110.153` og `185.199.111.153`, og en `CNAME`-post for `www` til `adamsommernes-pixel.github.io`.
4. GitHub → **Settings → Pages → Custom domain**: skriv inn domenet, vent på grønn hake og kryss av **Enforce HTTPS**.
5. Kjør workflowen på nytt, og oppdater **Site URL** i Supabase til den nye adressen.

## Struktur

```
src/
  features/share  delekort (canvas)
  i18n/        språk: t('norsk', 'english'), valgt språk og locale
  auth/        innlogging: lokal og Supabase bak samme grensesnitt, passord-hashing
  db/          Dexie-skjema (én database per konto), datafunksjoner, maler, synk, backup, v1-migrering
  lib/         1RM, PR, statistikk (ukemål, streak), platekalkulator, formatering, innstillinger
  components/  knapper, kort, ark, stepper, ring, avatar, kalender, grafer, platekalkulator, kroppskart
  features/    welcome, auth, onboarding, home, workout, summary, history, progress,
               exercise, bodyweight, routines, profile
supabase/      SQL-migreringer
tests/         e2e-skript (Playwright)
```

## Navn og varemerke (sjekk før lansering)

Navnet **Repgrade** ble valgt etter et søk i App Store, Google Play og på nettet (november 2026): ingen app med det navnet ble funnet. Nisjen «rangert styrketrening» har flere apper (Liftoff – Ranked Gym Workouts, IronRank, WeLift), derfor ble navn med «rank» droppet.

Ikke sjekket ennå (gjør dette selv før lansering, det tar noen minutter):

- **Domener:** søk etter `repgrade.com`, `repgrade.app` og `repgrade.no` hos en registrar, eller på [norid.no](https://www.norid.no/no/domenenavn/sok/) for .no.
- **Brukernavn:** `instagram.com/repgrade` og `tiktok.com/@repgrade`.
- **Varemerke:** søk «Repgrade» i [TMview](https://www.tmdn.org/tmview/) (EU og mange land) og i [Patentstyrets søk](https://search.patentstyret.no/), klasse 9 (programvare) og 41 (trening). Ved treff som ligner, eller før du bruker penger på merkevaren, bør du spørre en varemerkerådgiver.

## Personvern (GDPR)

- Personvernerklæringen ligger i appen under `/privacy` (`src/features/legal/PrivacyPage.tsx`), på norsk og engelsk, og lenkes fra velkomstsiden, registreringen, Profil og landingssiden. Behandlingsansvarlig: Adam Sommernes.
- Kroppsvekt, høyde, fødselsår og kjønn behandles som mulige helseopplysninger (art. 9). Med sky-konto sendes de bare til Supabase etter uttrykkelig samtykke (avkrysning i oppstarten og under Rediger profil). Uten samtykke hoppes kroppsvekt-loggen over i synken og feltene sendes tomme (`src/db/consent.ts`). Trekkes samtykket, slettes kroppsvekt-loggen i skyen.
- Ingen analyse, reklame eller sporingscookies.
- **Før lansering:** få erklæringen gjennomgått av noen med juridisk kompetanse, og inngå databehandleravtale (DPA) med Supabase (de har en standard DPA i dashbordet).

## Versjonsnummer

Appen viser «Versjon 1.0.0 (bygg 42 · a1b2c3d)» nederst i Profil:

- **1.0.0** står i `package.json`. Øk det ved hver utgivelse: siste tall for småfikser (1.0.1), midterste for nye funksjoner (1.1.0).
- **Bygg** er GitHub Actions sitt løpenummer og commit-ID, så hver publisering har sitt eget, unike nummer automatisk. Lokalt står det «lokal».

## Tredjepartsinnhold

- **Kroppskartet** bruker muskelpolygoner fra [react-body-highlighter](https://github.com/giavinh79/react-body-highlighter) (MIT-lisens, Copyright (c) 2020 GV79), glattet og omtegnet i `src/components/bodymap/anatomy.ts`.
