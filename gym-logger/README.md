# RepGrade

*Tidligere «Gym Logger». Mappen i repoet heter fortsatt `gym-logger/`, og databasen og gamle backupfiler fungerer som før.*

Treningsapp (PWA) for gymmen: velg øvelse, logg sets, reps og vekt, og følg fremgangen. Svart og grønt design, norsk og engelsk, virker uten nett.

> **English:** A gym-logging PWA. Pick an exercise, log sets, reps and weight, and follow your progress. Black and green design, works offline.
> - Available in **Norwegian and English**. Switch on the welcome page (NO / EN) or under Profile → Settings → Language. On first visit the app follows the browser language.
> - Built-in exercises have English names and how-to guides, and search finds them in both languages («squat» finds Knebøy).
> - **Muscles trained**: a front and back body figure on Home shows which muscle groups you have trained in the last 7 or 30 days. Secondary muscles count half a set. Tap a muscle for sets and the date you last trained it.
> - **Strength level**: ten levels from Newbie to Olympia, based on your best estimated 1RM in the lifts that count (bench, squat, deadlift, overhead press, rows, pull-ups and variations; marked “Level” in the app) relative to bodyweight, with separate standards for men and women. Push, pull and legs are averaged. A new best lift pops up a record card, and a new overall level shows a full-screen «Level up». The level shows on Home and on its own page.
> - **Social** (1.3, cloud accounts): choose *Training* (the app as before) or *Social* under Profile → Account type. Social adds a tab with a feed of full workouts and kudos, following (Private, Leaderboards or Open), leaderboards, challenges and an in-app inbox. Bodyweight is never shared. On a social account History moves into Progress.
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
- Regnes ut fra beste beregnede 1RM i løftene som teller (benk, knebøy, markløft, skulderpress, roing, pull-ups og varianter) delt på kroppsvekt, med egne standarder for menn og kvinner (snitt hvis kjønn ikke er valgt). Snittet av press, trekk og bein gir nivået.
- Disse løftene gir nivå (merket «Nivå» i appen): benkpress, skråbenk, smal benkpress, benk og skråbenk med manualer, militærpress; pull-ups (også med vekt), stangroing, nedtrekk, bicepscurl med manualer; knebøy, markløft, sumo- og trap bar-markløft, rumensk markløft, bulgarsk splittbøy, beinpress, hack squat og beinspark. Manualøvelser regnes per manual. Alt annet logges som vanlig, men teller ikke. Maskinløft (beinpress, hack squat, beinspark, nedtrekk) gir høyst Sterk og vises i egen seksjon. Et løft teller bare hvis det er trent de siste 30 dagene (ellers vises det grått); brukeren varsles en uke før, og kan markere løft de ikke trener lenger. Alle grafer og tall kan vises for 7 dager, 30 dager, 12 måneder eller et bestemt år.
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

**Sosialt (1.3, bare konto på nett)**
- **Kontotype** under Profil: *Trening* (appen som før) eller *Sosial*. Sosial gir fanen Sosialt i stedet for Historikk, og Historikk flyttes inn under Fremgang. Bytter du tilbake til Trening, skjules den sosiale profilen (følgerne beholdes).
- **Sosial profil**: visningsnavn, @brukernavn (forslag fra navnet, sjekkes mens du skriver, reserverte og støtende navn stoppes), «Er du 16 år eller eldre?» og synlighet:
  - *Privat*: bare følgere du godtar ser øktene og nivået ditt. Finnes bare på hele brukernavnet.
  - *Ledertavler*: som Privat, men navn og nivå vises på ledertavlene (og du får se dem).
  - *Åpen*: alle innloggede ser deg, du vises i Oppdag, og følging skjer uten forespørsel.
  - Under 16 år: bare Privat. Ved oppstart velger du om øktene fra de siste 7 dagene skal deles, eller om du starter fra null.
