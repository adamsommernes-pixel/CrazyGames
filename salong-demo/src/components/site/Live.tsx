"use client";

/**
 * Small client leaves that show salon details the owner can change in the
 * admin. Server-rendered pages place these where they need a name, phone
 * number or address: the HTML is rendered from salon.config.ts and updated
 * from the repository after hydration.
 */
import { t } from "@/i18n";
import { telHref } from "@/lib/format";
import { useLiveCatalog, useProfile } from "@/lib/repository/live";
import type { SalonProfile } from "@/lib/types";

const fields = {
  name: (p) => p.name,
  tagline: (p) => p.tagline,
  logoText: (p) => p.logo.text,
  logoMark: (p) => p.logo.mark,
  logoSuffix: (p) => p.logo.suffix ?? "",
  heroEyebrow: (p) => p.hero.eyebrow,
  heroHeading: (p) => p.hero.heading,
  heroLead: (p) => p.hero.lead,
  phone: (p) => p.contact.phone,
  email: (p) => p.contact.email,
  street: (p) => p.contact.address.street,
  postalCity: (p) => `${p.contact.address.postalCode} ${p.contact.address.city}`,
  areaCity: (p) => `${p.contact.address.area}, ${p.contact.address.city}`,
  addressLine: (p) => `${p.contact.address.street}, ${p.contact.address.postalCode} ${p.contact.address.city}`,
  directions: (p) => p.contact.directions,
  aboutLead: (p) => t.about.lead(p.contact.address.street, p.contact.address.area),
} satisfies Record<string, (p: SalonProfile) => string>;

export type ProfileField = keyof typeof fields;

export function ProfileText({ field }: { field: ProfileField }) {
  return <>{fields[field](useProfile())}</>;
}

export function PhoneLink({ className }: { className?: string }) {
  const { phone } = useProfile().contact;
  return (
    <a href={telHref(phone)} className={className}>
      {phone}
    </a>
  );
}

export function EmailLink({ className }: { className?: string }) {
  const { email } = useProfile().contact;
  return (
    <a href={`mailto:${email}`} className={className}>
      {email}
    </a>
  );
}

/** Number of current staff members or bookable services, for the home page facts. */
export function CatalogCount({ of }: { of: "staff" | "services" }) {
  const catalog = useLiveCatalog();
  return <>{of === "staff" ? catalog.staff.length : catalog.services.length}</>;
}
