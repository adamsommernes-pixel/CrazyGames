import type { ReactNode } from 'react';
import { Page } from '../../components/ui';
import { getLang, t } from '../../i18n';

// Personvernerklæring. Hold innholdet i sync med README og landingssiden.
// Bør gjennomgås av noen med juridisk kompetanse før lansering.

export const PRIVACY_UPDATED = '2026-11-28';
const CONTROLLER = 'Adam Sommernes';
const CONTACT = 'adamsommernes@icloud.com';

interface Section {
  h: string;
  body: ReactNode;
}

const mail = <a className="font-semibold text-accent underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>;
const dt = (
  <a className="font-semibold text-accent underline" href="https://www.datatilsynet.no" target="_blank" rel="noreferrer">
    Datatilsynet
  </a>
);

const NB: Section[] = [
  {
    h: 'Kort fortalt',
    body: (
      <ul>
        <li>RepGrade lagrer treningen din for at appen skal virke. Vi selger ikke data, viser ikke reklame og bruker ingen sporing eller analyseverktøy.</li>
        <li>Med en <b>lokal konto</b> ligger alt bare på telefonen din.</li>
        <li>Med en <b>sky-konto</b> lagres dataene også hos Supabase i EU, så de kan synkes mellom enheter. Kroppsvekt, høyde, fødselsår og kjønn sendes bare til skyen hvis du samtykker.</li>
        <li>Du kan når som helst laste ned alt (JSON eller CSV) og slette kontoen.</li>
        <li><b>Sosialt er valgfritt.</b> Velger du sosial konto, deler du profilen og øktene dine med andre RepGrade-brukere etter synligheten du velger. Kroppsvekten din deles aldri.</li>
      </ul>
    ),
  },
  {
    h: 'Behandlingsansvarlig',
    body: (
      <p>
        {CONTROLLER} er behandlingsansvarlig for personopplysningene i RepGrade. Kontakt: {mail}.
      </p>
    ),
  },
  {
    h: 'Hva vi lagrer',
    body: (
      <ul>
        <li><b>Konto:</b> navn og e-postadresse. Passordet lagres aldri i klartekst: lokalt som en PBKDF2-hash, i skyen av Supabase Auth.</li>
        <li><b>Profil:</b> profilfarge, treningsmål, erfaring og økter per uke. Valgfritt: kroppsvekt, høyde, fødselsår og kjønn.</li>
        <li><b>Trening:</b> økter, øvelser, sets (vekt, reps, tid, distanse), rutiner, notater, egne øvelser og innstillinger.</li>
        <li><b>Kroppsvekt-logg:</b> dato og vekt, hvis du fører den.</li>
        <li>
          <b>Sosialt (bare med sosial konto):</b> visningsnavn, @brukernavn, appfarge, synlighet, om du har sagt at du er 16 år eller eldre, styrkenivået og poengene per løft (regnet ut på
          telefonen), øktene du deler, hvem du følger og blokkerer, reaksjoner, utfordringer, varsler og rapporter du sender.
        </li>
      </ul>
    ),
  },
  {
    h: 'Kroppsdata er særlig beskyttet',
    body: (
      <p>
        Kroppsvekt (og høyde, fødselsår og kjønn sammen med den) kan regnes som helseopplysninger etter personvernforordningen (GDPR) artikkel 9. De brukes bare til å beregne
        styrkenivået ditt og vise grafer. Med en sky-konto lagres de i skyen bare hvis du krysser av for samtykke. Uten samtykke blir de liggende på telefonen. Du kan trekke
        samtykket under Profil → Data og backup; da slettes kroppsvekt-loggen i skyen og feltene tømmes der, mens dataene blir på telefonen.
      </p>
    ),
  },
  {
    h: 'Sosialt: hva andre ser',
    body: (
      <ul>
        <li>Sosialt krever en konto på nett og slås på under Profil → Kontotype. Med treningskonto deles ingenting.</li>
        <li>
          <b>Synlighet du velger selv:</b> <i>Privat</i>: bare følgere du godtar ser øktene og nivået ditt. <i>Ledertavler</i>: som Privat, men navnet og nivået ditt vises på
          ledertavlene. <i>Åpen</i>: alle innloggede RepGrade-brukere ser profilen og øktene dine, du vises i Oppdag, og folk kan følge deg uten å spørre. Under 16 år kan du bare
          velge Privat.
        </li>
        <li>
          <b>En delt økt</b> viser navnet på økta, tidspunkt, varighet, øvelsene med alle sets, rekorder, volum og nivået ditt etter økta. Notatene dine deles ikke. Du kan slå av
          deling for en økt eller fjerne den fra feeden når som helst.
        </li>
        <li>
          <b>Kroppsvekten din deles aldri</b>, heller ikke høyde, fødselsår eller kjønn. Styrkenivået regnes ut på telefonen, og bare resultatet deles. Løft der kroppsvekten er med i
          tallet (som pull-ups), brukes ikke i utfordringer, så kroppsvekten ikke kan regnes ut.
        </li>
        <li>Navnet ditt og @brukernavnet kan alltid finnes av den som skriver hele brukernavnet, også når kontoen er privat. Profilen og øktene vises likevel ikke før du godtar.</li>
        <li>
          <b>Blokkering og rapportering:</b> blokkerer du noen, slutter dere å følge hverandre og den andre kan ikke finne deg. Rapporter leses bare av RepGrade og brukes til å stoppe
          misbruk. Den du rapporterer, får ikke vite hvem som rapporterte.
        </li>
        <li>Bytter du til treningskonto, skjules den sosiale profilen og øktene for alle. Følgerne dine beholdes til du bytter tilbake.</li>
      </ul>
    ),
  },
  {
    h: 'Hvor dataene ligger',
    body: (
      <ul>
        <li><b>På enheten:</b> i nettleserens lagring (IndexedDB) for denne appen.</li>
        <li><b>I skyen (bare sky-konto):</b> hos Supabase, i et datasenter i EU (Frankfurt). Supabase er databehandler for oss og behandler data bare etter våre instrukser.</li>
        <li><b>Nettsiden</b> leveres av GitHub Pages, som kan registrere IP-adresse i tekniske logger. Vi har ikke tilgang til disse loggene.</li>
        <li>Delekort lages på telefonen og deles bare når du selv trykker «Del».</li>
      </ul>
    ),
  },
  {
    h: 'Behandlingsgrunnlag',
    body: (
      <ul>
        <li>Treningsdata og konto: for å levere tjenesten du har bedt om (GDPR art. 6 nr. 1 b).</li>
        <li>Kroppsdata i skyen: ditt uttrykkelige samtykke (art. 9 nr. 2 a og art. 6 nr. 1 a).</li>
        <li>Deling i Sosialt: for å levere funksjonen du har valgt å slå på (art. 6 nr. 1 b).</li>
        <li>Blokkering og rapporter: berettiget interesse i å holde appen trygg (art. 6 nr. 1 f).</li>
      </ul>
    ),
  },
  {
    h: 'Hvor lenge',
    body: (
      <p>
        Til du sletter dem. «Slett konto» under Profil sletter alt på enheten og i skyen, også alt sosialt (profil, delte økter, følgere, reaksjoner og utfordringer). Eventuelle
        sikkerhetskopier hos Supabase slettes etter deres faste rutine.
      </p>
    ),
  },
  {
    h: 'Dine rettigheter',
    body: (
      <ul>
        <li><b>Innsyn og dataportabilitet:</b> Profil → Data og backup → last ned JSON eller CSV.</li>
        <li><b>Retting:</b> rediger profil, økter og sets i appen.</li>
        <li><b>Sletting:</b> slett enkeltøkter, eller hele kontoen under Profil.</li>
        <li><b>Trekke samtykke:</b> Profil → Data og backup.</li>
        <li>Du kan også kontakte oss på {mail}, og du kan klage til {dt}.</li>
      </ul>
    ),
  },
  {
    h: 'Alder',
    body: <p>Appen er beregnet for personer fra 13 år. Under 16 år kan du bare ha privat sosial profil, og du vises ikke på ledertavler eller i Oppdag.</p>,
  },
  {
    h: 'Endringer',
    body: <p>Ved vesentlige endringer oppdaterer vi denne siden og datoen under. Sist oppdatert: 28. november 2026.</p>,
  },
];