- **Feed**: ferdige økter publiseres automatisk (hele økta med alle sets, rekorder og nivå; aldri kroppsvekt eller notater), oppdateres når de endres og forsvinner når de slettes. «Del i feeden» kan slås av per økt (på oppsummeringen og i historikken). Kudos 💪 🔥 👏 🏆, én per person.
- **Folk**: ett søkefelt (åpne kontoer på navn/brukernavn, alle på eksakt brukernavn), Oppdag (åpne kontoer, sist aktive først), forespørsler, følger/følgere, invitasjonslenke (`…/app/#/u/brukernavn`, husker lenken gjennom registreringen), blokkering og rapportering. Går du fra Åpen til strengere, spør appen om du vil beholde følgere du ikke følger tilbake.
- **Topp** (Ledertavler og Åpen): *Sterkest* (styrkenivå), *Fremgang* (nivåpoeng økt denne måneden) og *Flest økter* denne måneden, for alle eller bare dem du følger.
- **Utfordringer**: flest økter, mest volum, ukemål eller et løft (ikke pull-ups, siden kroppsvekten ville blitt synlig), 1 uke, 2 uker eller 1 måned. Bare gjensidige følgere og åpne kontoer du følger kan inviteres. Stillingen regnes ut av serveren fra delte økter.
- **Varsler** i appen: bjelle på Sosialt og merke i bunnmenyen (forespørsler, nye følgere, kudos, utfordringer). Ingen push-varsler ennå.

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
7. GitHub → **Actions** → «RepGrade → GitHub Pages» → **Run workflow**. Når den er grønn, er kontoene på nett.

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

## Sosialt: oppsett og drift

Alt sosialt ligger i `supabase/migrations/012_social.sql` (tabeller, sikkerhetsregler og funksjonene appen kaller). Venner leser aldri de private treningstabellene; appen legger en kopi av hver delt økt i `activities`. Alle regler for hvem som ser hva går gjennom databasefunksjonen `can_see()`, og følging, blokkering og utfordringer endres bare via funksjoner, så reglene ikke kan omgås fra appen.

**Ta det i bruk (én gang):** kjør hele `012_social.sql` i Supabase → SQL Editor (trygt å kjøre flere ganger) **før** appen med Sosialt publiseres. Appen sender kolonnen `profiles.social`, og en database uten den avviser synken.

**Forslag (1.4):** `013_suggestions.sql` legger til «Folk du kanskje kjenner» (`suggestions()`, felles venner først), lar private kontoer på 16+ finnes i navnesøk (bare navn, @brukernavn og farge), kolonnen `social_profiles.suggestable` («Vis meg i forslag») og `follow_counts()`. Kjør den på samme måte før 1.4 publiseres. Uten den viser appen bare ingen forslag; resten virker.

**Rapporter** lagres i tabellen `reports` og kan bare leses i Supabase-dashbordet (Table Editor → `reports`, eller SQL Editor):

```sql
select r.created_at, rp.handle as fra, tp.handle as gjelder, r.reason, r.activity_id
from public.reports r
left join public.social_profiles rp on rp.user_id = r.reporter
left join public.social_profiles tp on tp.user_id = r.target
order by r.created_at desc;
```

Skjul en profil som bryter reglene: `update public.profiles set social = 0 where user_id = '<id>';` (den sosiale profilen skjules for alle). Slett kontoen helt under Authentication → Users.

**Tester:**
- `npm run test:db`: migrasjonene og sikkerhetsreglene mot en midlertidig lokal Postgres (krever Postgres installert), med testbrukere på alle nivåer.
- `npm test`: blant annet en falsk Sosialt-variant (`src/social/fake.ts`) med de samme reglene, som e2e-testene bruker.
- `STAGING_SUPABASE_URL=… STAGING_SUPABASE_KEY=<publishable key> npm run test:staging`: den ekte koden mot et eget staging-prosjekt (lager og sletter testkontoer). Krever «Confirm email» slått av i staging.

## Navn og varemerke (sjekk før lansering)

Navnet **RepGrade** ble valgt etter et søk i App Store, Google Play og på nettet (november 2026): ingen app med det navnet ble funnet. Nisjen «rangert styrketrening» har flere apper (Liftoff – Ranked Gym Workouts, IronRank, WeLift), derfor ble navn med «rank» droppet.

Ikke sjekket ennå (gjør dette selv før lansering, det tar noen minutter):

