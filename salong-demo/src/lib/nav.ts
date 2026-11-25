import { t } from "@/i18n";

export const mainNav = [
  { href: "/tjenester", label: t.nav.services },
  { href: "/team", label: t.nav.team },
  { href: "/galleri", label: t.nav.gallery },
  { href: "/om-oss", label: t.nav.about },
] as const;
