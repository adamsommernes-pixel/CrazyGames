import Link from "next/link";
import { salon } from "@config";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";
import { mainNav } from "@/lib/nav";
import { HoursSummary } from "./HoursSummary";

export function SiteFooter() {
  const { address, phone, email } = salon.contact;
  return (
    <footer className="page-x bg-ink pb-28 pt-16 text-paper md:pb-12 md:pt-20">
      <div className="page-grid mx-auto max-w-page gap-y-12">
        <div className="col-span-12 lg:col-span-5">
          <p className="font-display text-d2 italic">{salon.name}</p>
          <p className="mt-4 max-w-sm text-stone">{salon.tagline}.</p>
        </div>

        <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-2">
          <h2 className="label text-stone">{t.common.address}</h2>
          <address className="mt-4 not-italic leading-relaxed">
            {address.street}
            <br />
            {address.postalCode} {address.city}
          </address>
          <p className="mt-4 leading-relaxed">
            <a href={telHref(phone)} className="link">{phone}</a>
            <br />
            <a href={`mailto:${email}`} className="link break-all">{email}</a>
          </p>
        </div>

        <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
          <h2 className="label text-stone">{t.common.openingHours}</h2>
          <HoursSummary className="tabular mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 whitespace-nowrap" />
        </div>

        <nav aria-label="Bunnmeny" className="col-span-12 md:col-span-4 lg:col-span-2">
          <h2 className="label text-stone">{t.nav.menu}</h2>
          <ul className="mt-4 grid gap-1">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="link">{item.label}</Link>
              </li>
            ))}
            {salon.social.map((s) => (
              <li key={s.href}>
                <a href={s.href} className="link" rel="noopener">{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-span-12 flex flex-wrap items-center justify-between gap-4 border-t border-paper/20 pt-6 text-small text-stone">
          <p>
            © {salon.founded}–{new Date().getFullYear()} {salon.name}. {t.footer.demo}
          </p>
          <Link href="/admin" className="link">{t.footer.admin}</Link>
        </div>
      </div>
    </footer>
  );
}
