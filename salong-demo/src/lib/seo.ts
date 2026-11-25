import type { Metadata } from "next";
import type { SalonConfig, Weekday } from "@/lib/types";

const SCHEMA_DAYS: Record<Weekday, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/** schema.org HairSalon (a LocalBusiness) generated from the config. */
export function localBusinessJsonLd(config: SalonConfig) {
  const prices = config.services.filter((s) => s.active).map((s) => s.priceNok);
  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": `${config.siteUrl}/#salong`,
    name: config.name,
    description: config.description,
    url: config.siteUrl,
    telephone: config.contact.phone,
    email: config.contact.email,
    foundingDate: String(config.founded),
    currenciesAccepted: config.currency,
    priceRange: `${Math.min(...prices)}–${Math.max(...prices)} NOK`,
    image: `${config.siteUrl}/opengraph-image`,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.contact.address.street,
      postalCode: config.contact.address.postalCode,
      addressLocality: config.contact.address.city,
      addressCountry: "NO",
    },
    geo: { "@type": "GeoCoordinates", latitude: config.contact.geo.lat, longitude: config.contact.geo.lng },
    openingHoursSpecification: (Object.entries(config.openingHours) as [string, SalonConfig["openingHours"][Weekday]][])
      .filter(([, range]) => range)
      .map(([day, range]) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${SCHEMA_DAYS[Number(day) as Weekday]}`,
        opens: range!.start,
        closes: range!.end,
      })),
    sameAs: config.social.map((s) => s.href),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Tjenester",
      itemListElement: config.categories.map((c) => ({
        "@type": "OfferCatalog",
        name: c.name,
        itemListElement: config.services
          .filter((s) => s.categoryId === c.id && s.active)
          .map((s) => ({
            "@type": "Offer",
            price: s.priceNok,
            priceCurrency: config.currency,
            itemOffered: { "@type": "Service", name: s.name, description: s.description },
          })),
      })),
    },
  };
}

/** Per-page metadata with canonical URL and Open Graph. */
export function pageMetadata(config: SalonConfig, page: { title?: string; description: string; path: string }): Metadata {
  const title = page.title ?? `${config.name}: ${config.tagline}`;
  return {
    title: page.title ? page.title : { absolute: title },
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.title ? `${page.title} · ${config.name}` : title,
      description: page.description,
      url: page.path,
      siteName: config.name,
      locale: "nb_NO",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${config.name}: ${config.tagline}` }],
    },
  };
}
