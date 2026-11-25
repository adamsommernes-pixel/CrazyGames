"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { telHref } from "@/lib/format";
import { mainNav } from "@/lib/nav";
import { buttonClass } from "@/components/ui/Button";

/** Full-screen menu for small screens, built on the native <dialog> for focus handling. */
export function MobileMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="label inline-flex min-h-11 items-center gap-2 pl-2 md:hidden"
      >
        <span aria-hidden="true" className="flex w-5 flex-col gap-[5px]">
          <span className="h-px bg-current" />
          <span className="h-px bg-current" />
        </span>
        {t.nav.menu}
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={t.nav.mainNav}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="page-x flex h-full flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          <div className="flex items-center justify-between">
            <span className="font-display text-d4">{salon.name}</span>
            <button type="button" onClick={() => setOpen(false)} className="label -mr-2 min-h-11 px-2" autoFocus>
              {t.nav.close}
            </button>
          </div>
          <nav aria-label={t.nav.mainNav} className="mt-12">
            <ul className="border-t border-line">
              {[{ href: "/", label: t.nav.home }, ...mainNav].map((item, i) => (
                <li key={item.href} className="border-b border-line">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className="flex items-baseline gap-4 py-4 font-display text-d3 aria-[current=page]:italic"
                  >
                    <span className="label tabular text-muted">{String(i + 1).padStart(2, "0")}</span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto grid gap-3">
            <Link href="/bestill" onClick={() => setOpen(false)} className={buttonClass("solid", "lg", "w-full")}>
              {t.nav.book}
            </Link>
            <a href={telHref(salon.contact.phone)} className={buttonClass("outline", "lg", "w-full")}>
              {t.common.phone}: {salon.contact.phone}
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
