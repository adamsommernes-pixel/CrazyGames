# Salong-demo: website and online booking for hair and beauty salons

This is a design-and-function demo of a salon website with working online booking and a simple admin, built for Norwegian salons. All content is in Norwegian bokmål.

The demo salon, **Salong Lyng** on Grünerløkka, is fictional. Everything salon-specific lives in a single file, `salon.config.ts`.

There are no external integrations: no database, payments, SMS/email or login. All data goes through a small repository interface whose demo implementation uses `localStorage`.

## Run it

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. Other scripts:

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (slot engine, DST, holidays, validation, .ics, repository) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run check` | All of the above in order |

## What's in it

| Route | Contents |
| --- | --- |
| `/` | Hero, intro, popular services with prices, team, gallery strip, testimonials, opening hours and map, booking call to action |
| `/tjenester` | Full price list by category; "Bestill" on each service pre-selects it |
| `/team` | Each person with role, services and working days; "Bestill hos …" pre-selects them |
| `/galleri` | Gallery |
| `/om-oss` | Address, hours, contact, map placeholder, story, FAQ |
| `/bestill` | Booking flow: service(s) → person or "Ingen preferanse" → date → time → details → confirmation |
| `/bestilling/[ref]` | Confirmation with reference code, `.ics` download and cancellation |
| `/admin` | Demo admin behind a marked demo gate: day calendar (create, move, cancel), services, staff schedules, opening hours, "Tilbakestill demodata" |

Also generated from the config: per-page metadata and Open Graph, an OG image, `sitemap.xml`, `robots.txt` and `HairSalon` (LocalBusiness) JSON-LD.

## Tilpasse til en ny salong (tailoring for a new salon)

1. **Copy the project** and edit `salon.config.ts`. That file is the whole brief:
   - **Identity:** `name`, `shortName`, `tagline`, `description`, `logo` (mark, text, suffix), `founded`, `siteUrl`.
   - **Contact:** phone, email, address, area, coordinates, directions; `social` links.
   - **`openingHours`:** per ISO weekday (1 = Monday). `null` means closed.
   - **`booking`:** slot step, buffer between appointments, minimum notice, horizon in days, `closeOnPublicHolidays`, extra `closedDates`, cancellation window.
   - **Copy:** `hero`, `intro`, `about`, `testimonials`, `faq`.
   - **`categories` and `services`:** name, description, duration, price in NOK, `priceFrom`, `popular`, `active`.
   - **`staff`:** name, role, bio, `serviceIds`, and a weekly `schedule`. Several ranges per day give a lunch break.
   - **`gallery`, `heroImage`, `introImage` and staff `image`:** set `src` to a file in `/public` to show a photo. Without `src`, a labelled placeholder with the same aspect ratio is shown.
2. **Re-skin with `theme`:**
   - `colors`: `paper`, `stone`, `ink`, `muted`, `accent`. Keep `muted` and `accent` at 4.5:1 or more against `paper`.
   - `radius`.
   - `sectionStyle`: `"bands"` or `"rules"`.
   - `fonts`: keys into `src/app/fonts.ts`. To use a different face, drop the `.woff2` into `src/fonts`, add an entry to the registry and widen the type in `src/lib/types.ts`.
3. **Run `npm run check`.** Demo data in browsers reseeds automatically, because the stored state is fingerprinted against the config.

Interface copy shared by all salons (button labels, validation messages and so on) lives in `src/i18n/nb.ts`.

## Project structure

```
salon.config.ts              The salon: content, rules, theme
src/app/                     Routes (App Router), layout, fonts, sitemap, robots, OG image
src/components/site|home     Content pages and shared site chrome
src/components/booking       Booking flow and confirmation
src/components/admin         Demo admin
src/components/ui            Button, Field, ImageSlot, Section, SectionHead
src/lib/booking              Slot generation, overlap, policy, validation, .ics, references (pure)
src/lib/time                 Europe/Oslo helpers (DST-safe) and Norwegian public holidays
src/lib/repository           BookingRepository interface, localStorage implementation, seed data, React hooks
src/i18n                     UI strings (bokmål)
```

See `DECISIONS.md` for the reasoning behind the design and architecture.

## Deliberately stubbed integrations

| Area | In the demo | To make it real |
| --- | --- | --- |
| **Database** | `localStorage`, per browser (`src/lib/repository/local-storage.ts`) | Implement `SalonRepository` against an API or database (e.g. Postgres) and return it from `getRepository()`. Move `createBooking` checks to the server, inside a transaction. |
| **Auth** | `/admin` has a demo gate with no access control | Real login for salon staff (e.g. magic link or BankID for owners) and server-side authorization. |
| **SMS and email** | None; the confirmation page says so | Booking confirmations, reminders 24h before and cancellation receipts (e.g. via a Norwegian SMS gateway and a transactional email service). |
| **Payments** | None; customers pay in the salon | Optional deposit or no-show fee with Vipps or card. |
| **Calendar sync** | One-off `.ics` download per booking | Two-way sync for staff (Google/Microsoft calendars) or an ICS feed per person. |
| **Map** | Drawn placeholder linking to OpenStreetMap | Embedded map with consent handling, if wanted. |
| **Cancellation link** | Works only in the browser that booked | A signed, per-booking token in the confirmation SMS/email. |
