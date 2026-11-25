import Link from "next/link";
import { salon } from "@config";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";

/** Sticky booking action on small screens. Pure markup, no JavaScript. */
export function MobileBookBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-ink text-paper md:hidden">
      <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
        <Link href="/bestill" className="flex min-h-15 flex-1 items-center justify-between px-5 text-body font-medium">
          {t.nav.book}
          <span aria-hidden="true">→</span>
        </Link>
        <a
          href={telHref(salon.contact.phone)}
          className="label flex min-h-15 items-center border-l border-paper/25 px-5"
          aria-label={`${t.nav.call} ${salon.contact.phone}`}
        >
          {t.nav.call}
        </a>
      </div>
    </div>
  );
}
