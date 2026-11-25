/**
 * Domain and configuration types. Everything salon-specific is described by
 * `SalonConfig` and lives in `salon.config.ts` at the project root.
 */

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Local wall-clock time "HH:MM" in the salon's timezone, 24h. */
export type ClockTime = `${number}:${number}`;

/** Local calendar date "YYYY-MM-DD" in the salon's timezone. */
export type LocalDate = string;

export interface TimeRange {
  start: ClockTime;
  end: ClockTime;
}

/** Opening hours per weekday. `null` means closed that day. */
export type OpeningHours = Record<Weekday, TimeRange | null>;

/** A staff member's working hours per weekday. Several ranges allow a lunch break. */
export type WeeklySchedule = Record<Weekday, TimeRange[]>;

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  durationMin: number;
  priceNok: number;
  /** Show as "fra 1 290 kr" when the final price depends on hair length etc. */
  priceFrom?: boolean;
  /** Listed among popular services on the home page. */
  popular?: boolean;
  active: boolean;
  /** Deleted in the admin. Kept so old bookings still show the service name. */
  archived?: boolean;
}

/**
 * A temporary closure set in the admin: a whole day or part of a day, for the
 * whole salon or for one staff member (sick day, course, holiday).
 */
export interface Closure {
  id: string;
  date: LocalDate;
  /** Leave out start and end to close the whole day. */
  start?: ClockTime;
  end?: ClockTime;
  /** Leave out to close the whole salon. */
  staffId?: string;
  reason: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  serviceIds: string[];
  schedule: WeeklySchedule;
  image?: ImageRef;
  /** Removed in the admin. Kept so past bookings still show the name. */
  archived?: boolean;
}

export interface ImageRef {
  /** Path under /public, e.g. "/images/salongen.jpg". Leave empty for a placeholder. */
  src?: string;
  alt: string;
  /** Short label shown on the placeholder, e.g. "salongen". */
  label: string;
}

export type AspectRatio = "1/1" | "3/4" | "4/5" | "2/3" | "4/3" | "3/2" | "16/9";

export interface GalleryItem extends ImageRef {
  id: string;
  caption: string;
  aspect: AspectRatio;
}

export interface Testimonial {
  quote: string;
  name: string;
  detail: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface BookingRules {
  /** Slot start times are offered on this grid, in minutes. */
  slotStepMin: number;
  /** Minimum gap between two appointments for the same staff member. */
  bufferMin: number;
  /** How long before the appointment it must be booked. */
  minNoticeMin: number;
  /** How far ahead customers can book. */
  horizonDays: number;
  /** Close automatically on Norwegian public holidays (helligdager). */
  closeOnPublicHolidays: boolean;
  /** Extra closed dates, e.g. Christmas Eve. Seeds the editable closures in the admin. */
  closedDates: { date: LocalDate; reason: string }[];
  /** Free cancellation until this many hours before the appointment. */
  cancellationHours: number;
}

export interface ThemeTokens {
  colors: {
    /** Page background. */
    paper: string;
    /** Secondary surface and bands. */
    stone: string;
    /** Primary text and dark bands. */
    ink: string;
    /** Secondary text. Must reach 4.5:1 on paper and stone. */
    muted: string;
    /** The single accent. Must reach 4.5:1 on paper. */
    accent: string;
  };
  /** Keys into the font registry in src/app/fonts.ts. */
  fonts: { display: "newsreader"; text: "schibsted" };
  /** Corner radius for controls, e.g. "2px". Keep small for the editorial look. */
  radius: string;
  /** "rules": sections separated by hairlines. "bands": alternating tonal bands. */
  sectionStyle: "rules" | "bands";
}

export interface SalonConfig {
  locale: "nb-NO";
  timeZone: "Europe/Oslo";
  currency: "NOK";
  siteUrl: string;
  name: string;
  /** Short legal/brand name used in titles. */
  shortName: string;
  tagline: string;
  description: string;
  /** Text logo: a single-letter mark, the name, and an optional small suffix. */
  logo: { text: string; mark: string; suffix?: string };
  founded: number;
  contact: {
    phone: string;
    email: string;
    address: { street: string; postalCode: string; city: string; area: string };
    geo: { lat: number; lng: number };
    directions: string;
  };
  social: { label: string; href: string }[];
  openingHours: OpeningHours;
  theme: ThemeTokens;
  booking: BookingRules;
  hero: { eyebrow: string; heading: string; lead: string };
  intro: { heading: string; body: string[] };
  about: { heading: string; body: string[] };
  heroImage: ImageRef;
  introImage: ImageRef;
  categories: ServiceCategory[];
  services: Service[];
  staff: StaffMember[];
  gallery: GalleryItem[];
  testimonials: Testimonial[];
  faq: FaqItem[];
  /** Team copy, kept here because it describes this salon's people. */
  team: { heading: string; lead: string; pageLead: string };
  /**
   * SHA-256 of "salong-admin:" + the initial admin password (demo only; the
   * check runs in the browser). Replace with real authentication in production.
   */
  adminPasswordHash: string;
}

/** The salon details the owner can edit in the admin. */
export type SalonProfile = Pick<SalonConfig, "name" | "tagline" | "logo" | "hero" | "contact">;

export type BookingStatus = "confirmed" | "cancelled";

export interface Customer {
  name: string;
  phone: string;
  email: string;
  note?: string;
}

export interface Booking {
  id: string;
  reference: string;
  serviceIds: string[];
  staffId: string;
  /** UTC instant, ISO 8601. */
  start: string;
  /** UTC instant, ISO 8601. */
  end: string;
  customer: Customer;
  status: BookingStatus;
  source: "online" | "admin";
  createdAt: string;
  cancelledAt?: string;
}
