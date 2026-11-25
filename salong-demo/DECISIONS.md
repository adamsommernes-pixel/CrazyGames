# Decisions

Short notes on the choices made while building the demo, so the next person (or the next salon) knows why things are the way they are.

## Design direction: warm editorial

A Scandinavian salon as a good print magazine would present it, not a SaaS landing page.

- **Paper, stone, ink and one rust accent.** Five colours in total, all defined as tokens and checked for WCAG AA contrast. No gradients, glows or blur.
- **Type does the work.** *Newsreader* (an editorial serif with true italics) at large, fluid sizes for headings; *Schibsted Grotesk* (made for a Norwegian newspaper house) for body text and UI.
- **Print furniture instead of cards.** Numbered section openers ("01 — Salongen"), hairline rules, dotted price leaders, small tracked labels, crop marks on image placeholders and drop caps. Corners are almost square (2px) and nothing has a shadow.
- **An asymmetric 12-column grid with a varied rhythm.** The hero bleeds off the edge, the intro is offset, prices sit on a stone band, portraits are staggered, the gallery is a horizontal strip, testimonials are one big quote beside a column of short ones on an ink band, and the call to action is a single rust band. No section pattern repeats back to back.
- **Quiet motion only.** A short fade on navigation, scroll reveals built with CSS scroll-driven animations (no JavaScript), and arrow nudges on hover. All of it is turned off by `prefers-reduced-motion`.

## Architecture

- **One config file per salon.** `salon.config.ts` holds content, prices, staff, schedules, booking rules and theme tokens. The root layout writes the theme as CSS variables, Tailwind's default palette, fonts, radii and shadows are removed, and every utility points at those variables.
- **Fonts are chosen by key.** `next/font` needs static declarations, so `src/app/fonts.ts` is a small registry and the config picks a face from it by key. Adding a new face means adding one entry there.
- **The theme has a section-style token.** `theme.sectionStyle` is `"bands"` (tonal bands) or `"rules"` (hairlines only), which gives a second, quieter look without code changes.
- **Data goes through a repository interface.** `BookingRepository` and `AdminRepository` (in `src/lib/repository/types.ts`) are the only way the UI reads or writes data. The demo implementation uses localStorage, re-reads storage on every call, and notifies listeners, including other tabs through the `storage` event.
  - A database-backed implementation of `SalonRepository` replaces it by changing `getRepository()` alone.
  - Every method is async, as a real API would be.
- **Booking rules are pure functions.** `src/lib/booking/slots.ts` gets everything (rules, hours, staff, bookings, "now") as input. It is deterministic and unit-tested, and the same code would run server-side later.
- **Times are real instants.** Bookings are stored as UTC ISO instants. All local maths goes through `src/lib/time/zoned.ts`, which uses `Intl` to find the Europe/Oslo offset, so DST is never hard-coded.
  - Slot steps are taken in real time and aligned to the local wall clock.
  - On a spring-forward day the missing hour is never offered. On a fall-back day the repeated hour is offered twice, as two different instants.
- **The buffer applies on both sides.** Two appointments for the same person must be at least `bufferMin` apart. A slot may end exactly at closing time.
- **Multi-service bookings are one appointment with one person.** The total duration is the sum of the services. Services that nobody can combine with the current selection are disabled, with a written reason.
- **"Ingen preferanse" assigns staff by load.** A time is offered if any qualified person is free, and the booking goes to whoever has the fewest booked minutes that day (ties go to config order).
- **Temporary closures are data, not config.** The admin's "Stengt og fravær" tab adds closures for a whole day or a time range, for the whole salon or one person. They are seeded from `booking.closedDates`.
  - Salon-wide closures are shown to customers under "Avvikende åpningstider"; staff absences stay private.
  - A closure blocks only its own time: the buffer applies between appointments, not around closures.
  - Existing bookings inside a new closure are listed for the owner, not moved or cancelled automatically, because that needs a conversation with the customer.