- **Domener:** søk etter `repgrade.com`, `repgrade.app` og `repgrade.no` hos en registrar, eller på [norid.no](https://www.norid.no/no/domenenavn/sok/) for .no.
- **Brukernavn:** `instagram.com/repgrade` og `tiktok.com/@repgrade`.
- **Varemerke:** søk «RepGrade» i [TMview](https://www.tmdn.org/tmview/) (EU og mange land) og i [Patentstyrets søk](https://search.patentstyret.no/), klasse 9 (programvare) og 41 (trening). Ved treff som ligner, eller før du bruker penger på merkevaren, bør du spørre en varemerkerådgiver.

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
- **3D-demoene** (de 12 store løftene) er laget her: en mannekeng tegnet med [three.js](https://threejs.org) (MIT-lisens). Bevegelsene står i `src/features/exercise/demo3d/moves.ts`; knær og albuer regnes ut med invers kinematikk i `rig.ts`, og `moves.test.ts` sjekker at hendene holder stanga, føttene står i gulvet og leddvinklene er normale. Etter endringer: `npm run demo:stills` lager stillbildene som vises uten WebGL, og `node scripts/demo/shots.mjs <mappe>` tar bilder av alle demoene til visuell sjekk.

## Varsel når pausen er over (låst skjerm)

Nettleseren stopper appen når skjermen låses, så lyd og vibrasjon fra appen selv virker ikke da. I stedet sender serveren et varsel (web push) når pausen er over. Telefonen spiller lyd og vibrerer etter sine egne innstillinger for varsler. Det krever konto på nett, og på iPhone at appen er lagt på Hjem-skjermen (iOS 16.4+). Brukeren slår det på under Profil → «Varsel når pausen er over».

Oppsett (én gang, ca. 10 minutter):

1. **Lag nøkler** på din egen maskin: `npx web-push generate-vapid-keys`. Du får en offentlig og en privat nøkkel.
2. **GitHub:** Settings → Secrets and variables → Actions → **Variables** → ny variabel `VITE_VAPID_PUBLIC_KEY` = den offentlige nøkkelen (den er ikke hemmelig).
3. **Supabase → Edge Functions → Secrets:** legg inn `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (f.eks. `mailto:deg@eksempel.no`) og `CRON_SECRET` (en lang tilfeldig tekst du finner på).
4. **Deploy funksjonen** (navnet kan bli noe annet enn `rest-alarms` i editoren; bruk da det navnet i adressen i steg 5) (Supabase CLI): `supabase functions deploy rest-alarms --no-verify-jwt --project-ref <prosjekt-id>`. Eller lim inn `supabase/functions/rest-alarms/index.ts` i Supabase → Edge Functions → «Deploy a new function», kall den `rest-alarms` og slå av «Verify JWT».
5. **Supabase → SQL Editor**, kjør (bytt ut verdiene):
   ```sql
   select vault.create_secret('https://<prosjekt-id>.supabase.co/functions/v1/rest-alarms', 'rest_alarm_url');
   select vault.create_secret('<samme CRON_SECRET som i steg 3>', 'rest_alarm_secret');
   ```
6. Kjør så `supabase/migrations/010_push.sql` i SQL Editor (lager tabellene og jobben som sjekker hvert 5. sekund).
7. Publiser appen på nytt (merge til main), så bygget får den offentlige nøkkelen.

**Oppdatering i 1.2 (én gang):** kjør `supabase/migrations/011_push_device.sql` i SQL Editor og lim inn den nye koden fra `supabase/functions/rest-alarms/index.ts` i funksjonen din (heter den noe annet, f.eks. `quick-worker`, bruk den). Da går varselet bare til telefonen som startet pausen. Appen virker også før dette (varselet går da til alle enhetene dine).

Sjekk: slå på varselet i Profil, start en økt, fullfør et set og lås telefonen. Når pausen er over, kommer «Pausen er over – Benkpress – neste set». Funksjonens logg i Supabase viser `{"alarms":1,"sent":1}`.

## Ny versjon med «Nytt i denne versjonen»

1. Øk `version` i `package.json` (f.eks. 1.1.0 → 1.2.0, eller 1.1.1 for småfikser).
2. Sett samme versjon i `public/whats-new.json` og skriv 3–7 punkter (`nb`, `en`, valgfritt `icon` fra `src/components/Icon.tsx`).
3. Merge til main.

Har brukeren appen åpen, vises nyhetene i fullskjerm med «Oppdater nå» / «Senere». Oppdaterte appen seg uten at de så skjermen, vises listen én gang med «Fortsett» neste gang de åpner appen. Nye brukere får den ikke. En test stopper bygget hvis versjonene i de to filene ikke er like.
