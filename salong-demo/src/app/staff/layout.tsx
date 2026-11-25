import type { Metadata } from "next";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t.panel.staffTitle,
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-paper">{children}</div>;
}