- **Two panels by role.** `/staff` holds day-to-day work (calendar, closures, working hours). `/admin` holds owner decisions (staff, services and prices, opening hours, salon details, booking rules, password, demo reset).
- **Salon details and booking rules are editable data.** The repository stores them, seeded from the config. Pages render from the config on the server and pick up edits after hydration through small client leaves (`ProfileText`, `PhoneLink` …). Page titles, Open Graph and JSON-LD stay build-time; in production they would be revalidated from the database.
- **Removing a staff member archives them**, like services: refused while they have upcoming bookings, and past bookings keep the name.
- **Deleting a service archives it.** Past bookings keep the service name. Deletion is refused while the service has upcoming bookings; hiding it is the alternative.
- **Public holidays are computed.** Norwegian holidays come from the Easter date (`closeOnPublicHolidays`), so nobody has to maintain them. Christmas Eve and New Year's Eve are not public holidays, so they sit in `closedDates`.
- **Cancellation rules:** customers can cancel online until the appointment starts. Inside the configured window (24h) they see a warning that a fee may apply, matching the FAQ. The admin can always cancel.
- **The admin can override some rules.** Bookings made in the admin ignore minimum notice and the horizon, but never allow double-booking. Email is optional for them, since the salon often books by phone.
- **Seed data is deterministic.** Demo bookings are generated per day from a seeded random function. The first Saturday ahead is booked solid so the "Fullt" state is visible in the date picker.
  - The stored state carries a fingerprint of the config and a data version, so editing `salon.config.ts` reseeds automatically.

## Rendering and performance

- **Content pages are static server components.** A handful of small client islands (navigation state, mobile menu, price list, opening hours, "open today") use `useLiveCatalog`. It renders from the config on the server, then picks up admin edits after hydration, without a loading state or layout shift.
- **The repository loads on demand on content pages.** It arrives through a dynamic `import()`, so the home page doesn't ship the slot engine or the seed data.
- **The booking flow and admin are client components.** Their data lives in the browser. `/bestill` reads `?tjeneste=` and `?frisor=` on the server to pre-select a service or a person.
- **Fonts are self-hosted.** They are subset to Latin-1 plus typographic punctuation (æ, ø, å included) and use metric-adjusted fallbacks.
- **`ImageSlot` reserves its aspect ratio.** It always holds the same box, so dropping in real photos later causes no layout shift. It uses `next/image` once `src` is set.
- **Lighthouse** (mobile emulation, measured inside a shared, CPU-throttled container):

  | Page | Performance | Accessibility | Best Practices | SEO |
  | --- | --- | --- | --- | --- |
  | Home | 94–97 across runs | 100 | 100 | 100 |
  | `/tjenester` | 97 | 100 | 100 | 100 |
  | `/bestill` | 95 | 100 | 100 | 100 |

  What remains is mostly React's own runtime.

## Accessibility

- **Semantic structure:** a skip link, landmarks, one `h1` per page, `aria-current` on navigation, and visible `:focus-visible` outlines in the accent colour.
- **Status never relies on colour.** In the date picker, "Fullt" and "Stengt" are written out and the date is struck through. Every day button has a full spoken label ("torsdag 26. november: 12 ledige tider"). Disabled services say why in text.
- **Each booking step moves focus to its heading.**
- **Form errors are reported twice.** Each field shows its error inline (`aria-invalid` / `aria-describedby`), and on submit an error summary takes focus and links to each field.
- **Dialogs use the native `<dialog>` element**, which gives focus trapping and Esc to close. The admin tabs follow the ARIA tabs pattern with arrow keys.
- **Tap targets are at least 44px.** The booking flow has a sticky action bar on phones, and content pages have a sticky "Bestill time" bar.

## Language

- **UI copy lives in `src/i18n/nb.ts`.** It is typed as `Dictionary`, so a second language has to be complete. Salon content (services, bios, FAQ) stays in the config as plain bokmål strings.
- **Adding a language later:** turn those config fields into `{ nb, en }` objects and add a locale segment to the routes.
- **Formatting is nb-NO via `Intl`:** 24-hour clock, prices as "1 290 kr" and Europe/Oslo time. Durations are written the way Norwegian price lists write them (90 min, 2 t 30 min).

## Deliberately left out

- **Real map.** It would bring a third party and cookies. A drawn map placeholder links to OpenStreetMap instead.
- **Real auth.** `/staff` has a clearly marked demo gate. `/admin` asks for a password, but it is hashed and compared in the browser, so it keeps honest people out without being access control. Both are `noindex`.
- **Server-side storage.** Bookings live in the visitor's own browser. The confirmation link therefore only works in the browser that made the booking, and the page says so when it can't find one.
