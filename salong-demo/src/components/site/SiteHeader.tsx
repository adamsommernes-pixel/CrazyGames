import Link from "next/link";
import { salon } from "@config";
import { t } from "@/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { Wordmark } from "./Wordmark";

export function SiteHeader({ showBook = true }: { showBook?: boolean }) {
  return (
    <header className="page-x border-b border-line">
      <div className="mx-auto flex h-18 max-w-page items-center justify-between gap-6 md:h-20">
        <Link href="/" className="-my-2 py-2" aria-label={`${salon.name}, ${t.nav.home.toLowerCase()}`}>
          <Wordmark />
        </Link>
        <nav aria-label={t.nav.mainNav} className="hidden md:block">
          <NavLinks className="flex items-center gap-7 text-small lg:gap-9" linkClassName="py-2" />
        </nav>
        <div className="flex items-center gap-4">
          {showBook && (
            <span className="hidden md:block">
              <ButtonLink href="/bestill">{t.nav.book}</ButtonLink>
            </span>
          )}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
