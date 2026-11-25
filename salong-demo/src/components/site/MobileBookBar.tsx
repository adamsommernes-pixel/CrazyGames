"use client";

import Link from "next/link";
import { useProfile } from "@/lib/repository/live";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";

/** Sticky booking action on small screens. */
export function MobileBookBar() {
  const { phone } = useProfile().contact;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-ink text-paper md:hidden">
      <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
        <Link href="/bestill" className="flex min-h-15 flex-1 items-center justify-between px-5 text-body font-medium">
          {t.nav.book}
          <span aria-hidden="true">→</span>
        </Link>
        <a
          href={telHref(phone)}
          className="label flex min-h-15 items-center border-l border-paper/25 px-5"
          aria-label={`${t.nav.call} ${phone}`}
        >
          {t.nav.call}
        </a>
      </div>
    </div>
  );
}