const EN: Section[] = [
  {
    h: 'In short',
    body: (
      <ul>
        <li>RepGrade stores your training so the app can work. We do not sell data, show ads or use any tracking or analytics.</li>
        <li>With a <b>local account</b> everything stays on your phone.</li>
        <li>With a <b>cloud account</b> the data is also stored with Supabase in the EU so it can sync between devices. Bodyweight, height, year of birth and sex only go to the cloud if you consent.</li>
        <li>You can download everything (JSON or CSV) and delete your account at any time.</li>
        <li><b>Social is optional.</b> If you choose a social account, you share your profile and workouts with other RepGrade users according to the visibility you pick. Your bodyweight is never shared.</li>
      </ul>
    ),
  },
  {
    h: 'Data controller',
    body: (
      <p>
        {CONTROLLER} is the data controller for personal data in RepGrade. Contact: {mail}.
      </p>
    ),
  },
  {
    h: 'What we store',
    body: (
      <ul>
        <li><b>Account:</b> name and email address. The password is never stored in plain text: locally as a PBKDF2 hash, in the cloud by Supabase Auth.</li>
        <li><b>Profile:</b> profile colour, training goal, experience and workouts per week. Optional: bodyweight, height, year of birth and sex.</li>
        <li><b>Training:</b> workouts, exercises, sets (weight, reps, time, distance), routines, notes, custom exercises and settings.</li>
        <li><b>Bodyweight log:</b> date and weight, if you keep one.</li>
        <li>
          <b>Social (social accounts only):</b> display name, @username, app colour, visibility, whether you said you are 16 or older, your strength level and points per lift
          (calculated on your phone), the workouts you share, who you follow and block, reactions, challenges, notifications and reports you send.
        </li>
      </ul>
    ),
  },
  {
    h: 'Body data gets extra protection',
    body: (
      <p>
        Bodyweight (and height, year of birth and sex together with it) may count as health data under the GDPR, Article 9. It is only used to calculate your strength level
        and show charts. With a cloud account it is stored in the cloud only if you tick the consent box. Without consent it stays on your phone. You can withdraw consent under
        Profile → Data and backup; the bodyweight log is then deleted from the cloud and the fields are cleared there, while the data stays on your phone.
      </p>
    ),
  },
  {
    h: 'Social: what others see',
    body: (
      <ul>
        <li>Social needs an online account and is turned on under Profile → Account type. With a training account nothing is shared.</li>
        <li>
          <b>Visibility you choose:</b> <i>Private</i>: only followers you accept see your workouts and level. <i>Leaderboards</i>: like Private, but your name and level show on the
          leaderboards. <i>Open</i>: every logged-in RepGrade user can see your profile and workouts, you show up in Discover, and people can follow you without asking. Under 16 you
          can only choose Private.
        </li>
        <li>
          <b>A shared workout</b> shows its name, time, duration, the exercises with every set, records, volume and your level after the workout. Your notes are not shared. You can
          turn off sharing for a workout or remove it from the feed at any time.
        </li>
        <li>
          <b>Your bodyweight is never shared</b>, nor your height, year of birth or sex. Your strength level is calculated on your phone and only the result is shared. Lifts where
          bodyweight is part of the number (such as pull-ups) are not used in challenges, so your bodyweight cannot be worked out.
        </li>
        <li>Anyone who types your full username can find your name and @username, also when your account is private. Your profile and workouts still stay hidden until you accept.</li>
        <li>
          <b>Blocking and reporting:</b> if you block someone, you stop following each other and they cannot find you. Reports are only read by RepGrade and are used to stop abuse.
          The person you report is not told who reported them.
        </li>
        <li>If you switch to a training account, your social profile and workouts are hidden from everyone. Your followers are kept until you switch back.</li>
      </ul>
    ),
  },
  {
    h: 'Where the data lives',
    body: (
      <ul>
        <li><b>On the device:</b> in the browser storage (IndexedDB) for this app.</li>
        <li><b>In the cloud (cloud accounts only):</b> with Supabase, in a data centre in the EU (Frankfurt). Supabase is our data processor and only processes data on our instructions.</li>
        <li><b>The website</b> is served by GitHub Pages, which may record IP addresses in technical logs. We have no access to those logs.</li>
        <li>Share cards are made on your phone and only shared when you tap “Share”.</li>
      </ul>
    ),
  },
  {
    h: 'Legal basis',
    body: (
      <ul>
        <li>Training data and account: to provide the service you asked for (GDPR Art. 6(1)(b)).</li>
        <li>Body data in the cloud: your explicit consent (Art. 9(2)(a) and Art. 6(1)(a)).</li>
        <li>Sharing in Social: to provide the feature you chose to turn on (Art. 6(1)(b)).</li>
        <li>Blocking and reports: legitimate interest in keeping the app safe (Art. 6(1)(f)).</li>
      </ul>
    ),
  },
  {
    h: 'How long',
    body: <p>Until you delete it. “Delete account” under Profile deletes everything on the device and in the cloud, including everything social (profile, shared workouts, followers, reactions and challenges). Any Supabase backups are deleted on their regular schedule.</p>,
  },
  {
    h: 'Your rights',
    body: (
      <ul>
        <li><b>Access and portability:</b> Profile → Data and backup → download JSON or CSV.</li>
        <li><b>Rectification:</b> edit your profile, workouts and sets in the app.</li>
        <li><b>Erasure:</b> delete single workouts, or your whole account under Profile.</li>
        <li><b>Withdraw consent:</b> Profile → Data and backup.</li>
        <li>You can also contact us at {mail}, and you can complain to {dt}, the Norwegian Data Protection Authority.</li>
      </ul>
    ),
  },
  {
    h: 'Age',
    body: <p>The app is intended for people aged 13 and over. Under 16 you can only have a private social profile, and you are not shown on leaderboards or in Discover.</p>,
  },
  {
    h: 'Changes',
    body: <p>If we make significant changes, we update this page and the date below. Last updated: 28 November 2026.</p>,
  },
];

/** Selve teksten, også brukt i et ark under oppstart (der rutene ikke er tilgjengelige). */
export function PrivacyContent() {
  const sections = getLang() === 'en' ? EN : NB;
  return (
    <article className="privacy flex flex-col gap-5 pb-8 text-[15px] leading-relaxed text-muted">
      <p className="text-sm text-faint">{t('Personvernerklæring for RepGrade', 'Privacy policy for RepGrade')}</p>
      {sections.map((s) => (
        <section key={s.h}>
          <h2 className="mb-1.5 text-lg font-bold text-ink">{s.h}</h2>
          {s.body}
        </section>
      ))}
    </article>
  );
}

export function PrivacyPage() {
  return (
    <Page title={t('Personvern', 'Privacy')} back>
      <PrivacyContent />
    </Page>
  );
}
