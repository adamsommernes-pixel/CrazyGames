/**
 * salon.config.ts — the single source of truth for one salon.
 *
 * To make a site for a new salon, copy this file and change the values.
 * Text, prices, staff, opening hours, booking rules and the visual theme
 * are all read from here. See README.md → "Tilpasse til en ny salong".
 */
import type { SalonConfig, WeeklySchedule } from "@/lib/types";

const off: WeeklySchedule[1] = [];

export const salon: SalonConfig = {
  locale: "nb-NO",
  timeZone: "Europe/Oslo",
  currency: "NOK",
  siteUrl: "https://salonglyng.no",

  name: "Salong Lyng",
  shortName: "Lyng",
  tagline: "Hår, bryn og vipper på Grünerløkka",
  description:
    "Salong Lyng er en frisørsalong på Grünerløkka i Oslo. Klipp, farge, balayage, styling, bryn og vipper. Bestill time på nett.",
  logo: { text: "Lyng", mark: "L", suffix: "salong" },
  founded: 2011,

  contact: {
    phone: "+47 22 35 18 40",
    email: "hei@salonglyng.no",
    address: {
      street: "Kleivgata 7",
      postalCode: "0553",
      city: "Oslo",
      area: "Grünerløkka",
    },
    geo: { lat: 59.9232, lng: 10.7585 },
    directions:
      "Gå inn porten ved bakeriet, vi er første dør til høyre. Trikk 11, 12 eller 18 til Olaf Ryes plass, to minutter å gå.",
  },

  social: [
    { label: "Instagram", href: "https://www.instagram.com/salonglyng" },
    { label: "Facebook", href: "https://www.facebook.com/salonglyng" },
  ],

  openingHours: {
    1: { start: "09:00", end: "18:00" },
    2: { start: "09:00", end: "19:00" },
    3: { start: "09:00", end: "19:00" },
    4: { start: "09:00", end: "20:00" },
    5: { start: "09:00", end: "18:00" },
    6: { start: "10:00", end: "16:00" },
    7: null,
  },

  theme: {
    colors: {
      paper: "#F3EEE6",
      stone: "#E4DACB",
      ink: "#1F1A16",
      muted: "#5C5248",
      accent: "#9A3D22",
    },
    fonts: { display: "newsreader", text: "schibsted" },
    radius: "2px",
    sectionStyle: "bands",
  },

  booking: {
    slotStepMin: 15,
    bufferMin: 10,
    minNoticeMin: 120,
    horizonDays: 60,
    closeOnPublicHolidays: true,
    closedDates: [
      { date: "2026-12-24", reason: "Julaften" },
      { date: "2026-12-31", reason: "Nyttårsaften" },
    ],
    cancellationHours: 24,
  },

  hero: {
    eyebrow: "Frisør på Grünerløkka siden 2011",
    heading: "Vi klipper håret ditt slik det faktisk vokser.",
    lead: "Klipp, farge, bryn og vipper i et gammelt bakeri i Kleivgata. Bestill på nett på et par minutter, eller ring oss.",
  },

  intro: {
    heading: "En liten salong med god tid.",
    body: [
      "Vi er fire frisører og en bryn- og vippeterapeut. Hver time starter med en ordentlig prat, og vi sier ifra hvis det du ønsker ikke kommer til å fungere på håret ditt.",
      "Vi blander farge etter vekt, så det blir lite til overs, og vi bruker produkter fra skandinaviske leverandører der vi kan.",
    ],
  },

  about: {
    heading: "Et bakeri som ble frisørsalong",
    body: [
      "Ingrid åpnet Lyng i 2011 i det som hadde vært et bakeri i over femti år. Vi beholdt den gamle benken og de store vinduene mot gata, og la til tre stoler og en vask.",
      "I dag er vi fem. Vi har ikke det største utvalget av behandlinger, men vi gjør dem vi tilbyr ordentlig, og vi har satt av nok tid til hver kunde til at ingen trenger å stresse.",
      "Mange av kundene våre har gått hos oss i over ti år. Noen av dem tar nå med seg barna sine.",
    ],
  },

  heroImage: { alt: "Frisør som klipper langt, mørkt hår ved vinduet", label: "klipp ved vinduet" },
  introImage: { alt: "Salongen sett fra inngangen, med tre frisørstoler", label: "salongen" },

  categories: [
    { id: "klipp", name: "Klipp", description: "Alle klipp inkluderer vask og enkel føn." },
    { id: "farge", name: "Farge og striper", description: "Ny fargekunde? Kom innom for hudtest minst 48 timer før." },
    { id: "styling", name: "Styling", description: "Til bryllup, ball, jobbintervju eller bare en fredag." },
    { id: "bryn", name: "Bryn og vipper", description: "Hos Amira, tirsdag til torsdag og lørdag." },
  ],

  services: [
    { id: "dameklipp-kort", categoryId: "klipp", name: "Dameklipp, kort hår", description: "Over skulderen. Konsultasjon, vask, klipp og føn.", durationMin: 45, priceNok: 795, popular: true, active: true },
    { id: "dameklipp-langt", categoryId: "klipp", name: "Dameklipp, langt hår", description: "Under skulderen. Konsultasjon, vask, klipp og føn.", durationMin: 60, priceNok: 945, popular: true, active: true },
    { id: "herreklipp", categoryId: "klipp", name: "Herreklipp", description: "Saks eller maskin, med vask og styling.", durationMin: 30, priceNok: 595, popular: true, active: true },
    { id: "skjegg", categoryId: "klipp", name: "Skjeggtrim", description: "Form og kontur med maskin og kniv.", durationMin: 20, priceNok: 295, active: true },
    { id: "barneklipp", categoryId: "klipp", name: "Barneklipp", description: "For barn under 12 år.", durationMin: 30, priceNok: 445, active: true },
    { id: "ettervekst", categoryId: "farge", name: "Farge, ettervekst", description: "Farge på utvekst opptil 3 cm, med føn.", durationMin: 90, priceNok: 1290, active: true },
    { id: "helfarge", categoryId: "farge", name: "Helfarge", description: "Én farge fra rot til tupp, med føn.", durationMin: 120, priceNok: 1690, priceFrom: true, active: true },
    { id: "striper", categoryId: "farge", name: "Striper i folie, halvt hode", description: "Lyse striper rundt ansiktet og på toppen.", durationMin: 120, priceNok: 1890, priceFrom: true, popular: true, active: true },
    { id: "balayage", categoryId: "farge", name: "Balayage", description: "Frihåndslyst for en myk overgang. Inkluderer toning.", durationMin: 180, priceNok: 2890, priceFrom: true, popular: true, active: true },
    { id: "toning", categoryId: "farge", name: "Toning og glans", description: "Friskere nyanse og mer glans mellom fargingene.", durationMin: 45, priceNok: 695, active: true },
    { id: "vask-fon", categoryId: "styling", name: "Vask og føn", description: "Glatt, bølger eller volum.", durationMin: 30, priceNok: 495, active: true },
    { id: "oppsett", categoryId: "styling", name: "Oppsett", description: "Flett, knute eller løst oppsatt. Ta gjerne med et bilde.", durationMin: 60, priceNok: 995, active: true },
    { id: "brud", categoryId: "styling", name: "Brudestyling med prøvetime", description: "Prøvetime noen uker før, og styling på dagen.", durationMin: 90, priceNok: 1950, priceFrom: true, active: true },
    { id: "brynsforming", categoryId: "bryn", name: "Brynsforming", description: "Napping og voks, tilpasset ansiktet ditt.", durationMin: 20, priceNok: 345, active: true },
    { id: "farge-bryn-vipper", categoryId: "bryn", name: "Farge bryn og vipper", description: "Inkluderer forming av bryn.", durationMin: 30, priceNok: 445, popular: true, active: true },
    { id: "brynslaminering", categoryId: "bryn", name: "Brynsløft", description: "Laminering som holder brynene på plass i 6–8 uker.", durationMin: 45, priceNok: 795, active: true },
    { id: "vippeloft", categoryId: "bryn", name: "Vippeløft med farge", description: "Løft og farge som varer 6–8 uker.", durationMin: 60, priceNok: 895, active: true },
  ],

  staff: [
    {
      id: "ingrid",
      name: "Ingrid Solberg",
      role: "Daglig leder, frisør",
      bio: "Startet Lyng i 2011 etter ti år i salonger i Bergen og København. Kjent for presise korte klipp og for å si nei til ting som ikke vil vokse fint ut.",
      serviceIds: ["dameklipp-kort", "dameklipp-langt", "herreklipp", "ettervekst", "helfarge", "toning", "vask-fon", "oppsett", "brud"],
      schedule: {
        1: [{ start: "09:00", end: "12:00" }, { start: "12:30", end: "17:00" }],
        2: [{ start: "09:00", end: "12:00" }, { start: "12:30", end: "17:00" }],
        3: off,
        4: [{ start: "11:00", end: "15:00" }, { start: "15:30", end: "20:00" }],
        5: [{ start: "09:00", end: "12:00" }, { start: "12:30", end: "17:00" }],
        6: [{ start: "10:00", end: "16:00" }],
        7: off,
      },
      image: { alt: "Portrett av Ingrid Solberg", label: "Ingrid" },
    },
    {
      id: "sofie",
      name: "Sofie Nilsen",
      role: "Kolorist",
      bio: "Har jobbet med farge i tolv år. Liker kalde blondtoner, kobber og å fikse farger som har gått galt andre steder. Tar seg god tid til konsultasjon.",
      serviceIds: ["dameklipp-kort", "dameklipp-langt", "ettervekst", "helfarge", "striper", "balayage", "toning"],
      schedule: {
        1: [{ start: "09:00", end: "17:00" }],
        2: off,
        3: [{ start: "09:00", end: "17:00" }],
        4: [{ start: "10:00", end: "18:00" }],
        5: [{ start: "09:00", end: "17:00" }],
        6: off,
        7: off,
      },
      image: { alt: "Portrett av Sofie Nilsen", label: "Sofie" },
    },
    {
      id: "marius",
      name: "Marius Haugen",
      role: "Frisør",
      bio: "Klipper alt fra korte herrefrisyrer til lange lag, og er favoritten blant de yngste kundene. Har bakgrunn fra en barbershop på Majorstuen.",
      serviceIds: ["dameklipp-kort", "dameklipp-langt", "herreklipp", "skjegg", "barneklipp", "vask-fon"],
      schedule: {
        1: off,
        2: [{ start: "11:00", end: "19:00" }],
        3: [{ start: "11:00", end: "19:00" }],
        4: [{ start: "12:00", end: "20:00" }],
        5: [{ start: "09:00", end: "17:00" }],
        6: [{ start: "10:00", end: "16:00" }],
        7: off,
      },
      image: { alt: "Portrett av Marius Haugen", label: "Marius" },
    },
    {
      id: "amira",
      name: "Amira Hassan",
      role: "Bryn- og vippeterapeut",
      bio: "Utdannet hudterapeut. Former bryn etter ansiktet ditt, ikke etter trenden, og sier ærlig ifra om en behandling ikke er verdt pengene for deg.",
      serviceIds: ["brynsforming", "farge-bryn-vipper", "brynslaminering", "vippeloft", "oppsett"],
      schedule: {
        1: off,
        2: [{ start: "12:00", end: "19:00" }],
        3: [{ start: "12:00", end: "19:00" }],
        4: [{ start: "12:00", end: "20:00" }],
        5: off,
        6: [{ start: "10:00", end: "16:00" }],
        7: off,
      },
      image: { alt: "Portrett av Amira Hassan", label: "Amira" },
    },
    {
      id: "jonas",
      name: "Jonas Berg",
      role: "Juniorfrisør",
      bio: "Fikk fagbrevet i fjor og har vært hos oss siden han var lærling. Rask og rolig med herreklipp, og har gode hender med føn.",
      serviceIds: ["herreklipp", "skjegg", "barneklipp", "vask-fon"],
      schedule: {
        1: [{ start: "10:00", end: "18:00" }],
        2: off,
        3: off,
        4: [{ start: "12:00", end: "20:00" }],
        5: [{ start: "10:00", end: "18:00" }],
        6: [{ start: "10:00", end: "16:00" }],
        7: off,
      },
      image: { alt: "Portrett av Jonas Berg", label: "Jonas" },
    },
  ],

  gallery: [
    { id: "g1", caption: "Kobberbalayage på langt hår", aspect: "4/5", alt: "Langt hår med kobberfarget balayage, sett bakfra", label: "balayage, kobber" },
    { id: "g2", caption: "Kort bob med rett nakke", aspect: "1/1", alt: "Kort bob klippet rett i nakken", label: "kort bob" },
    { id: "g3", caption: "Vinduet mot Kleivgata", aspect: "3/2", alt: "Salongens vindu mot gata en vinterettermiddag", label: "salongen" },
    { id: "g4", caption: "Klassisk herreklipp med skill", aspect: "3/4", alt: "Herreklipp med skill på siden", label: "herreklipp" },
    { id: "g5", caption: "Brynsløft, seks uker etter", aspect: "1/1", alt: "Nærbilde av laminerte bryn", label: "brynsløft" },
    { id: "g6", caption: "Kald blond etter toning", aspect: "4/5", alt: "Halvlangt hår i kald blond tone", label: "kald blond" },
    { id: "g7", caption: "Løst oppsett til bryllup", aspect: "3/4", alt: "Løst oppsatt hår med fletter", label: "oppsett" },
    { id: "g8", caption: "Arbeidsbenken, mandag morgen", aspect: "3/2", alt: "Sakser, børster og fargeskåler på en trebenk", label: "arbeidsbenken" },
  ],

  testimonials: [
    {
      quote: "Sofie skjønte hva jeg mente med «ikke for gult» uten at jeg hadde med bilder. Første gang jeg har gått ut av en salong uten å ville rette på noe.",
      name: "Hanne",
      detail: "Balayage hos Sofie",
    },
    {
      quote: "Jeg booker herreklipp i lunsjen. Inne og ute på en halvtime, og de husker hvordan jeg vil ha det.",
      name: "Eirik",
      detail: "Herreklipp hos Jonas",
    },
    {
      quote: "Datteren min på sju fikk holde speilet selv. Nå vil hun ikke klippe seg noe annet sted.",
      name: "Line",
      detail: "Barneklipp hos Marius",
    },
    {
      quote: "Amira sa rett ut at vippeløft ikke var verdt det for meg, og foreslo brynsløft i stedet. Det holdt i nesten to måneder.",
      name: "Thea",
      detail: "Brynsløft hos Amira",
    },
  ],

  faq: [
    {
      question: "Hvor sent kan jeg avbestille?",
      answer: "Senest 24 timer før timen din, så er det gratis. Avbestiller du senere eller ikke møter, tar vi betalt for halve prisen.",
    },
    {
      question: "Må jeg ta allergitest før farge?",
      answer: "Ja, hvis du ikke har farget hos oss før, eller det er over seks måneder siden sist. Kom innom minst 48 timer før timen. Testen tar fem minutter og er gratis.",
    },
    {
      question: "Hvordan betaler jeg?",
      answer: "Med kort eller Vipps i salongen etter timen. Du betaler ingenting når du bestiller.",
    },
    {
      question: "Hvorfor står det «fra» på noen priser?",
      answer: "Prisen avhenger av hårlengde og hvor mye produkt vi bruker. Vi sier alltid hva det kommer til å koste før vi begynner.",
    },
    {
      question: "Hvor kan jeg parkere?",
      answer: "Det er betalt gateparkering i sidegatene, men trikken er enklest. Den stopper ved Olaf Ryes plass, to minutter unna.",
    },
    {
      question: "Selger dere gavekort?",
      answer: "Ja, i salongen. Velg et beløp eller en bestemt behandling. Gavekortet gjelder i ett år.",
    },
  ],
};

export default salon;
